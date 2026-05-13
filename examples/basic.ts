import { LocalAIProviderRuntime } from "../src/index.js";

const runtime = new LocalAIProviderRuntime();

runtime.on("token", ({ token }) => {
  process.stdout.write(token);
});

runtime.on("error", ({ error }) => {
  process.stderr.write(`\n${error.message}\n`);
});

await runtime.initialize();

console.log("Installed providers:", runtime.availableProviders.map((adapter) => adapter.provider));
console.log("Available models/agents:", runtime.availableModels.map((model) => model.id));

const model = runtime.availableModels[0];
if (!model) {
  console.log("No local AI provider found. Install Ollama, Claude CLI, or Cursor CLI.");
  process.exit(0);
}

const session = runtime.createSession({
  provider: model.provider,
  modelId: model.id,
  messages: [
    {
      role: "system",
      content: "You are a concise local assistant.",
      createdAt: Date.now(),
    },
  ],
});
if (!session) {
  console.error("createSession failed (provider not registered?)");
  process.exit(1);
}

session.send("Say hello in one sentence.");

setTimeout(async () => {
  await runtime.shutdown();
}, 5_000);
