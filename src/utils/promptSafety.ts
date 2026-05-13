/**
 * Prompt transport hygiene: Node’s `spawn` without `shell` does not invoke `/bin/sh`, but control
 * characters and NUL can still confuse terminals, CLIs, and log pipelines. Shell escape helpers
 * are for apps that build a **string** later passed to `bash -c "..."` (not used by Orchestra’s default path).
 */

/** C0 controls except TAB/LF; also DEL. Does not alter printable text or quotes. */
const UNSAFE_TRANSPORT_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizePromptTransport(text: string): string {
  return text.replace(UNSAFE_TRANSPORT_CHARS, "").replace(/\uFEFF/g, "");
}

/**
 * Escape for embedding inside a **double-quoted** POSIX shell string.
 * Use when you must build: `sh -c "claude ... \"$( ... )\""` (prefer avoid; use argv + stdin instead).
 */
export function escapeForDoubleQuotedShell(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\$/g, "\\$")
    .replace(/`/g, "\\`");
}

/**
 * Escape for embedding inside **single-quoted** POSIX shell strings (`'...'`).
 * In bash, single-quoted strings cannot contain a literal `'`; use the `'\"'\"'` idiom.
 */
export function escapeForSingleQuotedShell(text: string): string {
  return `'${text.replace(/'/g, `'\"'\"'`)}'`;
}
