import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { localModelCapabilities } from "../runtime/capabilities.js";
import type { AIProviderAdapter, ModelInfo, SessionConfig, ToolCapabilities } from "../types/index.js";
import type { ProcessSession } from "../runtime/processSession.js";
import { commandExists, commandProducesOutput } from "../utils/command.js";

export class OllamaAdapter implements AIProviderAdapter {
  readonly provider = "ollama" as const;
  readonly category = "local-model" as const;
  readonly capabilities: ToolCapabilities = {
    ...localModelCapabilities,
    jsonMode: true,
    embeddings: true,
  };

  async isInstalled(): Promise<boolean> {
    return commandExists("ollama", ["--version"]);
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    if (!(await this.isInstalled())) return [];

    const output = await commandProducesOutput("ollama", ["list"]);
    return parseOllamaList(output).map((model) => ({
      id: model,
      name: model,
      provider: this.provider,
      category: this.category,
      capabilities: this.capabilities,
    }));
  }

  createTurnProcess(config: SessionConfig, _prompt: string): ChildProcessWithoutNullStreams {
    const model = config.modelId;
    if (!model) {
      throw new Error("Ollama sessions require config.modelId");
    }

    return spawn("ollama", ["run", model, ...(config.args ?? [])], {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      stdio: "pipe",
      windowsHide: true,
    });
  }

  async stop(session: ProcessSession): Promise<void> {
    await session.terminate();
  }
}

function parseOllamaList(output: string): string[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.toLowerCase().startsWith("name "))
    .map((line) => line.split(/\s+/)[0])
    .filter((model): model is string => Boolean(model));
}
