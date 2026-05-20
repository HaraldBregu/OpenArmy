import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { AgentDefinition, JsonObject, RunWorkspace } from "../types.js";
import { appendJsonLine, ensureDir, writeJsonFile } from "./json-store.js";
import { WorkspacePathGuard } from "../tools/workspace-path-guard.js";

export class WorkspaceManager {
  constructor(public readonly rootPath: string) {}

  initialize(): void {
    ensureDir(this.rootPath);
    ensureDir(path.join(this.rootPath, "agents"));
    ensureDir(path.join(this.rootPath, "registry"));
    ensureDir(path.join(this.rootPath, "scheduler"));
    ensureDir(path.join(this.rootPath, "skills"));
  }

  getAgentRoot(agentId: string): string {
    return path.join(this.rootPath, "agents", agentId);
  }

  getAgentConfigPath(agentId: string): string {
    return path.join(this.getAgentRoot(agentId), "config.json");
  }

  ensureAgentWorkspace(agent: AgentDefinition): string {
    const agentRoot = this.getAgentRoot(agent.id);
    ensureDir(agentRoot);
    ensureDir(path.join(agentRoot, "memory"));
    ensureDir(path.join(agentRoot, "runs"));
    return agentRoot;
  }

  prepareRunWorkspace(agent: AgentDefinition, runId: string): RunWorkspace {
    const agentRoot = this.ensureAgentWorkspace(agent);
    const runRoot = path.join(agentRoot, "runs", runId);
    const workspace: RunWorkspace = {
      agentRoot,
      memoryPath: path.join(agentRoot, "memory"),
      runRoot,
      inputPath: path.join(runRoot, "input"),
      outputPath: path.join(runRoot, "output"),
      workspacePath:
        agent.workspacePolicy.isolationMode === "agent"
          ? path.join(agentRoot, "memory", "workspace")
          : path.join(runRoot, "workspace"),
      logsPath: path.join(runRoot, "logs"),
      statePath: path.join(runRoot, "state.json"),
    };

    ensureDir(workspace.inputPath);
    ensureDir(workspace.outputPath);
    ensureDir(workspace.workspacePath);
    ensureDir(workspace.logsPath);
    writeJsonFile(workspace.statePath, {
      runId,
      agentId: agent.id,
      createdAt: new Date().toISOString(),
    });

    return workspace;
  }

  resolveInWorkspace(workspaceRoot: string, requestedPath: string): string {
    if (!requestedPath || requestedPath.includes("\0")) {
      throw validationError("path must be a non-empty string");
    }

    const resolvedRoot = path.resolve(workspaceRoot);
    const resolvedPath = path.resolve(resolvedRoot, requestedPath);
    const insideRoot =
      resolvedPath === resolvedRoot || resolvedPath.startsWith(`${resolvedRoot}${path.sep}`);

    if (!insideRoot) {
      throw forbidden("filesystem access outside the assigned workspace is not allowed");
    }

    return resolvedPath;
  }

  enforceReadLimit(filePath: string, maxBytes: number): void {
    const stats = fs.statSync(filePath);
    if (stats.size > maxBytes) {
      throw validationError(`file exceeds read limit of ${maxBytes} bytes`);
    }
  }

  enforceWriteLimit(value: string, maxBytes: number): void {
    if (Buffer.byteLength(value, "utf8") > maxBytes) {
      throw validationError(`content exceeds write limit of ${maxBytes} bytes`);
    }
  }

  appendAudit(workspace: RunWorkspace, event: string, metadata: Record<string, unknown>): void {
    appendJsonLine(path.join(workspace.logsPath, "audit.jsonl"), {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      event,
      metadata,
    });
  }
}
