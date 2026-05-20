// OpenArmy Node.js module API.
// Import this when using OpenArmy programmatically from another Node.js process or package.
//
// Usage:
//   import { createRuntime } from "@hb_army/openarmy/node";
//
// The CLI entry (`oa` binary) is a thin adapter over the same `createRuntime` function.
// Any agent run, workspace operation, or tool call that the CLI or HTTP server can do
// is also available through this API.

export { createRuntime } from "./runtime/create-runtime.js";
export type { OpenArmyRuntimeBundle } from "./runtime/create-runtime.js";

export { AgentRuntime } from "./runtime/agent-runtime.js";
export { AgentRegistry } from "./runtime/agent-registry.js";
export { RunTracker } from "./runtime/run-tracker.js";
export { WorkspaceManager } from "./runtime/workspace-manager.js";
export { SkillRegistry } from "./runtime/skill-registry.js";
export { ModelProviderRegistry } from "./runtime/model-provider-registry.js";

export { ToolRegistry } from "./tools/tool-registry.js";
export { WorkspacePathGuard } from "./tools/workspace-path-guard.js";
export { ToolAuthorizer } from "./tools/tool-authorizer.js";
export { ToolAuditLogger } from "./tools/tool-audit-logger.js";

export { McpRegistry } from "./mcp/mcp-registry.js";
export { GatewayServer } from "./gateway/gateway-server.js";
export { Scheduler } from "./scheduler/scheduler.js";
export { HeartbeatMonitor } from "./heartbeat/heartbeat-monitor.js";

export { redactSecrets, containsSecretKey } from "./runtime/secret-redactor.js";

export type * from "./types.js";
