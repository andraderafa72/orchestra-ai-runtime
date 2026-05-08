import { randomUUID } from "node:crypto";

export function createSessionId(prefix = "session"): string {
  return `${prefix}_${randomUUID()}`;
}
