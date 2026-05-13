import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { localAgentCapabilities } from "../runtime/capabilities.js";
import type { AIProviderAdapter, ModelInfo, SessionConfig, ToolCapabilities } from "../types/index.js";
import type { ProcessSession } from "../runtime/processSession.js";
import { commandExists } from "../utils/command.js";

const DISALLOW_BASH_ENV = process.env.ORCHESTRA_CLAUDE_DISALLOW_BASH;
const METADATA_DISALLOW_BASH_KEY = "orchestra.disallowAgentBash";

function shouldDisallowAgentBash(config: SessionConfig): boolean {
  if (DISALLOW_BASH_ENV === "1" || DISALLOW_BASH_ENV === "true") {
    return true;
  }
  const m = config.metadata;
  if (m && typeof m === "object" && m[METADATA_DISALLOW_BASH_KEY] === true) {
    return true;
  }
  return false;
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

export class ClaudeCliAdapter implements AIProviderAdapter {
  readonly provider = "claude-cli" as const;
  readonly category = "local-agent" as const;
  readonly capabilities: ToolCapabilities = localAgentCapabilities;

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

  createTurnProcess(config: SessionConfig, _prompt: string): ChildProcessWithoutNullStreams {
    const args: string[] = ["-p", "--output-format", "stream-json", "--include-partial-messages"];
    if (config.modelId && config.modelId !== "claude-cli") {
      args.push("--model", config.modelId);
    }
    args.push(...(config.args ?? []));
    if (!hasFlag(args, "--verbose")) {
      args.push("--verbose");
    }
    if (shouldDisallowAgentBash(config) && !hasFlag(args, "--disallowed-tools") && !hasFlag(args, "--disallowedTools")) {
      args.push("--disallowed-tools", "Bash");
    }
    return spawn("claude", args, {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      stdio: "pipe",
      shell: false,
      windowsHide: true,
    });
  }

  async stop(session: ProcessSession): Promise<void> {
    await session.terminate();
  }
}
