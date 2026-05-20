import { RuntimeConfig } from "../types.js";
import { defaultRuntimeConfig, validateRuntimeConfig } from "../config/defaults.js";
import { HeartbeatMonitor } from "../heartbeat/heartbeat-monitor.js";
import { McpRegistry } from "../mcp/mcp-registry.js";
import { Scheduler } from "../scheduler/scheduler.js";
import { registerFilesystemTools } from "../tools/filesystem-tools.js";
import { registerPlannedToolGroups, ToolRegistry } from "../tools/tool-registry.js";
import { AgentRegistry } from "./agent-registry.js";
import { AgentRuntime } from "./agent-runtime.js";
import { ModelProviderRegistry } from "./model-provider-registry.js";
import { RunTracker } from "./run-tracker.js";
import { SkillRegistry } from "./skill-registry.js";
import { WorkspaceManager } from "./workspace-manager.js";

export interface OpenArmyRuntimeBundle {
  config: RuntimeConfig;
  workspaceManager: WorkspaceManager;
  agentRegistry: AgentRegistry;
  runTracker: RunTracker;
  toolRegistry: ToolRegistry;
  skillRegistry: SkillRegistry;
  providerRegistry: ModelProviderRegistry;
  mcpRegistry: McpRegistry;
  heartbeatMonitor: HeartbeatMonitor;
  runtime: AgentRuntime;
  scheduler: Scheduler;
}

export function createRuntime(configOverrides: Partial<RuntimeConfig> = {}): OpenArmyRuntimeBundle {
  const base = defaultRuntimeConfig();
  const config = validateRuntimeConfig({
    ...base,
    ...configOverrides,
    gateway: {
      ...base.gateway,
      ...configOverrides.gateway,
    },
    scheduler: {
      ...base.scheduler,
      ...configOverrides.scheduler,
    },
    heartbeat: {
      ...base.heartbeat,
      ...configOverrides.heartbeat,
    },
    providers: configOverrides.providers ?? base.providers,
    skillDirectories: configOverrides.skillDirectories ?? base.skillDirectories,
    toolPermissions: configOverrides.toolPermissions ?? base.toolPermissions,
  });

  const workspaceManager = new WorkspaceManager(config.workspaceRoot);
  workspaceManager.initialize();

  const agentRegistry = new AgentRegistry(workspaceManager);
  const runTracker = new RunTracker(config.workspaceRoot);
  const toolRegistry = new ToolRegistry(runTracker);
  registerPlannedToolGroups(toolRegistry);
  registerFilesystemTools(toolRegistry, workspaceManager);

  const skillRegistry = new SkillRegistry(config.skillDirectories);
  skillRegistry.discover();

  const providerRegistry = new ModelProviderRegistry(config.providers);
  const mcpRegistry = new McpRegistry(config.workspaceRoot, config.mcpServers);
  const heartbeatMonitor = new HeartbeatMonitor();
  const runtime = new AgentRuntime({
    agentRegistry,
    runTracker,
    workspaceManager,
    toolRegistry,
    skillRegistry,
    providerRegistry,
    heartbeatMonitor,
    defaultHeartbeat: config.heartbeat,
  });
  const scheduler = new Scheduler(agentRegistry, runTracker, runtime, config.workspaceRoot);

  if (config.scheduler.enabled) {
    heartbeatMonitor.start();
    scheduler.start();
  }

  return {
    config,
    workspaceManager,
    agentRegistry,
    runTracker,
    toolRegistry,
    skillRegistry,
    providerRegistry,
    heartbeatMonitor,
    runtime,
    scheduler,
  };
}
