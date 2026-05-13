import { EventEmitter } from "node:events";
import type {
  AIProviderAdapter,
  AIProviderType,
  EventListener,
  ModelInfo,
  RuntimeEventMap,
  SessionConfig,
} from "../types/index.js";
import { ProcessSession } from "./processSession.js";
import { ProvidersRegistry, createDefaultProvidersRegistry } from "./providersRegistry.js";
import { normalizeError } from "../utils/normalizeError.js";

export class LocalAIProviderRuntime extends EventEmitter {
  selectedProvider: AIProviderType | null = null;
  availableProviders: AIProviderAdapter[] = [];
  availableModels: ModelInfo[] = [];
  readonly sessions = new Map<string, ProcessSession>();

  private readonly providersRegistry: ProvidersRegistry;

  constructor(providersRegistry = createDefaultProvidersRegistry()) {
    super();
    this.providersRegistry = providersRegistry;
    // Node.js throws if `error` is emitted with no listeners on the emitter.
    this.on("error", function orchestraRuntimeDefaultErrorSink() {
      /* optional app listeners still run; this only guarantees listenerCount >= 1 */
    });
  }

  override on<K extends keyof RuntimeEventMap>(eventName: K, listener: EventListener<RuntimeEventMap[K]>): this;
  override on(eventName: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.on(eventName, listener);
  }

  override once<K extends keyof RuntimeEventMap>(eventName: K, listener: EventListener<RuntimeEventMap[K]>): this;
  override once(eventName: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.once(eventName, listener);
  }

  override off<K extends keyof RuntimeEventMap>(eventName: K, listener: EventListener<RuntimeEventMap[K]>): this;
  override off(eventName: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.off(eventName, listener);
  }

  override emit<K extends keyof RuntimeEventMap>(eventName: K, event: RuntimeEventMap[K]): boolean;
  override emit(eventName: string | symbol, ...args: unknown[]): boolean {
    return super.emit(eventName, ...args);
  }

  async initialize(): Promise<void> {
    try {
      await this.detectInstalledProviders();
      await this.loadAvailableModels();
    } catch (error) {
      this.emitErrorFromUnknown(error);
    }
  }

  registerProvider(adapter: AIProviderAdapter): void {
    this.providersRegistry.register(adapter);
  }

  async detectInstalledProviders(): Promise<AIProviderAdapter[]> {
    const installed: AIProviderAdapter[] = [];

    for (const adapter of this.providersRegistry.list()) {
      try {
        if (await adapter.isInstalled()) {
          installed.push(adapter);
        }
      } catch (error) {
        this.emitErrorFromUnknown(error);
      }
    }

    this.availableProviders = installed;
    if (!this.selectedProvider || !installed.some((adapter) => adapter.provider === this.selectedProvider)) {
      this.selectedProvider = installed[0]?.provider ?? null;
    }

    this.emit("providersChanged", { providers: this.availableProviders });
    return this.availableProviders;
  }

  async loadAvailableModels(): Promise<ModelInfo[]> {
    const providers = this.availableProviders.length > 0
      ? this.availableProviders
      : await this.detectInstalledProviders();

    const models: ModelInfo[] = [];
    for (const adapter of providers) {
      try {
        models.push(...await adapter.getAvailableModels());
      } catch (error) {
        this.emitErrorFromUnknown(error);
      }
    }

    this.availableModels = models;
    this.emit("modelsChanged", { models: this.availableModels });
    return this.availableModels;
  }

  createSession(config: SessionConfig): ProcessSession | null {
    const adapter = this.providersRegistry.get(config.provider);
    if (!adapter) {
      this.emit("error", {
        session: null,
        error: new Error(`Provider ${config.provider} is not registered`),
      });
      return null;
    }

    const session = new ProcessSession(adapter, config);
    this.sessions.set(session.id, session);
    this.bindSession(session);
    session.start();
    this.emit("sessionCreated", { session });
    return session;
  }

  getSession(sessionId: string): ProcessSession | undefined {
    return this.sessions.get(sessionId);
  }

  async destroySession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    await session.kill();
    if (this.sessions.delete(sessionId)) {
      this.emit("sessionDestroyed", { sessionId });
    }
    return true;
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.sessions.keys()].map((sessionId) => this.destroySession(sessionId)));
    this.sessions.clear();
    this.emit("shutdown", undefined);
  }

  private emitErrorFromUnknown(error: unknown): void {
    this.emit("error", { session: null, error: normalizeError(error) });
  }

  private bindSession(session: ProcessSession): void {
    session.on("token", (event) => this.emit("token", event));
    session.on("message", (event) => this.emit("message", event));
    session.on("error", (event) => this.emit("error", event));
    session.on("started", (event) => this.emit("started", event));
    session.on("exit", (event) => this.emit("exit", event));
    session.on("statusChanged", (event) => this.emit("statusChanged", event));
    session.on("closed", (event) => {
      this.emit("closed", event);
      if (this.sessions.delete(session.id)) {
        this.emit("sessionDestroyed", { sessionId: session.id });
      }
    });
  }
}
