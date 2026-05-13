import assert from "node:assert/strict";
import { test } from "node:test";
import { extractAssistantTextChunk } from "../dist/index.js";

test("extractAssistantTextChunk reads string delta", () => {
  assert.equal(extractAssistantTextChunk({ delta: "x" }), "x");
});

test("extractAssistantTextChunk concatenates message content blocks", () => {
  const text = extractAssistantTextChunk({
    message: {
      content: [
        { type: "text", text: "a" },
        { text: "b" },
      ],
    },
  });
  assert.equal(text, "ab");
});
