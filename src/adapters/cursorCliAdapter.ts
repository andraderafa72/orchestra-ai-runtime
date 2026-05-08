import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { localAgentCapabilities } from "../capabilities.js";
import type { AIProviderAdapter, ModelInfo, SessionConfig, ToolCapabilities } from "../types.js";
import type { ProcessSession } from "../processSession.js";
import { commandExists } from "../utils/command.js";

const CURSOR_CLI_CANDIDATES = ["cursor-agent", "cursor"];

export class CursorCliAdapter implements AIProviderAdapter {
  readonly provider = "cursor-cli" as const;
  readonly category = "local-agent" as const;
  readonly capabilities: ToolCapabilities = {
    ...localAgentCapabilities,
    multiModal: true,
  };

  private command = process.env.ORCHESTRA_CURSOR_CLI_COMMAND ?? CURSOR_CLI_CANDIDATES[0]!;

  async isInstalled(): Promise<boolean> {
    for (const command of [this.command, ...CURSOR_CLI_CANDIDATES]) {
      if (await commandExists(command, ["--version"])) {
        this.command = command;
        return true;
      }
    }
    return false;
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    if (!(await this.isInstalled())) return [];

    return [
      {
        id: "cursor-agent",
        name: "Cursor Agent CLI",
        provider: this.provider,
        category: this.category,
        capabilities: this.capabilities,
      },
    ];
  }

  createProcess(config: SessionConfig): ChildProcessWithoutNullStreams {
    const args = [...(config.args ?? [])];
    if (this.command === "cursor" && !args.includes("agent")) {
      args.unshift("agent");
    }

    return spawn(this.command, args, {
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
