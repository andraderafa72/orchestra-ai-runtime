# Orchestra AI Runtime - Complete Code Documentation

## Purpose
This document describes the internal implementation of `orchestra-ai-runtime`: project structure, type contracts, adapter operation, process control, sessions, events, and execution flow.

## Architecture Overview
The package implements an orchestration layer for local AI providers via CLI processes:

1. The application creates and initializes `LocalAIProviderRuntime`.
2. The runtime detects installed adapters and loads available models/agents.
3. The application creates a `ProcessSession` for a provider.
4. Each `send()` spawns **one** child process for that turn (stdin receives the full prompt).
5. Streaming `stdout`/`stderr` feeds events (`token`, `message`, `error`) until the child process `exit` (`stdoutFormat`: plain vs ndjson).

## Project Structure
```text
src/
  adapters/
    ollamaAdapter.ts
    claudeCliAdapter.ts
    cursorCliAdapter.ts
  runtime/
    localAIProviderRuntime.ts
    processSession.ts
    providersRegistry.ts
    capabilities.ts
  utils/
    command.ts
    output.ts
    prompts.ts
    ids.ts
    agentStreamJson.ts
  types/
    index.ts
  events/
    index.ts
  index.ts
examples/
  basic.ts
```

## Public API and Entry Point
File: `src/index.ts`

- Exports core types (`SessionConfig`, `ModelInfo`, `AIProviderAdapter`, event maps, etc.).
- Exports main classes (`LocalAIProviderRuntime`, `ProcessSession`, `ProvidersRegistry`).
- Exports built-in adapters (`OllamaAdapter`, `ClaudeCliAdapter`, `CursorCliAdapter`).
- Exports helpers (`buildConversationPrompt`, `cleanCliOutput`, `extractAssistantTextChunk`, etc.).
- Exports a ready-to-use singleton: `localAIProviderRuntime`.

## Internal Types and Contracts
File: `src/types/index.ts`

### Main Types
- `AIProviderType`: textual identifier for provider (e.g.: `ollama`, `claude-cli`, `cursor-cli`).
- `AIProviderCategory`: differentiates `local-model` and `local-agent`.
- `ToolCapabilities`: matrix of capabilities; includes `stdoutFormat` (`plain` | `ndjson`) for stdout parsing per turn.
- `ModelInfo`: metadata for detected models/agents.
- `ChatMessage`: conversation history item (`system`, `user`, `assistant`).
- `SessionStatus`: `idle`, `running`, `closed`, `error`.
- `SessionConfig`: session configuration (provider, modelId, cwd, env, args, timeouts, initial messages).

### Adapter Contract
`AIProviderAdapter` defines the mandatory contract for any integration:
- `isInstalled()`: validates local availability.
- `getAvailableModels()`: lists detectable models/agents.
- `createTurnProcess(config, prompt)`: spawns **one** subprocess for the turn (CLI-specific flags/argv); `ProcessSession` writes the full `prompt` to stdin and calls `end()`.
- `stop(session)`: ends the session (`terminate` -> `close`).

`capabilities.stdoutFormat`:
- `plain`: stdout chunks processed by `cleanToken`; final text consolidated on `exit` (Ollama).
- `ndjson`: JSON lines, `extractAssistantTextChunk` per line (Claude/Cursor with `-p` stream-json).

All built-in adapters use an **ephemeral** cycle: there is no live process between consecutive `send()` calls.

## Provider Registry and Discovery
File: `src/runtime/providersRegistry.ts`

### `ProvidersRegistry`
- Maintains internal map `provider -> adapter`.
- Allows dynamic registration/unregistration of adapters.
- Exposes `get`, `has`, and `list`.

### Default Registry
`createDefaultProvidersRegistry()` registers by default:
- `OllamaAdapter`
- `ClaudeCliAdapter`
- `CursorCliAdapter`

## Main Runtime
File: `src/runtime/localAIProviderRuntime.ts`

### Responsibilities
- Discovery of installed providers (`detectInstalledProviders`).
- Discovery of available models/agents (`loadAvailableModels`).
- Session creation and destruction (`createSession` returns `ProcessSession | null`; on failure emits `error` with `session: null`, `destroySession`).
- Global shutdown (`shutdown`).
- Re-emission of session events in the runtime scope (`bindSession`).

### Internal State
- `selectedProvider`: default active provider.
- `availableProviders`: adapters detected on host.
- `availableModels`: detected models/agents.
- `sessions`: map of sessions by ID.
- `providersRegistry`: injectable registry of adapters.

### Errors
- Failures in adapter `isInstalled` / `getAvailableModels` emit `error` with `session: null` and continue with the remaining providers.
- `initialize()` wraps discovery in `try/catch` and emits `error` if anything unexpected escapes.
- `ProcessSession.send` and `start` never throw: they emit `error` with `session: this` (and revert the last `user` on spawn failure).

### Initialization Flow
`initialize()` does:
1. `detectInstalledProviders()`
2. `loadAvailableModels()`

`providersChanged` and `modelsChanged` are emitted after state updates.

## Session and Process Control
File: `src/runtime/processSession.ts`

### Session Responsibilities
- Per turn: spawn via `adapter.createTurnProcess`, write stdin, interpret stdout according to `stdoutFormat`.
- Control session state (`idle/running/error/closed`).
- Emit `token` during streaming and `message` when consolidating the response at the child process `exit` (no idle timer).
- `terminate`/`close` for shutdown or explicit destruction.

### Session Start
`start()`:
- Does not create a process; on first call emits `started` (compatible with `LocalAIProviderRuntime.createSession` which calls `start()`).

### Sending Messages
`send(input)`:
- Ignores empty input; if session is closed or a subprocess is active (`busy`), emits `error` and returns (does not throw).
- Adds `user` message, builds `buildConversationPrompt`, calls `createTurnProcess`.
- If `createTurnProcess` fails: removes last `user`, returns to `idle`, emits `error`, returns.
- Dispatches to `bindNdjsonTurn` or `bindPlainTextTurn` according to `stdoutFormat`.
- On child `exit`: emits `message` if there's text, `exit`, sets status to `idle` or `error` if code != 0; **does not** emit `closed`.

### Errors and stderr
- stderr is accumulated; operational failure is mainly on exit code != 0 or spawn/stdin error.

### Safe Termination and Killing
`terminate(signal = "SIGTERM")`:
1. If there's no active process, closes session (`closed`).
2. Otherwise sends signal, waits for `exit`, then calls `close()`.

The `exit` event after normal turn **does not** call `close()`; `terminate`/`destroySession` do.

## Adapter Operation

## `OllamaAdapter`
File: `src/adapters/ollamaAdapter.ts`

- Category: `local-model`; `stdoutFormat: plain`.
- Detects installation with `ollama --version`.
- Discovers models with `ollama list` and line parser.
- `createTurnProcess`: `ollama run <modelId> [...args]`.
- Requires `config.modelId` (explicit error if missing).

## `ClaudeCliAdapter`
File: `src/adapters/claudeCliAdapter.ts`

- Category: `local-agent`; `stdoutFormat: ndjson`.
- Detects installation with `claude --version`.
- `createTurnProcess`: `claude -p --output-format stream-json --include-partial-messages`, optionally `--model`, then `config.args`.

## `CursorCliAdapter`
File: `src/adapters/cursorCliAdapter.ts`

- Category: `local-agent`; `stdoutFormat: ndjson`.
- Resolves command: `ORCHESTRA_CURSOR_CLI_COMMAND`, `cursor-agent`, `cursor`.
- `createTurnProcess`: `-p --output-format stream-json --stream-partial-output`, injects `agent` when the binary is `cursor`; `--model` if `modelId` is not the `cursor-agent` placeholder.

## Utility Layer

## System Commands
File: `src/utils/command.ts`

- `runCommand`: wrapper over `execFile` with timeout and max buffer.
- `commandExists`: checks if command is available on host.
- `commandProducesOutput`: collects `stdout + stderr` from discovery commands.

## Output Cleaning
File: `src/utils/output.ts`

- Removes ANSI, carriage return artifacts, spinners, and leftover prompts.
- Normalizes line breaks.
- `cleanToken` returns:
  - `raw`: raw content
  - `cleaned`: processed content for streaming and persistence

## Prompt Construction
File: `src/utils/prompts.ts`

- Normalizes history (`normalizeMessages`).
- Serializes conversation in labeled format:
  - `System: ...`
  - `User: ...`
  - `Assistant: ...`
- Always ends with `Assistant:` to guide response continuity.

## Agent JSON Streams
File: `src/utils/agentStreamJson.ts`

- Function `extractAssistantTextChunk`: tries to extract text/deltas from objects emitted by CLIs using `--output-format stream-json` (formats may vary by version).

## Event Model
Files: `src/types/index.ts`

### Session Events
- `token`, `message`, `error`, `started`, `closed`, `exit`, `statusChanged`

### Runtime Events
- Re-emits session events.
- Adds orchestration events: `providersChanged`, `modelsChanged`, `sessionCreated`, `sessionDestroyed`, `shutdown`.

## Full Execution Flow

1. App instantiates runtime.
2. App calls `initialize()`.
3. Runtime detects installed adapters.
4. Runtime collects available models/agents.
5. App creates session via `createSession(config)`.
6. Session calls `start()` (emits `started` without spawning a process).
7. App sends prompt with `session.send(...)`.
8. Session streams tokens (`token`) and consolidates message (`message`) when the turn’s subprocess ends.
9. App destroys session (`destroySession`) or shuts down runtime (`shutdown`).
10. Runtime ensures cleanup of processes and session map.

## Official Example in the Repository
File: `examples/basic.ts`

- Bootstraps the runtime.
- Listens to `token` and `error`.
- Calls `initialize` and selects the first detected model.
- Creates a session and sends a test prompt.
- Runs `shutdown` after a timeout.

## Integration Best Practices
- Always call `initialize()` before creating sessions.
- Always call `shutdown()` when closing the application.
- Handle `error` and `exit` for operational resilience.
- Configure `killTimeoutMs` in scenarios with CLIs that are slow to terminate.
- Preserve history in the app when needed for audit or replay.

## Extending with New Providers
To add a new provider:
1. Implement `AIProviderAdapter`.
2. Define capabilities and category.
3. Implement discovery (`isInstalled`, `getAvailableModels`).
4. Implement `createTurnProcess` (per-turn spawn) and a `stdoutFormat` consistent with the CLI.
5. Register the adapter in the runtime (`registerProvider`) or in the default registry.

## Intended Package Limits
- Not a UI framework.
- Does not implement complex agent/workflow managers.
- Does not replace HTTP SDKs for remote LLMs.
- Strict focus: orchestration of local AI processes with streaming and session management.
