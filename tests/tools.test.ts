import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { createRuntime, OpenArmyRuntimeBundle } from "../src/runtime/create-runtime.js";
import { NewAgentDefinition } from "../src/types.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("filesystem.applyPatch", () => {
  it("applies a single search-and-replace hunk to a workspace file", async () => {
    const bundle = testRuntime();
    const agent = bundle.runtime.registerAgent(agentDefinition());
    const run = await bundle.runtime.startRun(agent.id, {});
    await bundle.runtime.waitForRun(run.id);

    await bundle.runtime.callTool(run.id, "filesystem.writeFile", {
      path: "hello.txt",
      content: "Hello World",
    });

    const result = await bundle.runtime.callTool(run.id, "filesystem.applyPatch", {
      path: "hello.txt",
      hunks: [{ search: "World", replace: "OpenArmy" }],
    });

    expect(result).toMatchObject({ path: "hello.txt", applied: 1 });

    const read = await bundle.runtime.callTool(run.id, "filesystem.readFile", {
      path: "hello.txt",
    });
    expect(read).toMatchObject({ content: "Hello OpenArmy" });
  });

  it("applies multiple hunks in order", async () => {
    const bundle = testRuntime();
    const agent = bundle.runtime.registerAgent(agentDefinition());
    const run = await bundle.runtime.startRun(agent.id, {});
    await bundle.runtime.waitForRun(run.id);

    await bundle.runtime.callTool(run.id, "filesystem.writeFile", {
      path: "doc.txt",
      content: "foo bar baz",
    });

    await bundle.runtime.callTool(run.id, "filesystem.applyPatch", {
      path: "doc.txt",
      hunks: [
        { search: "foo", replace: "one" },
        { search: "bar", replace: "two" },
        { search: "baz", replace: "three" },
      ],
    });

    const read = await bundle.runtime.callTool(run.id, "filesystem.readFile", { path: "doc.txt" });
    expect(read).toMatchObject({ content: "one two three" });
  });

  it("records a patch operation in the audit log", async () => {
    const bundle = testRuntime();
    const agent = bundle.runtime.registerAgent(agentDefinition());
    const run = await bundle.runtime.startRun(agent.id, {});
    await bundle.runtime.waitForRun(run.id);

    await bundle.runtime.callTool(run.id, "filesystem.writeFile", { path: "a.txt", content: "abc" });
    await bundle.runtime.callTool(run.id, "filesystem.applyPatch", {
      path: "a.txt",
      hunks: [{ search: "abc", replace: "xyz" }],
    });

    const auditPath = path.join(
      bundle.config.workspaceRoot,
      "agents",
      agent.id,
      "runs",
      run.id,
      "logs",
      "audit.jsonl",
    );
    const audit = fs.readFileSync(auditPath, "utf8");
    expect(audit).toContain("filesystem.applyPatch");
  });

  it("rejects a patch when the search string is not found", async () => {
    const bundle = testRuntime();
    const agent = bundle.runtime.registerAgent(agentDefinition());
    const run = await bundle.runtime.startRun(agent.id, {});
    await bundle.runtime.waitForRun(run.id);

    await bundle.runtime.callTool(run.id, "filesystem.writeFile", { path: "x.txt", content: "abc" });

    await expect(
      bundle.runtime.callTool(run.id, "filesystem.applyPatch", {
        path: "x.txt",
        hunks: [{ search: "DOES_NOT_EXIST", replace: "y" }],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects empty hunks array", async () => {
    const bundle = testRuntime();
    const agent = bundle.runtime.registerAgent(agentDefinition());
    const run = await bundle.runtime.startRun(agent.id, {});
    await bundle.runtime.waitForRun(run.id);

    await bundle.runtime.callTool(run.id, "filesystem.writeFile", { path: "y.txt", content: "abc" });

    await expect(
      bundle.runtime.callTool(run.id, "filesystem.applyPatch", {
        path: "y.txt",
        hunks: [],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("logs denied tool calls to the audit log", async () => {
    const bundle = testRuntime();
    const agent = bundle.runtime.registerAgent(
      agentDefinition({
        tools: [{ group: "filesystem", tools: ["filesystem.readFile"], permissions: ["filesystem:read"] }],
      }),
    );
    const run = await bundle.runtime.startRun(agent.id, {});
    await bundle.runtime.waitForRun(run.id);

    await expect(
      bundle.runtime.callTool(run.id, "filesystem.writeFile", { path: "denied.txt", content: "x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const auditPath = path.join(
      bundle.config.workspaceRoot,
      "agents",
      agent.id,
      "runs",
      run.id,
      "logs",
      "audit.jsonl",
    );
    const audit = fs.readFileSync(auditPath, "utf8");
    expect(audit).toContain("tool.denied");
  });
});

function testRuntime(): OpenArmyRuntimeBundle {
  return createRuntime({
    workspaceRoot: tempRoot(),
    scheduler: { enabled: false },
  });
}

function tempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), ".openarmy-tools-test-"));
  roots.push(root);
  return root;
}

function agentDefinition(patch: Partial<NewAgentDefinition> = {}): NewAgentDefinition {
  return {
    id: "tools-agent",
    name: "Tools Agent",
    description: "Agent used by tools tests",
    provider: "local",
    model: "local-runtime",
    tools: [
      {
        group: "filesystem",
        tools: ["*"],
        permissions: ["filesystem:read", "filesystem:write", "filesystem:delete"],
      },
    ],
    skills: [],
    workspacePolicy: { isolationMode: "run", maxBytes: 1024 * 1024 },
    heartbeat: { intervalMs: 1_000, timeoutMs: 5_000 },
    environment: { variables: [], secrets: [] },
    concurrency: 2,
    ...patch,
  };
}
