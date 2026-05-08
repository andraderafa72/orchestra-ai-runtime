import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export async function runCommand(
  command: string,
  args: string[] = [],
  timeoutMs = 5_000,
): Promise<CommandResult> {
  const { stdout, stderr } = await execFileAsync(command, args, {
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8,
  });

  return {
    stdout: String(stdout ?? ""),
    stderr: String(stderr ?? ""),
  };
}

export async function commandExists(command: string, versionArgs: string[] = ["--version"]): Promise<boolean> {
  try {
    await runCommand(command, versionArgs, 3_000);
    return true;
  } catch {
    return false;
  }
}

export async function commandProducesOutput(command: string, args: string[], timeoutMs = 5_000): Promise<string> {
  const result = await runCommand(command, args, timeoutMs);
  return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
}
