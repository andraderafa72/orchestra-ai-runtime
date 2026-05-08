import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { localAgentCapabilities } from "../runtime/capabilities.js";
import type { AIProviderAdapter, ModelInfo, SessionConfig, ToolCapabilities } from "../types/index.js";
import type { ProcessSession } from "../runtime/processSession.js";
import { commandExists } from "../utils/command.js";

export class ClaudeCliAdapter implements AIProviderAdapter {
  readonly provider = "claude-cli" as const;
  readonly category = "local-agent" as const;
  readonly capabilities: ToolCapabilities = {
    ...localAgentCapabilities,
    multiModal: true,
  };

  async isInstalled(): Promise<boolean> {
    return commandExists("claude", ["--version"]);
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    if (!(await this.isInstalled())) return [];

    return [
      {
        id: "claude-cli",
        name: "Claude CLI Agent",
        provider: this.provider,
        category: this.category,
        capabilities: this.capabilities,
      },
    ];
  }

  createProcess(config: SessionConfig): ChildProcessWithoutNullStreams {
    const args = [...(config.args ?? [])];
    if (config.modelId && config.modelId !== "claude-cli") {
      args.unshift(config.modelId);
      args.unshift("--model");
    }

    return spawn("claude", args, {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      stdio: "pipe",
      windowsHide: true,
    });
  }

  async sendMessage(session: ProcessSession, input: string): Promise<void> {
    await session.writeToStdin(`${input.trim()}\n`);
  }

  async stop(session: ProcessSession): Promise<void> {
    await session.terminate();
  }
}
