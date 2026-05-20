# OpenArmy

OpenArmy is an agentic AI runtime for configurable local agents. It provides explicit runtime services for agent definitions, run tracking, isolated workspaces, tool authorization, reusable skills, model providers, HTTP/WebSocket gateway access, scheduling, and heartbeat monitoring.

The legacy npm plugin-manager flow has been removed.

## Runtime Surface

- `AgentRuntime`: starts, cancels, pauses, resumes, supervises, and orchestrates runs.
- `AgentRegistry`: persists serializable agent definitions under `.openarmy/agents/<agent-id>/config.json`.
- `RunTracker`: records run metadata, status transitions, logs, tools, skills, providers, errors, and outputs.
- `WorkspaceManager`: creates isolated per-agent and per-run workspaces.
- `ToolRegistry`: authorizes tools per agent and per run.
- `SkillRegistry`: discovers `SKILL.md` packages from configured skill directories.
- `ModelProviderRegistry`: manages local/mock/provider configuration and model selection.
- `GatewayServer`: exposes HTTP JSON endpoints and a WebSocket event gateway.
- `Scheduler`: validates five-field cron schedules and triggers due agent runs.
- `HeartbeatMonitor`: records liveness and marks stale active runs.

## CLI

```bash
npm install
npm run build

# Initialize .openarmy and register the local starter agent
oa init

# List runtime resources
oa agents
oa runs
oa tools
oa skills
oa providers

# Run an agent
oa run local-assistant --input '{"task":"smoke"}'

# Start HTTP and WebSocket gateway
oa serve --host 127.0.0.1 --port 4737
```

During development, use `npm run dev -- <command>`.

## HTTP API

Responses use a stable JSON envelope:

```json
{ "ok": true, "data": {} }
```

Errors use:

```json
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

Initial endpoints:

- `GET /health`
- `GET /agents`
- `POST /agents`
- `GET /agents/:id`
- `PATCH /agents/:id`
- `DELETE /agents/:id`
- `POST /agents/:id/runs`
- `GET /runs`
- `GET /runs/:id`
- `POST /runs/:id/cancel`
- `GET /runs/:id/logs`
- `GET /tools`
- `GET /skills`
- `GET /providers`

Set `OPENARMY_TOKEN` to require `Authorization: Bearer <token>` or `x-openarmy-token` on management endpoints and WebSocket upgrades. `GET /health` remains public for local health checks.

## Agent Definition

```json
{
  "id": "daily-reporter",
  "name": "Daily Reporter",
  "description": "Creates a daily workspace report.",
  "provider": "local",
  "model": "local-runtime",
  "tools": [
    {
      "group": "filesystem",
      "tools": ["*"],
      "permissions": ["filesystem:read", "filesystem:write", "filesystem:delete"]
    }
  ],
  "skills": [],
  "workspacePolicy": {
    "isolationMode": "run",
    "maxBytes": 1048576
  },
  "schedule": {
    "cron": "0 8 * * *",
    "timezone": "UTC",
    "enabled": true,
    "allowOverlap": false
  },
  "heartbeat": {
    "intervalMs": 15000,
    "timeoutMs": 60000
  },
  "environment": {
    "variables": [],
    "secrets": []
  },
  "concurrency": 1
}
```

## Workspace Layout

```text
.openarmy/
  agents/
    <agent-id>/
      config.json
      memory/
      runs/
        <run-id>/
          input/
          output/
          workspace/
          logs/
          state.json
  registry/
    runs.json
  scheduler/
    history.jsonl
  skills/
```

Filesystem tools resolve and normalize paths before access, reject traversal outside the assigned run workspace, enforce read/write size limits, and write mutation audit records to `logs/audit.jsonl`.

## Development

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:smoke
```

## Current Scope

The first implementation includes the local runtime foundation, skill/tool registries, workspace-scoped filesystem tools, provider abstraction with a local provider, HTTP API, WebSocket gateway, scheduler, heartbeat monitor, and sub-agent lifecycle methods.

External model execution, shell command execution, browser/web/app integrations, provider fallback, durable queueing, and database-backed state are intentionally modeled as extension points but not yet enabled by default.
