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
} from "../types/index.js";
import { createSessionId } from "../utils/ids.js";
import { cleanToken, cleanCliOutput } from "../utils/output.js";
import { buildConversationPrompt, createChatMessage, normalizeMessages } from "../utils/prompts.js";
import { extractAssistantTextChunk } from "../utils/agentStreamJson.js";
import { normalizeError } from "../utils/normalizeError.js";

const DEFAULT_KILL_TIMEOUT_MS = 2_500;

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

  private startedEmitted = false;

  constructor(adapter: AIProviderAdapter, config: SessionConfig) {
    super();
    // Node.js throws if `error` is emitted with no listeners on the emitter.
    this.on("error", function orchestraRuntimeDefaultErrorSink() {
      /* optional app listeners still run; this only guarantees listenerCount >= 1 */
    });
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
    if (this.status === "closed") {
      this.emit("error", {
        session: this,
        error: new Error(`Cannot restart closed session ${this.id}`),
      });
      return;
    }
    if (!this.startedEmitted) {
      this.startedEmitted = true;
      this.emit("started", { session: this });
    }
  }

  send(input: string): void {
    const trimmed = input.trim();
    if (!trimmed) return;

    if (this.status === "closed") {
      this.emit("error", {
        session: this,
        error: new Error(`Cannot send message to closed session ${this.id}`),
      });
      return;
    }

    if (this.process && !this.process.killed) {
      this.emit("error", {
        session: this,
        error: new Error(`Session ${this.id} is busy with another turn`),
      });
      return;
    }

    this.messages.push(createChatMessage("user", trimmed));
    this.touch();
    this.setStatus("running");

    const prompt = buildConversationPrompt(this.messages);

    let child: ChildProcessWithoutNullStreams;
    try {
      child = this.adapter.createTurnProcess(this.config, prompt);
    } catch (error) {
      this.messages.pop();
      this.setStatus("idle");
      this.emit("error", { session: this, error: normalizeError(error) });
      return;
    }

    this.process = child;

    if (this.adapter.capabilities.stdoutFormat === "ndjson") {
      this.bindNdjsonTurn(child, prompt);
    } else {
      this.bindPlainTextTurn(child, prompt);
    }
  }

  private bindPlainTextTurn(child: ChildProcessWithoutNullStreams, prompt: string): void {
    let accumulated = "";
    const stderrChunks: string[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      const { cleaned, raw } = cleanToken(chunk);
      if (!cleaned) return;
      accumulated += cleaned;
      this.touch();
      this.emit("token", { session: this, token: cleaned, raw });
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk.toString("utf8"));
    });

    child.on("error", (error) => {
      this.emit("error", { session: this, error });
    });

    child.on("exit", (code, signal) => {
      this.finalizeTurnChildExit(accumulated, stderrChunks.join(""), code, signal);
    });

    this.writePromptToStdin(child, prompt);
  }

  private bindNdjsonTurn(child: ChildProcessWithoutNullStreams, prompt: string): void {
    let lineBuf = "";
    let accumulated = "";
    const stderrChunks: string[] = [];

    const processLine = (trimmed: string) => {
      if (!trimmed) return;
      let obj: unknown;
      try {
        obj = JSON.parse(trimmed);
      } catch {
        return;
      }
      const text = extractAssistantTextChunk(obj);
      if (!text) return;
      accumulated += text;
      const { cleaned, raw } = cleanToken(text);
      if (cleaned) {
        this.touch();
        this.emit("token", { session: this, token: cleaned, raw });
      }
    };

    const flushLines = (finalize: boolean) => {
      const parts = lineBuf.split("\n");
      if (finalize) {
        for (const line of parts) {
          processLine(line.trim());
        }
        lineBuf = "";
        return;
      }
      lineBuf = parts.pop() ?? "";
      for (const line of parts) {
        processLine(line.trim());
      }
    };

    child.stdout.on("data", (chunk: Buffer) => {
      lineBuf += chunk.toString("utf8");
      flushLines(false);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk.toString("utf8"));
    });

    child.on("error", (error) => {
      this.emit("error", { session: this, error });
    });

    child.on("exit", (code, signal) => {
      flushLines(true);
      this.finalizeTurnChildExit(accumulated, stderrChunks.join(""), code, signal);
    });

    this.writePromptToStdin(child, prompt);
  }

  private finalizeTurnChildExit(
    accumulatedStream: string,
    stderrJoined: string,
    code: number | null,
    signal: NodeJS.Signals | null,
  ): void {
    const stderrText = stderrJoined.trim();
    const contentFromStream = accumulatedStream.trim();
    const fallback = contentFromStream || (stderrText && code !== 0 ? stderrText : "");

    this.process = null;

    if (code !== 0) {
      const msg =
        stderrText ||
        `Process exited with code ${code}${signal ? ` signal ${signal}` : ""}`;
      this.emit("error", {
        session: this,
        error: new Error(msg.trim()),
        stderr: stderrText || undefined,
      });
      this.setStatus("error");
    } else if (fallback) {
      this.addAssistantMessage(fallback);
      this.setStatus("idle");
    } else {
      this.setStatus("idle");
    }

    this.emit("exit", { session: this, code, signal });
  }

  private writePromptToStdin(child: ChildProcessWithoutNullStreams, prompt: string): void {
    try {
      if (!child.stdin.writableEnded) {
        child.stdin.write(prompt, "utf8");
        child.stdin.end();
      }
    } catch (error) {
      this.emit("error", { session: this, error: normalizeError(error) });
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }
  }

  async kill(): Promise<void> {
    await this.adapter.stop(this);
  }

  async terminate(signal: NodeJS.Signals = "SIGTERM"): Promise<void> {
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
      this.emit("error", {
        session: this,
        error: new Error(`Session ${this.id} is not writable`),
      });
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      child.stdin.write(value, (error) => {
        if (error) {
          this.emit("error", { session: this, error: normalizeError(error) });
        }
        resolve();
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

  private close(): void {
    if (this.status === "closed") return;
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
