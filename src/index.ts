import { LocalAIProviderRuntime } from "./runtime/localAIProviderRuntime.js";

export type {
  AIProviderAdapter,
  AIProviderCategory,
  AIProviderType,
  ChatMessage,
  EventListener,
  ModelInfo,
  ProviderDetectionResult,
  ProviderStdoutFormat,
  RuntimeEventMap,
  SessionConfig,
  SessionEventMap,
  SessionStatus,
  ToolCapabilities,
} from "./types/index.js";

export {
  localAgentCapabilities,
  localModelCapabilities,
} from "./runtime/capabilities.js";
export { ProcessSession } from "./runtime/processSession.js";
export { ProvidersRegistry, createDefaultProvidersRegistry } from "./runtime/providersRegistry.js";
export { LocalAIProviderRuntime };
export { OllamaAdapter } from "./adapters/ollamaAdapter.js";
export { ClaudeCliAdapter } from "./adapters/claudeCliAdapter.js";
export { CursorCliAdapter } from "./adapters/cursorCliAdapter.js";
export { buildConversationPrompt, createChatMessage, normalizeMessages } from "./utils/prompts.js";
export {
  escapeForDoubleQuotedShell,
  escapeForSingleQuotedShell,
  sanitizePromptTransport,
} from "./utils/promptSafety.js";
export { cleanCliOutput, cleanToken, normalizeLineEndings, stripAnsi } from "./utils/output.js";
export { extractAssistantTextChunk } from "./utils/agentStreamJson.js";

export const localAIProviderRuntime = new LocalAIProviderRuntime();
