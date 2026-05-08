import { EventEmitter } from "node:events";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type {
  AIProviderAdapter,
  AIProviderType,
  ChatMessage,
  EventListener,
  SessionConfig,
  SessionEventMap,
  SessionStatus,
} from "./types.js";
import { createSessionId } from "./utils/ids.js";
import { cleanToken, cleanCliOutput } from "./utils/output.js";
import { buildConversationPrompt, createChatMessage, normalizeMessages } from "./utils/prompts.js";

const DEFAULT_KILL_TIMEOUT_MS = 2_500;
const DEFAULT_RESPONSE_IDLE_MS = 700;

export class ProcessSession extends EventEmitter {
  readonly id: string;
  readonly provider: AIProviderType;
  readonly adapter: AIProviderAdapter;
  readonly config: SessionConfig;
  readonly createdAt: number;

  process: ChildProcessWithoutNullStreams | null = null;
  status: SessionStatus = "idle";
  messages: ChatMessage[];
  updatedAt: number;

  private assistantBuffer = "";
  private responseFlushTimer: NodeJS.Timeout | null = null;

  constructor(adapter: AIProviderAdapter, config: SessionConfig) {
    super();
    this.adapter = adapter;
    this.provider = adapter.provider;
    this.config = config;
    this.id = config.id ?? createSessionId(String(adapter.provider).replace(/[^a-z0-9_-]/gi, "-"));
    this.createdAt = Date.now();
    this.updatedAt = this.createdAt;
    this.messages = normalizeMessages(config.messages ?? []);

    if (config.systemPrompt?.trim()) {
      this.messages.unshift(createChatMessage("system", config.systemPrompt.trim(), this.createdAt));
    }
  }

  override on<K extends keyof SessionEventMap>(eventName: K, listener: EventListener<SessionEventMap[K]>): this;
  override on(eventName: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.on(eventName, listener);
  }

  override once<K extends keyof SessionEventMap>(eventName: K, listener: EventListener<SessionEventMap[K]>): this;
  override once(eventName: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.once(eventName, listener);
  }

  override off<K extends keyof SessionEventMap>(eventName: K, listener: EventListener<SessionEventMap[K]>): this;
  override off(eventName: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.off(eventName, listener);
  }

  override emit<K extends keyof SessionEventMap>(eventName: K, event: SessionEventMap[K]): boolean;
  override emit(eventName: string | symbol, ...args: unknown[]): boolean {
    return super.emit(eventName, ...args);
  }

  start(): void {
    if (this.process && !this.process.killed) return;
    if (this.status === "closed") {
      throw new Error(`Cannot restart closed session ${this.id}`);
    }

    try {
      this.process = this.adapter.createProcess(this.config);
      this.bindProcess(this.process);
      this.setStatus("running");
      this.emit("started", { session: this });
    } catch (error) {
      this.setStatus("error");
      this.emit("error", { session: this, error: toError(error) });
      throw error;
    }
  }

  async send(input: string): Promise<void> {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (this.status === "closed") {
      throw new Error(`Cannot send message to closed session ${this.id}`);
    }
    if (!this.process || this.process.killed) {
      this.start();
    }

    this.messages.push(createChatMessage("user", trimmed));
    this.touch();
    this.setStatus("running");
    this.resetAssistantBuffer();

    const prompt = buildConversationPrompt(this.messages);
    await this.adapter.sendMessage(this, prompt);
  }

  async kill(): Promise<void> {
    await this.adapter.stop(this);
  }

  async terminate(signal: NodeJS.Signals = "SIGTERM"): Promise<void> {
    this.clearResponseFlushTimer();
    this.flushAssistantMessage();

    const child = this.process;
    if (!child || child.killed) {
      this.close();
      return;
    }

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
        resolve();
      }, this.config.killTimeoutMs ?? DEFAULT_KILL_TIMEOUT_MS);

      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });

      child.kill(signal);
    });

    this.close();
  }

  writeToStdin(value: string): Promise<void> {
    const child = this.process;
    if (!child || child.killed || !child.stdin.writable) {
      throw new Error(`Session ${this.id} is not writable`);
    }

    return new Promise<void>((resolve, reject) => {
      child.stdin.write(value, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  getPrompt(): string {
    return buildConversationPrompt(this.messages);
  }

  addAssistantMessage(content: string): ChatMessage {
    const message = createChatMessage("assistant", cleanCliOutput(content).trim());
    if (!message.content) return message;
    this.messages.push(message);
    this.touch();
    this.emit("message", { session: this, message });
    return message;
  }

  private bindProcess(child: ChildProcessWithoutNullStreams): void {
    child.stdout.on("data", (chunk: Buffer) => this.handleStdout(chunk));
    child.stderr.on("data", (chunk: Buffer) => this.handleStderr(chunk));
    child.on("error", (error) => {
      this.setStatus("error");
      this.emit("error", { session: this, error });
    });
    child.on("exit", (code, signal) => {
      this.flushAssistantMessage();
      this.emit("exit", { session: this, code, signal });
      this.close();
    });
  }

  private handleStdout(chunk: Buffer): void {
    const { raw, cleaned } = cleanToken(chunk);
    if (!cleaned) return;

    this.assistantBuffer += cleaned;
    this.touch();
    this.emit("token", { session: this, token: cleaned, raw });
    this.scheduleAssistantFlush();
  }

  private handleStderr(chunk: Buffer): void {
    const { raw, cleaned } = cleanToken(chunk);
    const stderr = cleaned || raw;
    if (!stderr.trim()) return;

    this.touch();
    this.emit("error", {
      session: this,
      error: new Error(stderr.trim()),
      stderr,
    });
  }

  private scheduleAssistantFlush(): void {
    this.clearResponseFlushTimer();
    this.responseFlushTimer = setTimeout(() => {
      this.flushAssistantMessage();
      if (this.status === "running") {
        this.setStatus("idle");
      }
    }, this.config.responseIdleMs ?? DEFAULT_RESPONSE_IDLE_MS);
  }

  private flushAssistantMessage(): void {
    const content = this.assistantBuffer.trim();
    this.resetAssistantBuffer();
    if (!content) return;
    this.addAssistantMessage(content);
  }

  private resetAssistantBuffer(): void {
    this.clearResponseFlushTimer();
    this.assistantBuffer = "";
  }

  private clearResponseFlushTimer(): void {
    if (!this.responseFlushTimer) return;
    clearTimeout(this.responseFlushTimer);
    this.responseFlushTimer = null;
  }

  private close(): void {
    if (this.status === "closed") return;
    this.clearResponseFlushTimer();
    this.process = null;
    this.setStatus("closed");
    this.emit("closed", { session: this });
  }

  private setStatus(status: SessionStatus): void {
    if (this.status === status) return;
    const previousStatus = this.status;
    this.status = status;
    this.touch();
    this.emit("statusChanged", { session: this, status, previousStatus });
  }

  private touch(): void {
    this.updatedAt = Date.now();
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
