import type { ToolCapabilities } from "../types/index.js";

export const localModelCapabilities: ToolCapabilities = {
  streaming: true,
  jsonMode: false,
  embeddings: false,
  vision: false,
  toolCalling: false,
  stdoutFormat: "plain",
  multiModal: false,
  codeExecution: false,
};

/** Baseline capabilities for a local agent CLI (stream-json / NDJSON stdout). */
export const localAgentCapabilities: ToolCapabilities = {
  streaming: true,
  jsonMode: true,
  embeddings: false,
  vision: false,
  toolCalling: true,
  stdoutFormat: "ndjson",
  multiModal: true,
  codeExecution: true,
};
