# Agentic AI Implementation Instructions

## 1. Purpose

OpenArmy should first become a minimal AI assistant runtime with only basic filesystem tools, then evolve from a CLI tool manager into an agentic AI runtime that can run configurable agents with tools, skills, isolated workspaces, model providers, an HTTP API gateway, scheduling, heartbeat monitoring, and multi-agent orchestration.

The minimal assistant should be runnable through three separate entry modules: a CLI, a Node.js module API, and an HTTP server. These entry modules should share the same core runtime implementation instead of duplicating agent execution, workspace, tool, skill, or provider logic.

This document defines the first implementation direction. Treat each section as a requirement area that can be refined into tickets, architecture docs, and code changes.

## 2. Runtime Goals

The system should implement an agent runtime that can:

- Execute one or more agents concurrently.
- Track each agent run from creation to completion.
- Give every agent an isolated workspace for reading, writing, and persisting task data.
- Run through the CLI, an importable Node.js API, or the HTTP server using the same runtime core.
- Expose agent capabilities through an HTTP API.
- Support basic filesystem tools and other configurable tool groups.
- Support built-in skills and skills installed from the command line.
- Support multiple model providers with runtime configuration.
- Support cron-based scheduling and heartbeat health checks.

## 3. Installation and Bootstrap

The system should support installation on every target machine through a bootstrap script that can be executed with `curl`.

Example installation command:

```bash
curl -fsSL https://friday.example.com/install.sh | bash
```

For local development, the project should be executable with:

```bash
npm run dev
```

Running `npm run dev` should automatically create and start the local HTTP server for the agent runtime. The local development process should only start the HTTP server.

The installation script should:

- Detect the operating system and CPU architecture.
- Install or update the OpenArmy runtime.
- Create the required local directories.
- Initialize default configuration files.
- Register bundled tools and built-in skills.
- Validate that the CLI and runtime can start successfully.

The script should be idempotent so it can be safely re-run for upgrades or repairs.

The CLI should support installing or registering additional skills with:

```bash
oa skills -a "name of skill"
```

Installed skills should be persisted in the configured skill directory and made available to agents through the same `SkillRegistry` used by the CLI, Node.js API, and HTTP server.

## 4. Core Architecture

The first architecture should include these modules:

- `RuntimeCore`: composes the shared runtime services used by every entry module.
- `CliEntrypoint`: runs the assistant and management commands from the command line.
- `NodeRuntimeModule`: exposes the assistant runtime as an importable Node.js API.
- `AgentRuntime`: creates, starts, stops, resumes, and supervises agents.
- `AgentRegistry`: stores known agent definitions, versions, status, and metadata.
- `RunTracker`: records active, completed, failed, paused, and cancelled runs.
- `WorkspaceManager`: creates isolated per-agent and per-run workspaces.
- `ToolRegistry`: registers tool groups and controls which tools an agent can use.
- `SkillRegistry`: registers skills and resolves skill instructions/assets for an agent.
- `ModelProviderRegistry`: manages configured model providers and model selection.
- `HttpServer`: exposes the HTTP API and starts automatically in local development.
- `Scheduler`: runs agents on cron schedules.
- `HeartbeatMonitor`: records liveness and detects stalled agents.

Keep these boundaries explicit so the CLI, Node.js API, HTTP API, scheduler, and future UI can all use the same runtime services. The CLI, Node.js module, and HTTP server should be thin adapters over `RuntimeCore`; they must not implement separate agent execution logic.

## 5. Agent Definition

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

## 6. Tool Implementation

The minimal assistant should ship with a controlled tool system, but the first usable implementation only needs basic filesystem tools. Tools should be called only through `ToolRegistry`, which performs registration, schema validation, permission checks, execution, and audit logging.

The first implementation should include these necessary tools:

- `fs.readFile`: read a workspace file with size limits.
- `fs.writeFile`: create or replace a workspace file.
- `fs.appendFile`: append content to a workspace file.
- `fs.applyPatch`: edit an existing workspace file with a patch.
- `fs.listDirectory`: list files and directories under the workspace.
- `fs.createDirectory`: create a directory under the workspace.
- `fs.deleteFile`: delete a workspace file.
- `fs.moveFile`: move or rename a workspace file.
- `fs.stat`: read file metadata.
- `fs.search`: search filenames or file contents under the workspace.

Each tool should define:

- Stable tool id.
- Human-readable name and description.
- Input schema.
- Output schema.
- Permission requirements.
- Whether it mutates files.
- Whether it can be used in parallel.
- Read and write size limits.
- Audit log metadata.

The first implementation should use these supporting services:

- `ToolRegistry`: stores tool definitions and executes tools by id.
- `ToolAuthorizer`: checks the current agent and run permissions before execution.
- `WorkspacePathGuard`: resolves, normalizes, and validates paths before filesystem access.
- `ToolAuditLogger`: records every mutating operation and failed authorization attempt.

Filesystem tools must not escape the assigned workspace unless an explicit administrator-level policy allows it.

Required safety rules:

- Resolve and normalize paths before access.
- Reject path traversal outside the workspace.
- Reject symlink escapes outside the workspace.
- Keep an audit log for mutating operations.
- Prefer patch-based edits for existing files.
- Enforce size limits on reads and writes.
- Redact secrets before writing logs.

Future tool groups such as shell commands, web access, image generation, browser automation, GitHub, Figma, and sub-agents should be added later as optional tool groups. They must not be available to the minimal assistant unless explicitly registered and allowed for the agent.

## 7. Skills Implementation

Skills should be reusable instruction packages that extend assistant behavior for a specific workflow or domain. Skills do not execute code by themselves; they provide instructions, references, templates, scripts, and metadata that the assistant may load during a run.

Skills can be bundled as built-in skills or installed from the command line. The CLI should support adding skills with:

```bash
oa skills -a "name of skill"
```

Built-in skills should live in the packaged runtime. Installed skills should be persisted in the configured skill directory and registered through the same `SkillRegistry` used by the CLI, Node.js API, and HTTP server.

Each skill should include:

- `skill.json`: skill id, name, version, description, permissions, and trigger metadata.
- `SKILL.md`: primary instructions.
- Optional `references/`, `scripts/`, `templates/`, or `assets/` directories.
- Required tool permissions.
- Version metadata.

The `SkillRegistry` should support:

- Listing built-in and installed skills.
- Installing or registering skills.
- Validating skill metadata.
- Enabling skills per agent.
- Resolving only the skill context needed for the current run.
- Tracking which skills were used during a run.

Skills should not bypass the tool permission model. If a skill needs filesystem, MCP, browser, GitHub, Figma, or network access, the agent must also have permission to use the matching tools.

## 8. Custom MCP

The runtime should support custom MCP servers as optional extensions. MCP configuration should be managed through the CLI and stored in local configuration so the CLI, Node.js API, and HTTP server all load the same MCP registry.

The CLI should support adding an MCP configuration with:

```bash
oa mcp -a "example"
```

An MCP entry should include:

- MCP id.
- Display name.
- Transport type, such as `stdio` or `http`.
- Command and arguments for `stdio` servers.
- URL for HTTP servers.
- Allowed environment variables or secret references.
- Working directory, when needed.
- Enabled or disabled status.
- Tool and resource permissions exposed by the MCP server.

The MCP registry should support:

- Listing configured MCP servers.
- Adding or updating MCP server definitions.
- Enabling MCP tools per agent.
- Starting and stopping MCP connections.
- Listing MCP resources and tools through the normal permission model.
- Recording MCP tool calls and resource reads in the run audit log.

Custom MCP tools should never be available globally by default. An agent must explicitly allow the MCP server or specific MCP tools before a run can use them.

## 9. Model Providers

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

## 10. HTTP API

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
- Expose heartbeat events through HTTP status and log endpoints.
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
- HTTP server host and port.
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
- HTTP API authorization.
- Rate limits for HTTP API traffic.
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

### Phase 3: HTTP API

- Add HTTP API.
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
- Should the HTTP server be built into the CLI process or run as a separate server?
- What authentication model should local development use?
- How much run history should be retained by default?
- Should scheduler state be file-based first or database-backed from the start?
