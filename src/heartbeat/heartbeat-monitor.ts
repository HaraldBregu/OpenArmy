import { EventEmitter } from "events";
import { AgentHeartbeatPolicy, GatewayMessage } from "../types.js";

interface HeartbeatRecord {
  runId: string;
  lastBeatAt: number;
  intervalMs: number;
  timeoutMs: number;
  stale: boolean;
}

export class HeartbeatMonitor extends EventEmitter {
  private readonly records = new Map<string, HeartbeatRecord>();
  private timer?: NodeJS.Timeout;

  startRun(runId: string, policy: AgentHeartbeatPolicy): void {
    const now = Date.now();
    this.records.set(runId, {
      runId,
      lastBeatAt: now,
      intervalMs: policy.intervalMs,
      timeoutMs: policy.timeoutMs,
      stale: false,
    });
    this.emitHeartbeat(runId, false);
  }

  beat(runId: string): void {
    const record = this.records.get(runId);
    if (!record) {
      return;
    }

    record.lastBeatAt = Date.now();
    record.stale = false;
    this.emitHeartbeat(runId, false);
  }

  stopRun(runId: string): void {
    this.records.delete(runId);
  }

  snapshot(runId: string): { lastBeatAt?: string; stale: boolean } {
    const record = this.records.get(runId);
    if (!record) {
      return { stale: false };
    }

    return {
      lastBeatAt: new Date(record.lastBeatAt).toISOString(),
      stale: record.stale,
    };
  }

  scan(now = Date.now()): string[] {
    const staleRunIds: string[] = [];
    for (const record of this.records.values()) {
      const stale = now - record.lastBeatAt > record.timeoutMs;
      if (stale && !record.stale) {
        record.stale = true;
        staleRunIds.push(record.runId);
        this.emitHeartbeat(record.runId, true);
        this.emit("stale", record.runId);
      }
    }

    return staleRunIds;
  }

  start(intervalMs = 1_000): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => this.scan(), intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private emitHeartbeat(runId: string, stale: boolean): void {
    const record = this.records.get(runId);
    const message: GatewayMessage = {
      type: "heartbeat",
      runId,
      timestamp: new Date().toISOString(),
      payload: {
        stale,
        lastBeatAt: record ? new Date(record.lastBeatAt).toISOString() : null,
      },
    };

    this.emit("heartbeat", message);
  }
}
