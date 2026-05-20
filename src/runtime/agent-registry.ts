import fs from "fs";
import path from "path";
import { AgentDefinition, NewAgentDefinition } from "../types.js";
import { notFound, validationError } from "./errors.js";
import { pathExists, readJsonFile, safeRemoveFile, writeJsonFile } from "./json-store.js";
import { WorkspaceManager } from "./workspace-manager.js";

const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,127}$/;

export class AgentRegistry {
  constructor(private readonly workspaceManager: WorkspaceManager) {}

  list(): AgentDefinition[] {
    const agentsRoot = path.join(this.workspaceManager.rootPath, "agents");
    if (!pathExists(agentsRoot)) {
      return [];
    }

    return fs
      .readdirSync(agentsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => this.workspaceManager.getAgentConfigPath(entry.name))
      .filter(pathExists)
      .map((configPath) => readJsonFile<AgentDefinition | null>(configPath, null))
      .filter((agent): agent is AgentDefinition => agent !== null)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  get(id: string): AgentDefinition {
    const configPath = this.workspaceManager.getAgentConfigPath(id);
    if (!pathExists(configPath)) {
      throw notFound("Agent", id);
    }

    return readJsonFile<AgentDefinition>(configPath, {} as AgentDefinition);
  }

  register(input: NewAgentDefinition): AgentDefinition {
    this.validateAgentInput(input);
    const now = new Date().toISOString();
    const agent: AgentDefinition = {
      ...input,
      id: this.validateId(input.id),
      version: input.version ?? "1.0.0",
      status: input.status ?? "enabled",
      createdAt: input.createdAt ?? now,
      updatedAt: now,
      concurrency: Math.max(1, input.concurrency ?? 1),
      tools: input.tools ?? [],
      skills: input.skills ?? [],
      workspacePolicy: input.workspacePolicy ?? {
        isolationMode: "run",
        maxBytes: 10 * 1024 * 1024,
      },
    };

    this.validateAgent(agent);
    this.workspaceManager.ensureAgentWorkspace(agent);
    writeJsonFile(this.workspaceManager.getAgentConfigPath(agent.id), agent);
    return agent;
  }

  update(id: string, patch: Partial<NewAgentDefinition>): AgentDefinition {
    const current = this.get(id);
    const next: AgentDefinition = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.validateAgent(next);
    writeJsonFile(this.workspaceManager.getAgentConfigPath(id), next);
    return next;
  }

  remove(id: string): void {
    this.get(id);
    safeRemoveFile(this.workspaceManager.getAgentConfigPath(id));
  }

  disable(id: string): AgentDefinition {
    return this.update(id, { status: "disabled" });
  }

  private validateId(id: string): string {
    if (!AGENT_ID_PATTERN.test(id)) {
      throw validationError("agent id must be lowercase and may contain letters, numbers, dots, dashes, or underscores");
    }

    return id;
  }

  private validateAgent(agent: AgentDefinition): void {
    this.validateId(agent.id);
    if (typeof agent.name !== "string" || !agent.name.trim()) {
      throw validationError("agent name is required");
    }
    if (typeof agent.provider !== "string" || !agent.provider.trim()) {
      throw validationError("agent provider is required");
    }
    if (typeof agent.model !== "string" || !agent.model.trim()) {
      throw validationError("agent model is required");
    }
    if (!["run", "agent"].includes(agent.workspacePolicy.isolationMode)) {
      throw validationError("workspace isolationMode must be either run or agent");
    }
    if (agent.concurrency < 1) {
      throw validationError("agent concurrency must be at least 1");
    }
    if (agent.workspacePolicy.maxBytes !== undefined && agent.workspacePolicy.maxBytes <= 0) {
      throw validationError("workspace maxBytes must be positive when provided");
    }
  }

  private validateAgentInput(input: NewAgentDefinition): void {
    if (typeof input.id !== "string") {
      throw validationError("agent id is required");
    }
    if (typeof input.name !== "string") {
      throw validationError("agent name is required");
    }
    if (typeof input.description !== "string") {
      throw validationError("agent description is required");
    }
    if (typeof input.provider !== "string") {
      throw validationError("agent provider is required");
    }
    if (typeof input.model !== "string") {
      throw validationError("agent model is required");
    }
  }
}
