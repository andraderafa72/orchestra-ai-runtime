const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

const CARRIAGE_RETURN_LINE_PATTERN = /[^\n\r]*\r/g;

const SPINNER_PATTERN = /^[\s|/\\\-⠁-⣿·•●○◐◓◑◒]+$/u;

const PROMPT_PATTERNS = [
  /^\s*(?:>|❯|\$)\s*$/gm,
  /^\s*(?:Human|Assistant|User|System):\s*$/gim,
  /^\s*(?:Thinking|Working|Generating|Loading)[. ]*$/gim,
];

export function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, "");
}

export function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(CARRIAGE_RETURN_LINE_PATTERN, "");
}

export function cleanCliOutput(value: string): string {
  let output = normalizeLineEndings(stripAnsi(value));

  for (const pattern of PROMPT_PATTERNS) {
    output = output.replace(pattern, "");
  }

  output = output
    .split("\n")
    .filter((line) => !SPINNER_PATTERN.test(line.trim()))
    .join("\n");

  return output.replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n");
}

export function cleanToken(value: Buffer | string): { raw: string; cleaned: string } {
  const raw = Buffer.isBuffer(value) ? value.toString("utf8") : value;
  return { raw, cleaned: cleanCliOutput(raw) };
}
