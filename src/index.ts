import { LocalAIProviderRuntime } from "./localAIProviderRuntime.js";

export type {
  AIProviderAdapter,
  AIProviderCategory,
  AIProviderType,
  ChatMessage,
  EventListener,
  ModelInfo,
  ProviderDetectionResult,
  RuntimeEventMap,
  SessionConfig,
  SessionEventMap,
  SessionStatus,
  ToolCapabilities,
} from "./types.js";

export { localAgentCapabilities, localModelCapabilities } from "./capabilities.js";
export { ProcessSession } from "./processSession.js";
export { ProvidersRegistry, createDefaultProvidersRegistry } from "./providersRegistry.js";
export { LocalAIProviderRuntime } from "./localAIProviderRuntime.js";
export { OllamaAdapter } from "./adapters/ollamaAdapter.js";
export { ClaudeCliAdapter } from "./adapters/claudeCliAdapter.js";
export { CursorCliAdapter } from "./adapters/cursorCliAdapter.js";
export { buildConversationPrompt, createChatMessage, normalizeMessages } from "./utils/prompts.js";
export { cleanCliOutput, cleanToken, normalizeLineEndings, stripAnsi } from "./utils/output.js";

export const localAIProviderRuntime = new LocalAIProviderRuntime();
