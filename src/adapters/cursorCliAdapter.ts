import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { localAgentCapabilities } from "../runtime/capabilities.js";
import type { AIProviderAdapter, ModelInfo, SessionConfig, ToolCapabilities } from "../types/index.js";
import type { ProcessSession } from "../runtime/processSession.js";
import { commandExists } from "../utils/command.js";

const CURSOR_CLI_CANDIDATES = ["cursor-agent", "cursor"];

export class CursorCliAdapter implements AIProviderAdapter {
  readonly provider = "cursor-cli" as const;
  readonly category = "local-agent" as const;
  readonly capabilities: ToolCapabilities = localAgentCapabilities;

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

  createTurnProcess(config: SessionConfig, _prompt: string): ChildProcessWithoutNullStreams {
    const args: string[] = [
      "-p",
      "--output-format",
      "stream-json",
      "--stream-partial-output",
    ];
    if (config.modelId && config.modelId !== "cursor-agent") {
      args.push("--model", config.modelId);
    }
    args.push(...(config.args ?? []));
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

  async stop(session: ProcessSession): Promise<void> {
    await session.terminate();
  }
}
