import type { ToolCapabilities } from "./types.js";

export const localModelCapabilities: ToolCapabilities = {
  streaming: true,
  jsonMode: false,
  embeddings: false,
  vision: false,
  toolCalling: false,
  persistentSession: true,
  multiModal: false,
  codeExecution: false,
};

export const localAgentCapabilities: ToolCapabilities = {
  streaming: true,
  jsonMode: false,
  embeddings: false,
  vision: false,
  toolCalling: true,
  persistentSession: true,
  multiModal: false,
  codeExecution: true,
};
