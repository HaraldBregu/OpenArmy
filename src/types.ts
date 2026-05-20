export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type AgentStatus = "enabled" | "disabled";
export type RunStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "stale";

export interface AgentToolGrant {
  group: string;
  tools?: string[];
  permissions?: string[];
}

export interface AgentMcpGrant {
  serverId: string;
  tools?: string[];
  resources?: string[];
}

export interface McpServerConfig {
  id: string;
  name: string;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  env?: string[];
  workingDirectory?: string;
  enabled: boolean;
  toolPermissions: string[];
  resourcePermissions: string[];
  metadata?: JsonObject;
}

export interface WorkspacePolicy {
  isolationMode: "run" | "agent";
  maxBytes?: number;
  allowHostAccess?: boolean;
}

export interface AgentSchedule {
  cron: string;
  timezone: string;
  enabled: boolean;
  allowOverlap: boolean;
}

export interface AgentHeartbeatPolicy {
  intervalMs: number;
  timeoutMs: number;
}

export interface AgentEnvironmentPolicy {
  variables?: string[];
  secrets?: string[];
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  provider: string;
  model: string;
  tools: AgentToolGrant[];
  mcpServers?: AgentMcpGrant[];
  skills: string[];
  workspacePolicy: WorkspacePolicy;
  schedule?: AgentSchedule;
  heartbeat?: AgentHeartbeatPolicy;
  environment?: AgentEnvironmentPolicy;
  concurrency: number;
  version: string;
  status: AgentStatus;
  metadata?: JsonObject;
  createdAt: string;
  updatedAt: string;
}

export type NewAgentDefinition = Omit<
  AgentDefinition,
  "version" | "status" | "createdAt" | "updatedAt"
> &
  Partial<Pick<AgentDefinition, "version" | "status" | "createdAt" | "updatedAt">>;

export interface RunWorkspace {
  agentRoot: string;
  memoryPath: string;
  runRoot: string;
  inputPath: string;
  outputPath: string;
  workspacePath: string;
  logsPath: string;
  statePath: string;
}

export interface ToolCallRecord {
  id: string;
  toolName: string;
  group: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed" | "denied";
  mutatesFiles: boolean;
  usesNetwork: boolean;
  auditMetadata?: JsonObject;
  error?: string;
}

export interface SkillUsageRecord {
  skillId: string;
  version: string;
  loadedAt: string;
  sourcePath?: string;
}

export interface ModelProviderUsageRecord {
  providerId: string;
  model: string;
  requestId: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed";
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  error?: string;
}

export interface HeartbeatState {
  lastBeatAt?: string;
  intervalMs: number;
  timeoutMs: number;
  stale: boolean;
}

export interface RunError {
  code: string;
  message: string;
  details?: JsonObject;
}

export interface RunRecord {
  id: string;
  agentId: string;
  parentRunId?: string;
  status: RunStatus;
  currentStep?: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  input?: JsonValue;
  output?: JsonValue;
  toolCalls: ToolCallRecord[];
  skillUsage: SkillUsageRecord[];
  modelProviderUsage: ModelProviderUsageRecord[];
  workspacePath: string;
  heartbeat: HeartbeatState;
  error?: RunError;
}

export interface RunLogEntry {
  id: string;
  runId: string;
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  event: string;
  message: string;
  metadata?: JsonObject;
}

export interface ToolSchema {
  type: string;
  properties?: Record<string, ToolSchema>;
  required?: string[];
  items?: ToolSchema;
  additionalProperties?: boolean;
  description?: string;
}

export interface ToolDefinition {
  name: string;
  group: string;
  description: string;
  inputSchema: ToolSchema;
  outputSchema: ToolSchema;
  permissionRequirements: string[];
  mutatesFiles: boolean;
  usesNetwork: boolean;
  longRunning: boolean;
  parallelSafe: boolean;
  audit: {
    event: string;
    category: string;
  };
}

export interface ToolGroupDefinition {
  name: string;
  description: string;
  implemented: boolean;
  tools: ToolDefinition[];
}

export interface ToolExecutionContext {
  agent: AgentDefinition;
  run: RunRecord;
  workspace: RunWorkspace;
}

export type ToolHandler = (
  input: JsonObject,
  context: ToolExecutionContext,
) => Promise<JsonValue> | JsonValue;

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  sourcePath: string;
  triggers: string[];
  requiredTools: string[];
  metadata?: JsonObject;
}

export interface LoadedSkillContext {
  definition: SkillDefinition;
  instructions: string;
  loadedAt: string;
}

export type ModelProviderType = "local" | "mock" | "openai-compatible";

export interface ModelProviderConfig {
  id: string;
  type: ModelProviderType;
  apiBaseUrl?: string;
  auth?: {
    method: "none" | "env" | "bearer";
    envVar?: string;
  };
  models: string[];
  defaultModel: string;
  rateLimits?: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
  };
  timeoutMs: number;
  retryPolicy: {
    retries: number;
    backoffMs: number;
  };
  cost?: JsonObject;
  metadata?: JsonObject;
}

export interface ModelRequest {
  run: RunRecord;
  agent: AgentDefinition;
  provider: ModelProviderConfig;
  model: string;
  input: JsonValue;
  skills: LoadedSkillContext[];
}

export interface ModelResponse {
  requestId: string;
  content: string;
  metadata?: JsonObject;
}

export interface SchedulerEvent {
  id: string;
  agentId: string;
  cron: string;
  status: "missed" | "failed" | "skipped" | "successful";
  runId?: string;
  timestamp: string;
  message?: string;
}

export interface GatewayMessage {
  type: string;
  timestamp: string;
  runId?: string;
  agentId?: string;
  correlationId?: string;
  payload: JsonValue;
}

export interface ApiEnvelope<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: JsonObject;
  };
}

export interface RuntimeConfig {
  workspaceRoot: string;
  gateway: {
    host: string;
    port: number;
    authToken?: string;
  };
  scheduler: {
    enabled: boolean;
  };
  heartbeat: AgentHeartbeatPolicy;
  skillDirectories: string[];
  providers: ModelProviderConfig[];
  mcpServers: McpServerConfig[];
  logLevel: "debug" | "info" | "warn" | "error";
  toolPermissions: AgentToolGrant[];
}
