import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildConversationPrompt,
  createChatMessage,
  normalizeMessages,
} from "../dist/index.js";

test("normalizeMessages drops empty content", () => {
  const messages = normalizeMessages([
    createChatMessage("user", "  ", Date.now()),
    createChatMessage("user", "hi", Date.now()),
  ]);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].content, "hi");
});

test("buildConversationPrompt labels and trailing Assistant prompt", () => {
  const prompt = buildConversationPrompt([createChatMessage("user", "Hello", 1)]);
  assert.match(prompt, /User:\s*Hello/);
  assert.ok(prompt.endsWith("Assistant:"));
});
