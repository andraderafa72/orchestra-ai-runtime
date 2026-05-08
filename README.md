# 🚀 Orchestra AI Runtime

Orchestra AI Runtime is a TypeScript runtime for orchestrating local AI models, AI agents, and conversational CLI tools through isolated process management. It is built for Node.js, does not depend on a framework, and stays out of your UI layer so you can embed it in desktop apps, IDE extensions, terminals, or automation workflows.

It supports streaming, persistent sessions, process lifecycle management, multi-provider orchestration, and extensible adapters.

---

## ✨ Vision

Modern AI tooling is fragmented. Some tools expose local models, others expose conversational CLIs, coding agents, persistent sessions, or autonomous workflows. They all behave differently, which makes integration expensive and repetitive.

Orchestra provides a single runtime abstraction layer that can sit in front of tools like Ollama, Claude CLI, Cursor CLI, llama.cpp, aider, OpenInterpreter, and LM Studio.

---

## 🧰 Requirements

| Item | Requirement |
| --- | --- |
| Runtime | Node.js 20 or newer |
| Provider | At least one supported provider CLI installed locally |

---

## 📦 Installation

```bash
npm install orchestra-ai-runtime
```

---

## ⚙️ Core Features

| Capability | What it gives you |
| --- | --- |
| Multi-provider runtime | One abstraction over local models and agent CLIs |
| Streaming | Token-by-token output instead of waiting for the full response |
| Sessions | Persistent conversational state per process |
| Lifecycle management | Safe startup, shutdown, and cleanup |
| Registry | Internal tracking of every active session |
| Typing | Strong TypeScript support across public APIs |
| Extensibility | Adapter-based integration with new providers |
| Isolation | No UI coupling and no framework dependency |

---

## 🤝 Supported Providers

The package ships with built-in adapters for `ollama`, `claude-cli`, and `cursor-cli`. It also documents the broader provider landscape so you can quickly see what is available today and what is still planned.

| Provider | Type | Status | Notes |
| --- | --- | --- | --- |
| `ollama` | Local model | Available | Requires `modelId` |
| `claude-cli` | Local agent | Available | Uses the local `claude` command |
| `cursor-cli` | Local agent | Available | Defaults to `cursor-agent`, falls back to `cursor agent` |
| `llama.cpp` | Local model | Planned | Roadmap item |
| `LM Studio` | Local model | Planned | Roadmap item |
| `aider` | Local agent | Planned | Roadmap item |
| `OpenInterpreter` | Local agent | Planned | Roadmap item |

---

## 🧭 Philosophy

The application should always remain the source of truth. Orchestra handles the runtime concerns: processes, sessions, streaming, and orchestration, while your app keeps control of conversations, persistence, UI, and business logic.

---

## 🏗️ Architecture

```txt
UI / Application
        ↓
Orchestra Runtime
        ↓
Provider Adapter
        ↓
CLI Process
        ↓
AI Provider
```

---

## 🧩 Main Components

### `LocalAIProviderRuntime`

| Responsibility | Description |
| --- | --- |
| Provider discovery | Detects which adapters are installed |
| Model discovery | Loads the models exposed by installed providers |
| Session lifecycle | Creates, tracks, and destroys sessions |
| Process registry | Keeps an internal registry of active sessions |
| Global shutdown | Tears down all sessions cleanly |

---

### `ProcessSession`

Represents a single conversational process and owns the full conversation lifecycle.

| Responsibility | Description |
| --- | --- |
| I/O | Manages stdin and stdout for the child process |
| Streaming | Emits tokens as they arrive |
| State | Tracks status, timestamps, and messages |
| Cleanup | Flushes buffered output and closes the process safely |

---

### Provider Adapters

Each provider is isolated behind a standardized interface, so adapters can differ internally while exposing the same runtime contract.

| Adapter | Purpose |
| --- | --- |
| `OllamaAdapter` | Runs local model sessions through Ollama |
| `ClaudeCliAdapter` | Streams conversations through the Claude CLI |
| `CursorCliAdapter` | Streams conversations through the Cursor CLI |

---

## ⚡ Quick Start

```ts
import {
  localAIProviderRuntime
} from "orchestra-ai-runtime";

await localAIProviderRuntime.initialize();

const session =
  await localAIProviderRuntime.createSession({
    provider: "ollama",
    modelId: "llama3"
  });

session.on("token", ({ token }) => {
  process.stdout.write(token);
});

await session.send(
  "Explain event-driven architecture"
);

await localAIProviderRuntime.shutdown();
```

---

## 🧾 Session Configuration

`createSession()` accepts a `SessionConfig` object. The table below covers the fields you will use most often.

| Field | Meaning |
| --- | --- |
| `provider` | Required provider id such as `ollama`, `claude-cli`, or `cursor-cli` |
| `modelId` | Required for Ollama sessions, optional for CLI-based agents |
| `cwd` | Working directory for the child process |
| `env` | Extra environment variables passed to the child process |
| `systemPrompt` | Prepends guidance to the in-memory conversation history |
| `messages` | Seeds the session with initial conversation history |
| `args` | Forwards extra CLI arguments to the provider process |
| `killTimeoutMs` | Controls how long to wait before falling back to `SIGKILL` |
| `responseIdleMs` | Sets the idle window used to flush buffered assistant output |

`initialize()` is recommended before creating sessions because it detects installed providers and loads available models.

---

## 🌊 Streaming

Orchestra supports real-time streaming from `stdout`, and surfaces `stderr` as `error` events. There is no polling and no buffering until the process completes, which makes it a good fit for chat interfaces, IDE assistants, terminal UIs, and agent systems.

---

## 📣 Events

Orchestra is built on Node.js `EventEmitter`. Runtime-level events tell you when discovery or session state changes, while session-level events let you react to the stream itself.

| Scope | Events |
| --- | --- |
| Runtime | `providersChanged`, `modelsChanged`, `sessionCreated`, `sessionDestroyed`, `shutdown` |
| Session | `token`, `message`, `error`, `started`, `closed`, `exit`, `statusChanged` |

`token` delivers raw streamed chunks after ANSI cleanup, while `message` emits a buffered assistant message once the response has gone idle.

---

## 🛡️ Process Lifecycle Management

Orchestra safely manages process creation, cleanup, shutdown, `SIGTERM`, and `SIGKILL` fallback so you do not have to deal with zombie child processes manually. All sessions are registered internally, and `shutdown()` should be called on process exit to terminate anything still running.

---

## 📝 Provider Notes

| Provider | Behavior |
| --- | --- |
| `ollama` | Requires `modelId` and launches `ollama run <modelId>` |
| `claude-cli` | Calls the local `claude` command and forwards `args` unchanged |
| `cursor-cli` | Prefers `cursor-agent`, and falls back to `cursor agent` when needed |
| Cursor CLI path | Set `ORCHESTRA_CURSOR_CLI_COMMAND` if your binary name is different |

---

## 💡 Why Orchestra Exists

Most AI CLIs are inconsistent, stateful, hard to automate, difficult to integrate, and tightly coupled to terminal usage. Orchestra transforms that mess into a unified programmable runtime.

---

## 🎯 Use Cases

### 🖥️ AI Desktop Applications

Orchestra works well when you want a local AI assistant embedded in Electron, Tauri, or another desktop shell. The runtime owns the child process, while your UI only reacts to session events.

```ts
import { localAIProviderRuntime } from "orchestra-ai-runtime";

await localAIProviderRuntime.initialize();

const session = await localAIProviderRuntime.createSession({
  provider: "ollama",
  modelId: "llama3",
  cwd: "/home/user/projects/demo",
});

session.on("token", ({ token }) => {
  process.stdout.write(token);
});

await session.send("Explique este projeto em poucas linhas.");
```

### 🧑‍💻 IDE Integrations

For IDEs, Orchestra lets you forward the active file context into a CLI agent and stream the response back into the editor. This is useful for code review, refactoring, or inline assistance.

```ts
import { localAIProviderRuntime } from "orchestra-ai-runtime";

const insertText = (value: string) => {
  // Replace this with your editor integration.
  process.stdout.write(value);
};

const session = await localAIProviderRuntime.createSession({
  provider: "claude-cli",
  cwd: "/workspace/app",
  args: ["--print"],
  systemPrompt: "You are helping with a TypeScript code review.",
});

session.on("token", ({ token }) => {
  insertText(token);
});

await session.send(
  "Review the current file and point out any unsafe async patterns."
);
```

### 🤖 AI Agent Systems

Use Orchestra when you need persistent sessions for autonomous agents or multi-step workflows. The runtime keeps the process alive, so the agent can continue a conversation across turns.

```ts
import { localAIProviderRuntime } from "orchestra-ai-runtime";

const session = await localAIProviderRuntime.createSession({
  provider: "cursor-cli",
  args: ["--model", "auto"],
  systemPrompt: "Act as a coding agent. Ask before making destructive changes.",
});

await session.send("Inspect the repository and suggest the next implementation step.");
```

### 💬 AI Chat Platforms

If you are building a chat product, Orchestra gives you a streaming session model that maps cleanly to message bubbles, typing indicators, and persistent chat history.

```ts
import { localAIProviderRuntime } from "orchestra-ai-runtime";

const transcript: string[] = [];

const session = await localAIProviderRuntime.createSession({
  provider: "ollama",
  modelId: "llama3",
  messages: [
    { role: "user", content: "What is event-driven architecture?", createdAt: Date.now() },
  ],
});

session.on("message", ({ message }) => {
  transcript.push(`${message.role}: ${message.content}`);
});

await session.send("Give me a concrete example for a web app.");
```

### ⌨️ Terminal Applications

For terminal tools, Orchestra can act as the bridge between your CLI and the provider process. You get streaming output without polling or custom process management.

```ts
import { localAIProviderRuntime } from "orchestra-ai-runtime";

const session = await localAIProviderRuntime.createSession({
  provider: "claude-cli",
});

session.on("token", ({ token }) => {
  process.stdout.write(token);
});

await session.send("Summarize the current folder structure.");
```

### ⚙️ Automation Systems

You can also use Orchestra inside scripts and CI workflows when you need AI-assisted automation with predictable process handling.

```ts
import { localAIProviderRuntime } from "orchestra-ai-runtime";

const session = await localAIProviderRuntime.createSession({
  provider: "cursor-cli",
  cwd: process.cwd(),
  systemPrompt: "Return concise output only.",
});

await session.send("Check the repository for obvious documentation gaps.");
```

---

## ✅ Goals

| Goal | Outcome |
| --- | --- |
| Unified abstraction | One runtime for many AI CLIs and local models |
| Reliable orchestration | Predictable process and session management |
| Streaming-first design | Immediate token delivery to the UI or terminal |
| Extensibility | New providers can be added via adapters |
| Independence | No framework lock-in |
| Maintainability | A small, explicit runtime surface |

---

## 🚫 Non-Goals

Orchestra is not a UI framework, an LLM SDK wrapper, a prompt framework, or a workflow engine. It is a runtime orchestration layer, and that scope stays intentionally narrow.

---

## 🗺️ Roadmap

### Planned Providers

| Provider | Status |
| --- | --- |
| `llama.cpp` | Planned |
| `LM Studio` | Planned |
| `aider` | Planned |
| `OpenInterpreter` | Planned |
| `Gemini CLI` | Planned |

### Planned Features

| Feature | Status |
| --- | --- |
| Structured outputs | Planned |
| Tool calling abstraction | Planned |
| MCP support | Planned |
| Multi-agent orchestration | Planned |
| Provider capability negotiation | Planned |
| Session persistence adapters | Planned |
| Remote runtimes | Planned |
| WebSocket bridge | Planned |
| Distributed agents | Planned |

---

## 🤝 Contributing

Contributions are welcome, especially when they improve adapters, provider integrations, lifecycle management, streaming parsers, or process stability.

---

## 📄 License

MIT
