import type { AIProviderAdapter, AIProviderType } from "../types/index.js";
import { OllamaAdapter } from "../adapters/ollamaAdapter.js";
import { ClaudeCliAdapter } from "../adapters/claudeCliAdapter.js";
import { CursorCliAdapter } from "../adapters/cursorCliAdapter.js";

export class ProvidersRegistry {
  private readonly adapters = new Map<AIProviderType, AIProviderAdapter>();

  constructor(adapters: AIProviderAdapter[] = []) {
    for (const adapter of adapters) {
      this.register(adapter);
    }
  }

  register(adapter: AIProviderAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  unregister(provider: AIProviderType): boolean {
    return this.adapters.delete(provider);
  }

  get(provider: AIProviderType): AIProviderAdapter | undefined {
    return this.adapters.get(provider);
  }

  has(provider: AIProviderType): boolean {
    return this.adapters.has(provider);
  }

  list(): AIProviderAdapter[] {
    return [...this.adapters.values()];
  }
}

export function createDefaultProvidersRegistry(): ProvidersRegistry {
  return new ProvidersRegistry([
    new OllamaAdapter(),
    new ClaudeCliAdapter(),
    new CursorCliAdapter(),
  ]);
}
