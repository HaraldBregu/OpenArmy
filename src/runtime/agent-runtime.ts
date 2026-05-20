import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import {
  AgentDefinition,
  GatewayMessage,
  JsonObject,
  JsonValue,
  LoadedSkillContext,
  RunRecord,
  RunWorkspace,
} from "../types.js";
import { HeartbeatMonitor } from "../heartbeat/heartbeat-monitor.js";
import { ToolRegistry } from "../tools/tool-registry.js";
import { conflict, notFound, toErrorPayload, validationError } from "./errors.js";
import { AgentRegistry } from "./agent-registry.js";
import { ModelProviderRegistry } from "./model-provider-registry.js";
import { RunTracker } from "./run-tracker.js";
import { SkillRegistry } from "./skill-registry.js";
import { WorkspaceManager } from "./workspace-manager.js";
import { writeJsonFile } from "./json-store.js";

export interface RuntimeServices {
  agentRegistry: AgentRegistry;
  runTracker: RunTracker;
  workspaceManager: WorkspaceManager;
  toolRegistry: ToolRegistry;
  skillRegistry: SkillRegistry;
  providerRegistry: ModelProviderRegistry;
  heartbeatMonitor: HeartbeatMonitor;
  defaultHeartbeat: {
    intervalMs: number;
    timeoutMs: number;
  };
}

export class AgentRuntime extends EventEmitter {
  private readonly workspaces = new Map<string, RunWorkspace>();
  private readonly activeRuns = new Map<string, Promise<void>>();

  constructor(private readonly services: RuntimeServices) {
    super();
    this.services.heartbeatMonitor.on("heartbeat", (message: GatewayMessage) => {
      if (message.runId) {
        const lastBeatAt = (message.payload as JsonObject).lastBeatAt;
        if (typeof lastBeatAt === "string") {
          this.services.runTracker.setHeartbeat(message.runId, lastBeatAt, Boolean((message.payload as JsonObject).stale));
        }
      }
      this.emit("event", message);
    });
    this.services.heartbeatMonitor.on("stale", (runId: string) => {
      const run = this.services.runTracker.get(runId);
      if (["queued", "running", "paused"].includes(run.status)) {
        this.services.runTracker.transition(runId, "stale", "heartbeat timeout");
        this.emitRunEvent("run.stale", runId, run.agentId, { reason: "heartbeat timeout" });
      }
    });
  }

  get agentRegistry(): AgentRegistry {
    return this.services.agentRegistry;
  }

  get runTracker(): RunTracker {
    return this.services.runTracker;
  }

  get toolRegistry(): ToolRegistry {
    return this.services.toolRegistry;
  }

  get skillRegistry(): SkillRegistry {
    return this.services.skillRegistry;
  }

  get providerRegistry(): ModelProviderRegistry {
    return this.services.providerRegistry;
  }

  registerAgent(agent: Parameters<AgentRegistry["register"]>[0]): AgentDefinition {
    const registered = this.services.agentRegistry.register(agent);
    this.emitAgentEvent("agent.registered", registered.id, { version: registered.version });
    return registered;
  }

  async startRun(agentId: string, input: JsonValue = {}, options: { parentRunId?: string } = {}): Promise<RunRecord> {
    const agent = this.services.agentRegistry.get(agentId);
    if (agent.status !== "enabled") {
      throw conflict(`agent ${agentId} is disabled`);
    }

    const activeRuns = this.services.runTracker.listActiveByAgent(agentId);
    if (activeRuns.length >= agent.concurrency) {
      throw conflict(`agent ${agentId} has reached its concurrency limit of ${agent.concurrency}`);
    }

    const runId = randomUUID();
    const workspace = this.services.workspaceManager.prepareRunWorkspace(agent, runId);
    this.workspaces.set(runId, workspace);
    writeJsonFile(path.join(workspace.inputPath, "input.json"), input);

    const heartbeat = agent.heartbeat ?? this.services.defaultHeartbeat;
    const now = new Date().toISOString();
    const run: RunRecord = {
      id: runId,
      agentId: agent.id,
      parentRunId: options.parentRunId,
      status: "queued",
      currentStep: "queued",
      startedAt: now,
      updatedAt: now,
      input,
      toolCalls: [],
      skillUsage: [],
      modelProviderUsage: [],
      workspacePath: workspace.workspacePath,
      heartbeat: {
        intervalMs: heartbeat.intervalMs,
        timeoutMs: heartbeat.timeoutMs,
        stale: false,
      },
    };

    this.services.runTracker.create(run);
    this.emitRunEvent("run.created", runId, agent.id, { parentRunId: options.parentRunId ?? null });

    const promise = this.executeRun(agent, runId, input, workspace).finally(() => {
      this.activeRuns.delete(runId);
      this.services.heartbeatMonitor.stopRun(runId);
    });
    this.activeRuns.set(runId, promise);

    return this.services.runTracker.get(runId);
  }

  async waitForRun(runId: string, timeoutMs = 30_000): Promise<RunRecord> {
    const promise = this.activeRuns.get(runId);
    if (!promise) {
      return this.services.runTracker.get(runId);
    }

    const timeout = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(validationError(`timed out waiting for run ${runId}`)), timeoutMs);
      timer.unref?.();
    });

    await Promise.race([promise, timeout]);
    return this.services.runTracker.get(runId);
  }

  cancelRun(runId: string, reason = "cancelled by request"): RunRecord {
    const run = this.services.runTracker.get(runId);
    if (["completed", "failed", "cancelled", "stale"].includes(run.status)) {
      return run;
    }

    this.services.runTracker.setError(runId, "RUN_CANCELLED", reason);
    const cancelled = this.services.runTracker.transition(runId, "cancelled", "cancelled");
    this.services.heartbeatMonitor.stopRun(runId);
    this.emitRunEvent("run.cancelled", runId, run.agentId, { reason });
    return cancelled;
  }

  pauseRun(runId: string): RunRecord {
    const run = this.services.runTracker.get(runId);
    if (run.status !== "running") {
      throw conflict(`only running runs can be paused`);
    }

    const paused = this.services.runTracker.transition(runId, "paused", "paused");
    this.emitRunEvent("run.paused", runId, run.agentId, {});
    return paused;
  }

  resumeRun(runId: string): RunRecord {
    const run = this.services.runTracker.get(runId);
    if (run.status !== "paused") {
      throw conflict(`only paused runs can be resumed`);
    }

    const resumed = this.services.runTracker.transition(runId, "running", "resumed");
    this.services.heartbeatMonitor.beat(runId);
    this.emitRunEvent("run.resumed", runId, run.agentId, {});
    return resumed;
  }

  sendInput(runId: string, input: JsonValue): RunRecord {
    const run = this.services.runTracker.get(runId);
    this.services.runTracker.appendLog(runId, "info", "run.input", "Input received for run", {
      inputType: Array.isArray(input) ? "array" : typeof input,
    });
    this.emitRunEvent("run.input", runId, run.agentId, { input });
    return this.services.runTracker.get(runId);
  }

  async spawnSubAgent(parentRunId: string, agentId: string, input: JsonValue): Promise<RunRecord> {
    this.services.runTracker.get(parentRunId);
    return this.startRun(agentId, input, { parentRunId });
  }

  closeRun(runId: string): RunRecord {
    const run = this.services.runTracker.get(runId);
    if (["queued", "running", "paused"].includes(run.status)) {
      return this.cancelRun(runId, "closed by parent or client");
    }

    return run;
  }

  async callTool(runId: string, toolName: string, input: JsonObject): Promise<JsonValue> {
    const run = this.services.runTracker.get(runId);
    const agent = this.services.agentRegistry.get(run.agentId);
    const workspace = this.workspaces.get(runId) ?? this.rehydrateWorkspace(agent, run);
    const context = this.services.toolRegistry.buildContext(agent, run, workspace);
    const result = await this.services.toolRegistry.execute(toolName, input, context);
    this.services.runTracker.appendLog(runId, "info", "tool.completed", `Tool ${toolName} completed`, {
      toolName,
    });
    this.emitRunEvent("tool.completed", runId, run.agentId, { toolName });
    return result;
  }

  private async executeRun(
    agent: AgentDefinition,
    runId: string,
    input: JsonValue,
    workspace: RunWorkspace,
  ): Promise<void> {
    const heartbeat = agent.heartbeat ?? this.services.defaultHeartbeat;
    let providerUsageRequestId: string | undefined;
    this.services.heartbeatMonitor.startRun(runId, heartbeat);
    this.services.runTracker.transition(runId, "running", "loading skills");
    this.emitRunEvent("run.running", runId, agent.id, {});

    try {
      const loadedSkills = this.loadSkills(agent, runId);
      const { provider, model } = this.services.providerRegistry.select(agent);
      const providerUsage = {
        providerId: provider.id,
        model,
        requestId: randomUUID(),
        startedAt: new Date().toISOString(),
        status: "running" as const,
      };
      providerUsageRequestId = providerUsage.requestId;
      this.services.runTracker.addProviderUsage(runId, providerUsage);

      this.services.runTracker.transition(runId, "running", "model execution");
      const response = await this.services.providerRegistry.generate({
        run: this.services.runTracker.get(runId),
        agent,
        provider,
        model,
        input,
        skills: loadedSkills,
      });

      this.services.runTracker.updateProviderUsage(runId, providerUsage.requestId, {
        requestId: response.requestId,
        status: "completed",
        completedAt: new Date().toISOString(),
      });

      if (this.shouldStopExecution(runId)) {
        return;
      }

      const output = {
        content: response.content,
        metadata: response.metadata ?? {},
      };
      writeJsonFile(path.join(workspace.outputPath, "response.json"), output);
      this.services.runTracker.setOutput(runId, output);
      this.services.runTracker.transition(runId, "completed", "completed");
      this.emitRunEvent("run.completed", runId, agent.id, output);
    } catch (error) {
      const payload = toErrorPayload(error);
      if (providerUsageRequestId) {
        this.services.runTracker.updateProviderUsage(runId, providerUsageRequestId, {
          status: "failed",
          completedAt: new Date().toISOString(),
          error: payload.message,
        });
      }
      if (this.shouldStopExecution(runId)) {
        return;
      }
      this.services.runTracker.setError(runId, payload.code, payload.message, payload.details);
      this.services.runTracker.transition(runId, "failed", "failed");
      this.services.runTracker.appendLog(runId, "error", "run.failed", payload.message, {
        code: payload.code,
      });
      this.emitRunEvent("run.failed", runId, agent.id, {
        code: payload.code,
        message: payload.message,
      });
    }
  }

  private shouldStopExecution(runId: string): boolean {
    const status = this.services.runTracker.get(runId).status;
    return status === "cancelled" || status === "stale";
  }

  private loadSkills(agent: AgentDefinition, runId: string): LoadedSkillContext[] {
    const loaded: LoadedSkillContext[] = [];
    for (const skillId of agent.skills) {
      const skill = this.services.skillRegistry.load(skillId);
      loaded.push(skill);
      this.services.runTracker.addSkillUsage(runId, {
        skillId: skill.definition.id,
        version: skill.definition.version,
        loadedAt: skill.loadedAt,
        sourcePath: skill.definition.sourcePath,
      });
      this.services.runTracker.appendLog(runId, "info", "skill.loaded", `Skill ${skillId} loaded`, {
        skillId,
      });
    }

    return loaded;
  }

  private rehydrateWorkspace(agent: AgentDefinition, run: RunRecord): RunWorkspace {
    const runRoot = path.join(this.services.workspaceManager.getAgentRoot(agent.id), "runs", run.id);
    if (!fs.existsSync(runRoot)) {
      throw notFound("Run workspace", run.id);
    }

    const workspace: RunWorkspace = {
      agentRoot: this.services.workspaceManager.getAgentRoot(agent.id),
      memoryPath: path.join(this.services.workspaceManager.getAgentRoot(agent.id), "memory"),
      runRoot,
      inputPath: path.join(runRoot, "input"),
      outputPath: path.join(runRoot, "output"),
      workspacePath: run.workspacePath,
      logsPath: path.join(runRoot, "logs"),
      statePath: path.join(runRoot, "state.json"),
    };
    this.workspaces.set(run.id, workspace);
    return workspace;
  }

  private emitAgentEvent(type: string, agentId: string, payload: JsonValue): void {
    const message: GatewayMessage = {
      type,
      agentId,
      timestamp: new Date().toISOString(),
      payload,
    };
    this.emit("event", message);
  }

  private emitRunEvent(type: string, runId: string, agentId: string, payload: JsonValue): void {
    const message: GatewayMessage = {
      type,
      runId,
      agentId,
      timestamp: new Date().toISOString(),
      payload,
    };
    this.emit("event", message);
  }
}
