import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { McpRegistry } from "../src/mcp/mcp-registry.js";
import { McpServerConfig } from "../src/types.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("McpRegistry", () => {
  it("registers and retrieves a stdio MCP server", () => {
    const registry = new McpRegistry(tempRoot());
    const server = registry.register(stdioServer());
    expect(registry.get(server.id)).toMatchObject({ id: "test-mcp", transport: "stdio" });
  });

  it("registers and retrieves an http MCP server", () => {
    const registry = new McpRegistry(tempRoot());
    const server = registry.register(httpServer());
    expect(registry.get(server.id)).toMatchObject({ id: "test-http-mcp", transport: "http" });
  });

  it("lists servers sorted by id", () => {
    const registry = new McpRegistry(tempRoot());
    registry.register(httpServer());
    registry.register(stdioServer());
    const list = registry.list();
    expect(list.map((s) => s.id)).toEqual(["test-http-mcp", "test-mcp"]);
  });

  it("removes a server", () => {
    const registry = new McpRegistry(tempRoot());
    registry.register(stdioServer());
    registry.remove("test-mcp");
    expect(registry.list()).toHaveLength(0);
  });

  it("updates a server", () => {
    const registry = new McpRegistry(tempRoot());
    registry.register(stdioServer());
    const updated = registry.update("test-mcp", { enabled: false });
    expect(updated.enabled).toBe(false);
    expect(registry.get("test-mcp").enabled).toBe(false);
  });

  it("throws NOT_FOUND for unknown server", () => {
    const registry = new McpRegistry(tempRoot());
    expect(() => registry.get("missing")).toThrow(/NOT_FOUND/);
  });

  it("validates stdio server requires command", () => {
    const registry = new McpRegistry(tempRoot());
    expect(() =>
      registry.register({ ...stdioServer(), command: undefined }),
    ).toThrow(/command/);
  });

  it("validates http server requires url", () => {
    const registry = new McpRegistry(tempRoot());
    expect(() =>
      registry.register({ ...httpServer(), url: undefined }),
    ).toThrow(/url/);
  });

  it("validates transport must be stdio or http", () => {
    const registry = new McpRegistry(tempRoot());
    expect(() =>
      registry.register({ ...stdioServer(), transport: "grpc" as "stdio" }),
    ).toThrow(/transport/);
  });

  it("persists servers across registry instances", () => {
    const root = tempRoot();
    const first = new McpRegistry(root);
    first.register(stdioServer());

    const second = new McpRegistry(root);
    expect(second.list()).toHaveLength(1);
    expect(second.get("test-mcp").name).toBe("Test MCP");
  });

  it("initialises with provided server configs", () => {
    const root = tempRoot();
    const registry = new McpRegistry(root, [stdioServer()]);
    expect(registry.list()).toHaveLength(1);
  });
});

function tempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), ".openarmy-mcp-test-"));
  roots.push(root);
  return root;
}

function stdioServer(): McpServerConfig {
  return {
    id: "test-mcp",
    name: "Test MCP",
    transport: "stdio",
    command: "npx",
    args: ["test-mcp-server"],
    env: [],
    enabled: true,
    toolPermissions: [],
    resourcePermissions: [],
  };
}

function httpServer(): McpServerConfig {
  return {
    id: "test-http-mcp",
    name: "Test HTTP MCP",
    transport: "http",
    url: "http://localhost:9000",
    env: [],
    enabled: true,
    toolPermissions: ["read", "write"],
    resourcePermissions: [],
  };
}
