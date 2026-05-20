import path from "path";
import { randomUUID } from "crypto";
import {
  JsonObject,
  ModelProviderUsageRecord,
  RunLogEntry,
  RunRecord,
  RunStatus,
  SkillUsageRecord,
  ToolCallRecord,
} from "../types.js";
import { notFound } from "./errors.js";
import { appendJsonLine, ensureDir, readJsonFile, readJsonLines, writeJsonFile } from "./json-store.js";

export class RunTracker {
  private readonly indexPath: string;
  private readonly runs = new Map<string, RunRecord>();

  constructor(private readonly workspaceRoot: string) {
    this.indexPath = path.join(workspaceRoot, "registry", "runs.json");
    this.load();
  }

  create(run: RunRecord): RunRecord {
    this.runs.set(run.id, run);
    this.persist();
    this.appendLog(run.id, "info", "run.created", "Run created", {
      agentId: run.agentId,
      parentRunId: run.parentRunId ?? null,
    });
    return run;
  }

  get(id: string): RunRecord {
    const run = this.runs.get(id);
    if (!run) {
      throw notFound("Run", id);
    }

    return run;
  }

  list(): RunRecord[] {
    return [...this.runs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  listByAgent(agentId: string): RunRecord[] {
    return this.list().filter((run) => run.agentId === agentId);
  }

  listActiveByAgent(agentId: string): RunRecord[] {
    return this.listByAgent(agentId).filter((run) =>
      ["queued", "running", "paused"].includes(run.status),
    );
  }

  update(id: string, updater: (run: RunRecord) => RunRecord): RunRecord {
    const current = this.get(id);
    const next = updater({
      ...current,
      toolCalls: [...current.toolCalls],
      skillUsage: [...current.skillUsage],
      modelProviderUsage: [...current.modelProviderUsage],
      heartbeat: { ...current.heartbeat },
      error: current.error ? { ...current.error } : undefined,
    });

    this.runs.set(id, { ...next, updatedAt: new Date().toISOString() });
    this.persist();
    return this.get(id);
  }

  transition(id: string, status: RunStatus, currentStep?: string): RunRecord {
    const terminal = ["completed", "failed", "cancelled", "stale"].includes(status);
    const run = this.update(id, (record) => ({
      ...record,
      status,
      currentStep: currentStep ?? record.currentStep,
      completedAt: terminal ? new Date().toISOString() : record.completedAt,
    }));

    this.appendLog(id, status === "failed" ? "error" : "info", "run.status", `Run ${status}`, {
      status,
      currentStep: run.currentStep ?? null,
    });
    return run;
  }

  setError(id: string, code: string, message: string, details?: JsonObject): RunRecord {
    return this.update(id, (record) => ({
      ...record,
      error: { code, message, details },
    }));
  }

  setOutput(id: string, output: unknown): RunRecord {
    return this.update(id, (record) => ({
      ...record,
      output: output as RunRecord["output"],
    }));
  }

  setHeartbeat(id: string, lastBeatAt: string, stale: boolean): RunRecord {
    return this.update(id, (record) => ({
      ...record,
      heartbeat: {
        ...record.heartbeat,
        lastBeatAt,
        stale,
      },
    }));
  }

  addToolCall(runId: string, call: ToolCallRecord): RunRecord {
    return this.update(runId, (run) => ({
      ...run,
      toolCalls: [...run.toolCalls, call],
    }));
  }

  updateToolCall(runId: string, callId: string, patch: Partial<ToolCallRecord>): RunRecord {
    return this.update(runId, (run) => ({
      ...run,
      toolCalls: run.toolCalls.map((call) => (call.id === callId ? { ...call, ...patch } : call)),
    }));
  }

  addSkillUsage(runId: string, usage: SkillUsageRecord): RunRecord {
    return this.update(runId, (run) => ({
      ...run,
      skillUsage: [...run.skillUsage, usage],
    }));
  }

  addProviderUsage(runId: string, usage: ModelProviderUsageRecord): RunRecord {
    return this.update(runId, (run) => ({
      ...run,
      modelProviderUsage: [...run.modelProviderUsage, usage],
    }));
  }

  updateProviderUsage(
    runId: string,
    requestId: string,
    patch: Partial<ModelProviderUsageRecord>,
  ): RunRecord {
    return this.update(runId, (run) => ({
      ...run,
      modelProviderUsage: run.modelProviderUsage.map((usage) =>
        usage.requestId === requestId ? { ...usage, ...patch } : usage,
      ),
    }));
  }

  appendLog(
    runId: string,
    level: RunLogEntry["level"],
    event: string,
    message: string,
    metadata?: JsonObject,
  ): RunLogEntry {
    const run = this.get(runId);
    const entry: RunLogEntry = {
      id: randomUUID(),
      runId,
      timestamp: new Date().toISOString(),
      level,
      event,
      message,
      metadata,
    };

    appendJsonLine(this.logPath(run), entry);
    return entry;
  }

  logs(runId: string): RunLogEntry[] {
    const run = this.get(runId);
    return readJsonLines<RunLogEntry>(this.logPath(run));
  }

  private logPath(run: RunRecord): string {
    return path.join(this.workspaceRoot, "agents", run.agentId, "runs", run.id, "logs", "events.jsonl");
  }

  private load(): void {
    ensureDir(path.dirname(this.indexPath));
    const saved = readJsonFile<RunRecord[]>(this.indexPath, []);
    for (const run of saved) {
      this.runs.set(run.id, run);
    }
  }

  private persist(): void {
    writeJsonFile(this.indexPath, [...this.runs.values()]);
  }
}
