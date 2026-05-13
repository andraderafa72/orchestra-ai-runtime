import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { ProcessSession } from "../runtime/processSession.js";

export type AIProviderType =
  | "ollama"
  | "claude-cli"
  | "cursor-cli"
  | "llama-cpp"
  | "lm-studio"
  | "gemini-cli"
  | "openinterpreter"
  | "aider"
  | "codellama"
  | (string & {});

export type AIProviderCategory = "local-model" | "local-agent";

/** How `ProcessSession` parses each turn subprocess stdout. */
export type ProviderStdoutFormat = "ndjson" | "plain";

export interface ToolCapabilities {
  streaming: boolean;
  jsonMode: boolean;
  embeddings: boolean;
  vision: boolean;
  toolCalling: boolean;
  /** Streamed line-delimited JSON (e.g. `claude -p --output-format stream-json`) vs raw text chunks (e.g. Ollama). */
  stdoutFormat: ProviderStdoutFormat;
  multiModal: boolean;
  codeExecution: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: AIProviderType;
  category: AIProviderCategory;
  contextWindow?: number;
  capabilities?: ToolCapabilities;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: number;
}

export type SessionStatus = "idle" | "running" | "closed" | "error";

export interface SessionConfig {
  id?: string;
  provider: AIProviderType;
  modelId?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  systemPrompt?: string;
  messages?: ChatMessage[];
  args?: string[];
  killTimeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ProviderDetectionResult {
  provider: AIProviderType;
  category: AIProviderCategory;
  installed: boolean;
  models: ModelInfo[];
  capabilities: ToolCapabilities;
}

export interface AIProviderAdapter {
  provider: AIProviderType;
  category: AIProviderCategory;
  capabilities: ToolCapabilities;
  isInstalled(): Promise<boolean>;
  getAvailableModels(): Promise<ModelInfo[]>;
  /**
   * Spawns one subprocess for this user turn. `ProcessSession` writes `prompt` to stdin and closes it.
   */
  createTurnProcess(config: SessionConfig, prompt: string): ChildProcessWithoutNullStreams;
  stop(session: ProcessSession): Promise<void>;
}

export interface SessionEventMap {
  token: { session: ProcessSession; token: string; raw: string };
  message: { session: ProcessSession; message: ChatMessage };
  /** `session` is null for errors raised before a session exists (e.g. invalid provider). */
  error: { session: ProcessSession | null; error: Error; stderr?: string };
  started: { session: ProcessSession };
  closed: { session: ProcessSession };
  exit: { session: ProcessSession; code: number | null; signal: NodeJS.Signals | null };
  statusChanged: { session: ProcessSession; status: SessionStatus; previousStatus: SessionStatus };
}

export interface RuntimeEventMap {
  token: SessionEventMap["token"];
  message: SessionEventMap["message"];
  error: SessionEventMap["error"];
  started: SessionEventMap["started"];
  closed: SessionEventMap["closed"];
  exit: SessionEventMap["exit"];
  statusChanged: SessionEventMap["statusChanged"];
  providersChanged: { providers: AIProviderAdapter[] };
  modelsChanged: { models: ModelInfo[] };
  sessionCreated: { session: ProcessSession };
  sessionDestroyed: { sessionId: string };
  shutdown: undefined;
}

export type EventListener<T> = (event: T) => void;
