import path from "path";
import { randomUUID } from "crypto";
import { JsonObject, RunWorkspace } from "../types.js";
import { appendJsonLine } from "../runtime/json-store.js";

export class ToolAuditLogger {
  append(workspace: RunWorkspace, event: string, metadata: JsonObject): void {
    appendJsonLine(path.join(workspace.logsPath, "audit.jsonl"), {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      event,
      metadata,
    });
  }

  appendDenied(workspace: RunWorkspace, toolName: string, agentId: string, reason: string): void {
    this.append(workspace, "tool.denied", { toolName, agentId, reason });
  }
}
