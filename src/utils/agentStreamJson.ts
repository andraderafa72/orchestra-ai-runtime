/**
 * Parses NDJSON lines from Claude Code / Cursor Agent CLIs when using
 * `-p` and `--output-format stream-json`. Schemas may vary by version; unknown shapes are ignored.
 */

function textFromContentBlocks(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  let out = "";
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (typeof b.text === "string") {
      out += b.text;
    }
  }
  return out.length > 0 ? out : null;
}

export function extractAssistantTextChunk(obj: unknown): string | null {
  if (obj === null || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  if (typeof o.delta === "string") return o.delta;

  if (o.delta && typeof o.delta === "object") {
    const d = o.delta as Record<string, unknown>;
    if (typeof d.text === "string") return d.text;
    if (typeof d.content === "string") return d.content;
    const nested = textFromContentBlocks(d.content);
    if (nested) return nested;
  }

  const t = o.type;

  if (t === "content_block_delta" && o.delta && typeof o.delta === "object") {
    const d = o.delta as Record<string, unknown>;
    if (d.type === "text_delta" && typeof d.text === "string") return d.text;
    if (typeof d.text === "string") return d.text;
  }

  if (t === "message_delta" && o.delta && typeof o.delta === "object") {
    const d = o.delta as Record<string, unknown>;
    if (typeof d.text === "string") return d.text;
  }

  if (o.message && typeof o.message === "object") {
    const msg = o.message as Record<string, unknown>;
    const fromBlocks = textFromContentBlocks(msg.content);
    if (fromBlocks) return fromBlocks;
    if (typeof msg.text === "string") return msg.text;
  }

  if (typeof o.text === "string") return o.text;
  if (typeof o.result === "string") return o.result;
  if (typeof o.output === "string") return o.output;

  const fromTop = textFromContentBlocks(o.content);
  if (fromTop) return fromTop;

  if (t === "stream_event" && o.event !== undefined) {
    return extractAssistantTextChunk(o.event);
  }

  return null;
}
