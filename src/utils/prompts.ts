import type { ChatMessage } from "../types.js";

export function createChatMessage(role: ChatMessage["role"], content: string, createdAt = Date.now()): ChatMessage {
  return { role, content, createdAt };
}

export function normalizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter((message) => message.content.trim().length > 0)
    .map((message) => ({
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    }));
}

export function buildConversationPrompt(messages: ChatMessage[], nextInput?: string): string {
  const normalized = normalizeMessages(
    nextInput ? [...messages, createChatMessage("user", nextInput)] : messages,
  );

  return normalized
    .map((message) => {
      const label = message.role === "assistant" ? "Assistant" : message.role === "system" ? "System" : "User";
      return `${label}: ${message.content.trim()}`;
    })
    .join("\n\n")
    .concat("\n\nAssistant:");
}
