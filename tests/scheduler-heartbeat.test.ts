import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { HeartbeatMonitor } from "../src/heartbeat/heartbeat-monitor.js";
import { createRuntime } from "../src/runtime/create-runtime.js";
import { NewAgentDefinition } from "../src/types.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("Scheduler", () => {
  it("validates and matches five-field cron expressions in the configured timezone", () => {
    const bundle = createRuntime({ workspaceRoot: tempRoot(), scheduler: { enabled: false } });
    const schedule = {
      cron: "*/5 8 * * *",
      timezone: "UTC",
      enabled: true,
      allowOverlap: false,
    };

    expect(bundle.scheduler.matches(new Date("2026-05-20T08:10:00.000Z"), schedule)).toBe(true);
    expect(bundle.scheduler.matches(new Date("2026-05-20T08:11:00.000Z"), schedule)).toBe(false);
    expect(() => bundle.scheduler.validate({ ...schedule, cron: "99 * * * *" })).toThrow(/invalid cron value/);
  });

  it("records skipped schedule history when overlap is disabled", async () => {
    const bundle = createRuntime({ workspaceRoot: tempRoot(), scheduler: { enabled: false } });
    const agent = bundle.runtime.registerAgent(agentDefinition());

    const activeRun = bundle.runtime.startRun(agent.id, { task: "already-active" });
    const events = await bundle.scheduler.triggerDue(new Date("2026-05-20T08:00:00.000Z"));

    expect(events).toMatchObject([{ status: "skipped", agentId: agent.id }]);
    expect(bundle.scheduler.history()).toHaveLength(1);
    await activeRun;
  });
});

describe("HeartbeatMonitor", () => {
  it("marks active runs stale when the heartbeat timeout is exceeded", () => {
    const monitor = new HeartbeatMonitor();
    const staleEvents: string[] = [];
    monitor.on("stale", (runId: string) => staleEvents.push(runId));

    monitor.startRun("run-1", { intervalMs: 10, timeoutMs: 50 });
    const stale = monitor.scan(Date.now() + 51);

    expect(stale).toEqual(["run-1"]);
    expect(staleEvents).toEqual(["run-1"]);
    expect(monitor.snapshot("run-1").stale).toBe(true);
  });
});

function tempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), ".openarmy-test-"));
  roots.push(root);
  return root;
}

function agentDefinition(): NewAgentDefinition {
  return {
    id: "scheduled-agent",
    name: "Scheduled Agent",
    description: "Agent used by scheduler tests",
    provider: "local",
    model: "local-runtime",
    tools: [],
    skills: [],
    workspacePolicy: {
      isolationMode: "run",
      maxBytes: 1024 * 1024,
    },
    schedule: {
      cron: "0 8 * * *",
      timezone: "UTC",
      enabled: true,
      allowOverlap: false,
    },
    heartbeat: {
      intervalMs: 1_000,
      timeoutMs: 5_000,
    },
    environment: {
      variables: [],
      secrets: [],
    },
    concurrency: 1,
  };
}
