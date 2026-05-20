# Agentic AI Implementation Instructions

## 1. Purpose

OpenArmy should evolve from a CLI tool manager into an agentic AI runtime that can run configurable agents with tools, skills, isolated workspaces, model providers, API gateways, scheduling, heartbeat monitoring, and multi-agent orchestration.

This document defines the first implementation direction. Treat each section as a requirement area that can be refined into tickets, architecture docs, and code changes.

## 2. Runtime Goals

The system should implement an agent runtime that can:

- Execute one or more agents concurrently.
- Track each agent run from creation to completion.
- Give every agent an isolated workspace for reading, writing, and persisting task data.
- Expose agent capabilities through an HTTP API and WebSocket gateway.
- Support basic filesystem tools and other configurable tool groups.
- Support reusable skills that extend agent behavior.
- Support multiple model providers with runtime configuration.
- Support cron-based scheduling and heartbeat health checks.

## 3. Core Architecture

The first architecture should include these modules:

- `AgentRuntime`: creates, starts, stops, resumes, and supervises agents.
- `AgentRegistry`: stores known agent definitions, versions, status, and metadata.
- `RunTracker`: records active, completed, failed, paused, and cancelled runs.
- `WorkspaceManager`: creates isolated per-agent and per-run workspaces.
- `ToolRegistry`: registers tool groups and controls which tools an agent can use.
- `SkillRegistry`: registers skills and resolves skill instructions/assets for an agent.
- `ModelProviderRegistry`: manages configured model providers and model selection.
- `GatewayServer`: exposes HTTP and WebSocket interfaces.
- `Scheduler`: runs agents on cron schedules.
- `HeartbeatMonitor`: records liveness and detects stalled agents.

Keep these boundaries explicit so the CLI, HTTP API, scheduler, and future UI can all use the same runtime services.

## 4. Agent Definition

An agent definition should describe what an agent is allowed to do and how it runs.

Each agent should be configurable with:

- `id`: stable unique identifier.
- `name`: human-readable name.
- `description`: short purpose statement.
- `model`: default model selection.
- `provider`: default model provider.
- `tools`: allowed tool groups and tool-level permissions.
- `skills`: enabled skills.
- `workspacePolicy`: storage limits and isolation mode.
- `schedule`: optional cron configuration.
- `heartbeat`: optional liveness interval and timeout.
- `environment`: allowed environment variables or secrets references.
- `concurrency`: max parallel runs for this agent.

Agent definitions should be serializable so they can be stored in configuration files, a local registry, or later a database.

## 5. Tool System

The agent runtime should expose tools through a controlled registry. Tools should not be called directly without permission checks.

Initial tool groups to support:

- Shell/workspace: run commands, stream stdin, and edit files with patches.
- Planning: update a task plan.
- Parallel calls: run independent shell or read actions in parallel.
- Sub-agents: spawn, message, wait for, resume, and close agents.
- MCP resources: list and read MCP-provided resources.
- Tool discovery: search deferred or plugin-provided tools.
- Web: search/open pages, click/find text, screenshots, weather, finance, sports, and time.
- Image generation: generate or edit images.
- Apps/plugins: Browser, Figma, GitHub, Documents, Presentations, Spreadsheets, Vercel plugin, and Photoshop.

Each tool should define:

- Name and description.
- Input schema.
- Output schema.
- Permission requirements.
- Whether it can mutate files, call networks, or launch long-running work.
- Whether it can be used in parallel.
- Audit log metadata.

The runtime should enforce tool authorization per agent and per run.

## 6. Basic Filesystem Tools

The first tool implementation should include basic filesystem operations scoped to the agent workspace:

- Read file.
- Write file.
- Append file.
- List directory.
- Create directory.
- Delete file.
- Move or rename file.
- Check file metadata.
- Search files.

Filesystem tools must not escape the assigned workspace unless an explicit administrator-level policy allows it.

Recommended safety rules:

- Resolve and normalize paths before access.
- Reject path traversal outside the workspace.
- Keep an audit log for mutating operations.
- Prefer patch-based edits for existing files.
- Enforce size limits on reads and writes.

## 7. Skills

Skills should be reusable instruction packages that extend agent behavior for a specific workflow or domain.

Each skill should include:

- `SKILL.md`: primary instructions.
- Optional references, scripts, templates, or assets.
- Trigger rules that describe when the skill should be used.
- Required tools or permissions.
- Version metadata.

The runtime should support:

- Listing available skills.
- Installing or registering skills.
- Enabling skills per agent.
- Loading only the skill context needed for the current run.
- Tracking which skills were used during a run.

Skills should not bypass the tool permission model. If a skill needs filesystem, browser, GitHub, Figma, or network access, the agent must also have permission to use the matching tools.

## 8. Model Providers

The system should support multiple configurable model providers.

Each provider configuration should include:

- Provider id.
- Provider type.
- API base URL.
- Authentication method.
- Available models.
- Default model.
- Rate limits.
- Timeout settings.
- Retry policy.
- Cost or usage metadata when available.

The runtime should allow agents to choose from configured providers according to policy. Provider selection can be static per agent at first, then later become dynamic based on task type, cost, latency, context length, or fallback rules.

## 9. HTTP API

The HTTP API should expose management and execution endpoints.

Initial endpoint groups:

- `GET /health`: service health.
- `GET /agents`: list registered agents.
- `POST /agents`: create or register an agent definition.
- `GET /agents/:id`: get agent details.
- `PATCH /agents/:id`: update an agent definition.
- `DELETE /agents/:id`: remove or disable an agent.
- `POST /agents/:id/runs`: start a run.
- `GET /runs`: list runs.
- `GET /runs/:id`: get run status and metadata.
- `POST /runs/:id/cancel`: cancel a run.
- `GET /runs/:id/logs`: stream or page run logs.
- `GET /tools`: list available tool groups.
- `GET /skills`: list available skills.
- `GET /providers`: list configured model providers.

HTTP responses should use structured JSON envelopes with stable error codes.

## 10. WebSocket Gateway

The WebSocket gateway should provide real-time interaction with running agents.

It should support:

- Starting an interactive agent session.
- Sending user messages to a run.
- Streaming model output.
- Streaming tool events.
- Streaming status changes.
- Receiving heartbeat events.
- Cancelling or pausing a run.
- Subscribing to run logs.

Every WebSocket message should include:

- Message type.
- Run id or agent id.
- Timestamp.
- Payload.
- Correlation id when applicable.

The gateway should validate permissions before allowing a client to subscribe to or control a run.

## 11. Isolated Agent Workspaces

Every agent run should receive an isolated workspace.

Workspace layout recommendation:

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
```

The workspace should support:

- Run-local files.
- Agent-level persistent memory.
- Structured state snapshots.
- Tool output artifacts.
- Logs and traces.

Agents can store data in their isolated workspace, but they should not have unrestricted access to other agents' workspaces.

## 12. Multi-Agent Orchestration

The runtime should support multiple agents running at the same time.

The system should track:

- Agent id.
- Run id.
- Parent run id, when spawned by another agent.
- Current status.
- Current step.
- Started at.
- Updated at.
- Completed at.
- Tool calls.
- Skill usage.
- Model provider usage.
- Workspace path.
- Error state.

Sub-agent support should allow a parent agent to:

- Spawn another agent.
- Send input to another agent.
- Wait for completion.
- Resume a paused agent.
- Close an agent.
- Read final status and outputs.

The orchestrator should enforce concurrency limits and prevent runaway agent spawning.

## 13. Scheduler

The system should include a cron scheduler for recurring agent runs.

Scheduler requirements:

- Register cron expressions per agent.
- Validate schedules before saving.
- Trigger runs at the correct time.
- Prevent duplicate overlapping runs unless allowed.
- Store schedule history.
- Record missed, failed, skipped, and successful executions.

Example schedule configuration:

```json
{
  "agentId": "daily-reporter",
  "cron": "0 8 * * *",
  "timezone": "UTC",
  "enabled": true,
  "allowOverlap": false
}
```

## 14. Heartbeat

The runtime should maintain heartbeat tracking for agents and long-running tasks.

Heartbeat requirements:

- Record heartbeat timestamp per active run.
- Mark runs as stale when the heartbeat timeout is exceeded.
- Emit heartbeat events through the WebSocket gateway.
- Expose heartbeat status through the HTTP API.
- Allow recovery logic for stalled runs.

Heartbeat state should be visible in run metadata and logs.

## 15. State, Logs, and Audit Trail

The system should persist enough data to debug and resume agent activity.

Minimum records:

- Agent definitions.
- Run metadata.
- Run status transitions.
- User inputs.
- Model requests and responses metadata.
- Tool calls and results.
- Skill load events.
- Filesystem mutations.
- Scheduler events.
- Heartbeat events.
- Errors and cancellation reasons.

Do not store raw secrets in logs.

## 16. Configuration

The runtime should support configuration from files and environment variables.

Initial configuration areas:

- Model providers.
- Default agent policies.
- Workspace root.
- Gateway host and port.
- Scheduler enabled/disabled.
- Heartbeat intervals.
- Tool permissions.
- Skill directories.
- Log level.

Configuration should be validated at startup and surfaced through clear errors.

## 17. Security Requirements

Security should be part of the first design, not an afterthought.

Required controls:

- Workspace isolation.
- Tool permission checks.
- Network access policy.
- Secret redaction in logs.
- API authentication.
- WebSocket authorization.
- Rate limits for API and gateway traffic.
- Per-agent concurrency limits.
- Audit logs for mutating operations.

Any tool that can mutate files, run commands, access the network, or call external services should require explicit permission.

## 18. Implementation Phases

### Phase 1: Local Runtime Foundation

- Add agent definitions.
- Add run tracker.
- Add isolated workspace manager.
- Add filesystem tools.
- Add basic model provider abstraction.
- Add local CLI commands for agent runs.

### Phase 2: Skills and Tool Registry

- Add skill registry.
- Add tool registry.
- Enforce per-agent tool permissions.
- Track skill and tool usage in run metadata.

### Phase 3: Gateway APIs

- Add HTTP API.
- Add WebSocket gateway.
- Stream run events and logs.
- Add structured API errors.

### Phase 4: Scheduling and Heartbeat

- Add cron scheduler.
- Add heartbeat monitor.
- Add stale-run detection.
- Add recovery or cancellation policy.

### Phase 5: Multi-Agent Orchestration

- Add sub-agent spawning.
- Track parent/child run relationships.
- Add concurrency limits.
- Add orchestration logs and status views.

### Phase 6: Provider Expansion

- Add multiple model providers.
- Add provider fallback.
- Add provider usage tracking.
- Add configurable model policies.

## 19. Open Questions

These questions should be resolved as the design improves:

- Should agent definitions live in npm plugin metadata, local config files, or a dedicated registry?
- Should workspaces be stored under the existing OpenArmy home directory or inside each project?
- Which model providers should be supported first?
- Should the HTTP/WebSocket gateway be built into the CLI process or run as a separate server?
- What authentication model should local development use?
- How much run history should be retained by default?
- Should scheduler state be file-based first or database-backed from the start?

