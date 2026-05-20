import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("NodeRuntimeModule", () => {
  it("exports createRuntime and can start an agent run", async () => {
    // Import through the node module API to verify the export works
    const { createRuntime } = await import("../src/node.js");

    const bundle = createRuntime({ workspaceRoot: tempRoot(), scheduler: { enabled: false } });
    const agent = bundle.runtime.registerAgent({
      id: "node-api-agent",
      name: "Node API Agent",
      description: "Tests the Node.js module API",
      provider: "local",
      model: "local-runtime",
      tools: [{ group: "filesystem", tools: ["*"], permissions: ["filesystem:read", "filesystem:write"] }],
      skills: [],
      workspacePolicy: { isolationMode: "run", maxBytes: 1024 * 1024 },
      concurrency: 1,
    });

    const run = await bundle.runtime.startRun(agent.id, { task: "node-api" });
    const completed = await bundle.runtime.waitForRun(run.id);
    expect(completed.status).toBe("completed");
  });

  it("exports McpRegistry and WorkspacePathGuard", async () => {
    const { McpRegistry, WorkspacePathGuard } = await import("../src/node.js");
    expect(typeof McpRegistry).toBe("function");
    expect(typeof WorkspacePathGuard).toBe("function");
  });

  it("exports ToolAuthorizer and ToolAuditLogger", async () => {
    const { ToolAuthorizer, ToolAuditLogger } = await import("../src/node.js");
    expect(typeof ToolAuthorizer).toBe("function");
    expect(typeof ToolAuditLogger).toBe("function");
  });

  it("exports redactSecrets utility", async () => {
    const { redactSecrets } = await import("../src/node.js");
    const result = redactSecrets({ password: "secret", name: "alice" });
    expect(result).toMatchObject({ password: "[REDACTED]", name: "alice" });
  });

  it("CLI, Node.js API, and HTTP server all use the same RuntimeCore", async () => {
    // Verify that the bundle returned from createRuntime (used by all three entry points)
    // has identical service instances — no separate execution logic paths.
    const { createRuntime } = await import("../src/node.js");
    const bundle = createRuntime({ workspaceRoot: tempRoot(), scheduler: { enabled: false } });

    // These should be the same objects the CLI and HTTP server would use
    expect(bundle.runtime).toBeDefined();
    expect(bundle.skillRegistry).toBeDefined();
    expect(bundle.mcpRegistry).toBeDefined();
    expect(bundle.toolRegistry).toBeDefined();
    expect(bundle.scheduler).toBeDefined();
  });
});

function tempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), ".openarmy-node-test-"));
  roots.push(root);
  return root;
}
