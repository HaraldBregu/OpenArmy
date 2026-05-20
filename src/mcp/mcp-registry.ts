import path from "path";
import { McpServerConfig } from "../types.js";
import { notFound, validationError } from "../runtime/errors.js";
import { ensureDir, readJsonFile, writeJsonFile } from "../runtime/json-store.js";

export class McpRegistry {
  private readonly servers = new Map<string, McpServerConfig>();
  private readonly storePath: string;

  constructor(workspaceRoot: string, initial: McpServerConfig[] = []) {
    this.storePath = path.join(workspaceRoot, "registry", "mcp-servers.json");
    this.load();
    for (const server of initial) {
      this.register(server);
    }
  }

  list(): McpServerConfig[] {
    return [...this.servers.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  get(id: string): McpServerConfig {
    const server = this.servers.get(id);
    if (!server) {
      throw notFound("MCP server", id);
    }
    return server;
  }

  register(config: McpServerConfig): McpServerConfig {
    this.validate(config);
    this.servers.set(config.id, config);
    this.persist();
    return config;
  }

  update(id: string, patch: Partial<McpServerConfig>): McpServerConfig {
    const current = this.get(id);
    const next: McpServerConfig = { ...current, ...patch, id: current.id };
    this.validate(next);
    this.servers.set(id, next);
    this.persist();
    return next;
  }

  remove(id: string): void {
    this.get(id);
    this.servers.delete(id);
    this.persist();
  }

  private validate(config: McpServerConfig): void {
    if (!config.id?.trim()) {
      throw validationError("MCP server id is required");
    }
    if (!config.name?.trim()) {
      throw validationError("MCP server name is required");
    }
    if (config.transport !== "stdio" && config.transport !== "http") {
      throw validationError("MCP transport must be stdio or http");
    }
    if (config.transport === "stdio" && !config.command?.trim()) {
      throw validationError("MCP stdio server requires a command");
    }
    if (config.transport === "http" && !config.url?.trim()) {
      throw validationError("MCP http server requires a url");
    }
  }

  private load(): void {
    ensureDir(path.dirname(this.storePath));
    const saved = readJsonFile<McpServerConfig[]>(this.storePath, []);
    for (const server of saved) {
      this.servers.set(server.id, server);
    }
  }

  private persist(): void {
    writeJsonFile(this.storePath, [...this.servers.values()]);
  }
}
