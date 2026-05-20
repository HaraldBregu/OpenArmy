import path from "path";
import { randomUUID } from "crypto";
import { AgentDefinition, AgentSchedule, SchedulerEvent } from "../types.js";
import { AgentRegistry } from "../runtime/agent-registry.js";
import { AgentRuntime } from "../runtime/agent-runtime.js";
import { RunTracker } from "../runtime/run-tracker.js";
import { appendJsonLine, readJsonLines } from "../runtime/json-store.js";
import { validationError } from "../runtime/errors.js";

const FIELD_RANGES = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
] as const;

export class Scheduler {
  private timer?: NodeJS.Timeout;
  private readonly lastTriggeredMinute = new Map<string, string>();
  private readonly historyPath: string;

  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly runTracker: RunTracker,
    private readonly runtime: AgentRuntime,
    workspaceRoot: string,
  ) {
    this.historyPath = path.join(workspaceRoot, "scheduler", "history.jsonl");
  }

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.triggerDue(new Date());
    }, 60_000);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async triggerDue(date: Date): Promise<SchedulerEvent[]> {
    const events: SchedulerEvent[] = [];
    for (const agent of this.agentRegistry.list()) {
      if (!agent.schedule?.enabled || agent.status !== "enabled") {
        continue;
      }

      this.validate(agent.schedule);
      if (!this.matches(date, agent.schedule)) {
        continue;
      }

      const minuteKey = `${agent.id}:${date.toISOString().slice(0, 16)}`;
      if (this.lastTriggeredMinute.get(agent.id) === minuteKey) {
        continue;
      }
      this.lastTriggeredMinute.set(agent.id, minuteKey);

      if (!agent.schedule.allowOverlap && this.runTracker.listActiveByAgent(agent.id).length > 0) {
        events.push(this.record(agent, "skipped", undefined, "Skipped because an active run already exists"));
        continue;
      }

      try {
        const run = await this.runtime.startRun(agent.id, {
          trigger: "schedule",
          scheduledAt: date.toISOString(),
        });
        events.push(this.record(agent, "successful", run.id, "Scheduled run started"));
      } catch (error) {
        events.push(
          this.record(
            agent,
            "failed",
            undefined,
            error instanceof Error ? error.message : "Unknown scheduler error",
          ),
        );
      }
    }

    return events;
  }

  history(): SchedulerEvent[] {
    return readJsonLines<SchedulerEvent>(this.historyPath);
  }

  validate(schedule: AgentSchedule): void {
    const fields = schedule.cron.trim().split(/\s+/);
    if (fields.length !== 5) {
      throw validationError("cron expression must have five fields");
    }

    fields.forEach((field, index) => {
      const [min, max] = FIELD_RANGES[index];
      for (const part of field.split(",")) {
        this.validatePart(part, min, max);
      }
    });

    try {
      new Intl.DateTimeFormat("en-US", { timeZone: schedule.timezone }).format(new Date());
    } catch {
      throw validationError(`invalid schedule timezone: ${schedule.timezone}`);
    }
  }

  matches(date: Date, schedule: AgentSchedule): boolean {
    this.validate(schedule);
    const parts = zonedParts(date, schedule.timezone);
    const values = [parts.minute, parts.hour, parts.day, parts.month, parts.weekday];
    return schedule.cron
      .trim()
      .split(/\s+/)
      .every((field, index) => this.fieldMatches(field, values[index]));
  }

  private record(
    agent: AgentDefinition,
    status: SchedulerEvent["status"],
    runId: string | undefined,
    message: string,
  ): SchedulerEvent {
    const event: SchedulerEvent = {
      id: randomUUID(),
      agentId: agent.id,
      cron: agent.schedule?.cron ?? "",
      status,
      runId,
      timestamp: new Date().toISOString(),
      message,
    };
    appendJsonLine(this.historyPath, event);
    return event;
  }

  private validatePart(part: string, min: number, max: number): void {
    if (part === "*") {
      return;
    }

    if (part.startsWith("*/")) {
      const step = Number(part.slice(2));
      if (!Number.isInteger(step) || step <= 0 || step > max) {
        throw validationError(`invalid cron step: ${part}`);
      }
      return;
    }

    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      if (!this.inRange(start, min, max) || !this.inRange(end, min, max) || start > end) {
        throw validationError(`invalid cron range: ${part}`);
      }
      return;
    }

    const value = Number(part);
    if (!this.inRange(value, min, max)) {
      throw validationError(`invalid cron value: ${part}`);
    }
  }

  private fieldMatches(field: string, value: number): boolean {
    if (field === "*") {
      return true;
    }

    return field.split(",").some((part) => {
      if (part.startsWith("*/")) {
        const step = Number(part.slice(2));
        return value % step === 0;
      }

      if (part.includes("-")) {
        const [start, end] = part.split("-").map(Number);
        return value >= start && value <= end;
      }

      return Number(part) === value;
    });
  }

  private inRange(value: number, min: number, max: number): boolean {
    return Number.isInteger(value) && value >= min && value <= max;
  }
}

function zonedParts(date: Date, timezone: string): {
  minute: number;
  hour: number;
  day: number;
  month: number;
  weekday: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    minute: "numeric",
    hour: "numeric",
    day: "numeric",
    month: "numeric",
    weekday: "short",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);

  return {
    minute: Number(parts.minute),
    hour: Number(parts.hour),
    day: Number(parts.day),
    month: Number(parts.month),
    weekday,
  };
}
