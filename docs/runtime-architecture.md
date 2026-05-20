# OpenArmy Runtime Architecture

## Decision

OpenArmy is now structured as a modular local runtime rather than an npm plugin manager. The runtime uses explicit service boundaries so the CLI, HTTP API, scheduler, WebSocket gateway, and future UI can share the same behavior.

## Module Boundaries

- `src/runtime/agent-runtime.ts` coordinates lifecycle workflows and emits gateway events.
- `src/runtime/agent-registry.ts` owns serialized agent definitions.
- `src/runtime/run-tracker.ts` owns run metadata, logs, and status transitions.
- `src/runtime/workspace-manager.ts` owns workspace creation and path isolation.
- `src/tools/tool-registry.ts` owns permission checks and tool metadata.
- `src/tools/filesystem-tools.ts` implements the first workspace-scoped tool group.
- `src/runtime/skill-registry.ts` discovers and loads `SKILL.md` packages.
- `src/runtime/model-provider-registry.ts` owns model provider selection and the local provider adapter.
- `src/gateway/gateway-server.ts` exposes HTTP endpoints and WebSocket messages.
- `src/scheduler/scheduler.ts` validates cron expressions and starts scheduled runs.
- `src/heartbeat/heartbeat-monitor.ts` tracks liveness and stale runs.

## Patterns Used

- Registry pattern for agents, tools, skills, and model providers.
- Facade/service layer through `AgentRuntime`.
- Adapter-style provider boundary for future external model providers.
- Event-driven gateway updates from runtime and heartbeat events.
- Repository-like file persistence for local JSON and JSONL state.

## Security Baseline

- Agent definitions must explicitly grant tool groups, tool names, and permissions.
- Filesystem tools cannot escape the assigned workspace after path normalization.
- Mutating filesystem tools write audit events.
- Gateway management endpoints can be protected by `OPENARMY_TOKEN`.
- Logs capture metadata and avoid raw secret handling by default.

## Intentional Deferrals

- External model network calls.
- Shell execution and patch editing tools.
- Browser, GitHub, Figma, web, image, document, spreadsheet, and Photoshop tool execution.
- Persistent database state.
- Advanced cron syntax beyond common five-field expressions.
- Rate limiting middleware and production auth beyond a local bearer token.
