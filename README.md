# Orchestra AI Runtime

A production-ready TypeScript runtime for orchestrating local AI models, AI agents, and conversational CLI tools through isolated process management.

Built for Node.js.

No framework dependencies.

No UI coupling.

Supports streaming, persistent sessions, process lifecycle management, multi-provider orchestration, and extensible adapters.

---

# Vision

Modern AI tooling is fragmented.

Some tools expose:
- local models
- conversational CLIs
- coding agents
- persistent sessions
- autonomous workflows

Each tool behaves differently:
- Ollama
- Claude CLI
- Cursor CLI
- llama.cpp
- aider
- OpenInterpreter
- LM Studio
- and many more

Orchestra provides a unified runtime abstraction layer for all of them.

---

# Core Features

- Multi-provider runtime
- Local model orchestration
- AI agent orchestration
- Persistent conversational sessions
- Streaming token support
- Child process lifecycle management
- Session registry
- Event-driven architecture
- Strong TypeScript typing
- Adapter-based extensibility
- Zero UI coupling
- Framework agnostic
- Production-ready architecture

---

# Supported Providers

## Local Models
- Ollama
- llama.cpp (planned)
- LM Studio (planned)

## Local Agents
- Claude CLI
- Cursor CLI
- aider (planned)
- OpenInterpreter (planned)

---

# Installation

```bash
npm install orchestra-ai-runtime
```

---

# Philosophy

The application should always be the source of truth.

The runtime manages:
- processes
- sessions
- streaming
- orchestration

Your application manages:
- conversations
- persistence
- UI
- business logic

---

# Architecture

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

# Main Components

## LocalAIProviderRuntime

Central runtime responsible for:
- provider discovery
- model discovery
- session lifecycle
- process registry
- global shutdown

---

## ProcessSession

Represents a single conversational process.

Handles:
- stdin/stdout
- streaming
- lifecycle
- state
- messages
- process cleanup

---

## Provider Adapters

Each provider is isolated behind a standardized interface.

Examples:
- OllamaAdapter
- ClaudeCliAdapter
- CursorCliAdapter

---

# Example

```ts
import {
  localAIProviderRuntime
} from "orchestra-ai-runtime";

await localAIProviderRuntime.initialize();

const session =
  await localAIProviderRuntime.createSession({
    provider: "ollama",
    model: "llama3"
  });

session.on("token", token => {
  process.stdout.write(token);
});

await session.send(
  "Explain event-driven architecture"
);
```

---

# Streaming

Orchestra supports real-time streaming from:
- stdout
- stderr

No polling.

No buffering until process completion.

Perfect for:
- chat interfaces
- IDE assistants
- terminal UIs
- agent systems

---

# Event System

Built entirely on Node.js native EventEmitter.

Available events:
- token
- message
- error
- started
- closed
- exit
- statusChanged

---

# Process Lifecycle Management

Orchestra safely manages:
- process creation
- process cleanup
- shutdown
- SIGTERM
- SIGKILL fallback
- zombie process prevention

All sessions are registered internally.

---

# Why Orchestra Exists

Most AI CLIs are:
- inconsistent
- stateful
- hard to automate
- difficult to integrate
- tightly coupled to terminal usage

Orchestra transforms them into a unified programmable runtime.

---

# Use Cases

## AI Desktop Applications

Build:
- Electron apps
- Tauri apps
- local copilots
- AI workspaces

---

## IDE Integrations

Integrate:
- Claude CLI
- Cursor Agent
- Ollama
- local coding assistants

Into:
- VSCode extensions
- JetBrains plugins
- custom IDEs

---

## AI Agent Systems

Create:
- autonomous agents
- multi-agent workflows
- coding agents
- orchestration pipelines

---

## AI Chat Platforms

Build:
- ChatGPT-style interfaces
- local AI chat apps
- hybrid AI workspaces

---

## Terminal Applications

Build:
- AI terminal assistants
- interactive shells
- developer copilots

---

## Automation Systems

Integrate AI into:
- CI/CD
- scripting
- developer tooling
- automation pipelines

---

# Goals

- Unified AI CLI abstraction
- Reliable process orchestration
- Streaming-first architecture
- Extensible providers
- Framework independence
- Long-term maintainability

---

# Non-Goals

Orchestra is NOT:
- a UI framework
- an LLM SDK wrapper
- a prompt framework
- a workflow engine

It is a runtime orchestration layer.

---

# Roadmap

## Planned Providers
- llama.cpp
- LM Studio
- aider
- OpenInterpreter
- Gemini CLI

## Planned Features
- structured outputs
- tool calling abstraction
- MCP support
- multi-agent orchestration
- provider capability negotiation
- session persistence adapters
- remote runtimes
- WebSocket bridge
- distributed agents

---

# Contributing

Contributions are welcome.

Especially:
- new adapters
- provider integrations
- lifecycle improvements
- streaming parsers
- process stability improvements

---

# License

MIT