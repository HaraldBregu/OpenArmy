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

describe("AgentRuntime", () => {
  it("registers an agent, creates an isolated run workspace, and completes a local run", async () => {
    const bundle = testRuntime();
    const agent = bundle.runtime.registerAgent(agentDefinition());

    const run = await bundle.runtime.startRun(agent.id, { task: "summarize" });
    const completed = await bundle.runtime.waitForRun(run.id);

    expect(completed.status).toBe("completed");
    expect(completed.workspacePath).toContain(path.join("agents", agent.id, "runs", run.id, "workspace"));
    expect(fs.existsSync(path.join(bundle.config.workspaceRoot, "agents", agent.id, "runs", run.id, "state.json"))).toBe(true);
    expect(completed.modelProviderUsage).toHaveLength(1);
    expect(completed.output).toMatchObject({
      metadata: {
        providerType: "local",
      },
    });
  });

  it("executes filesystem tools only inside the run workspace and records audit metadata", async () => {
    const bundle = testRuntime();
    const agent = bundle.runtime.registerAgent(agentDefinition());
    const run = await bundle.runtime.startRun(agent.id, {});
    await bundle.runtime.waitForRun(run.id);

    await bundle.runtime.callTool(run.id, "filesystem.writeFile", {
      path: "notes/result.txt",
      content: "hello runtime",
    });
    const readResult = await bundle.runtime.callTool(run.id, "filesystem.readFile", {
      path: "notes/result.txt",
    });

    await expect(
      bundle.runtime.callTool(run.id, "filesystem.readFile", {
        path: "../state.json",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const auditPath = path.join(bundle.config.workspaceRoot, "agents", agent.id, "runs", run.id, "logs", "audit.jsonl");
    expect(readResult).toMatchObject({ content: "hello runtime" });
    expect(fs.readFileSync(auditPath, "utf8")).toContain("filesystem.writeFile");
    expect(bundle.runtime.runTracker.get(run.id).toolCalls.some((call) => call.toolName === "filesystem.writeFile")).toBe(true);
  });

  it("denies tools that are not granted to the agent", async () => {
    const bundle = testRuntime();
    const agent = bundle.runtime.registerAgent(
      agentDefinition({
        tools: [{ group: "filesystem", tools: ["filesystem.readFile"], permissions: ["filesystem:read"] }],
      }),
    );
    const run = await bundle.runtime.startRun(agent.id, {});
    await bundle.runtime.waitForRun(run.id);

    await expect(
      bundle.runtime.callTool(run.id, "filesystem.writeFile", {
        path: "blocked.txt",
        content: "nope",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("enforces per-agent concurrency limits", async () => {
    const bundle = testRuntime();
    const agent = bundle.runtime.registerAgent(agentDefinition({ concurrency: 1 }));

    const firstRun = bundle.runtime.startRun(agent.id, { task: "first" });
    await expect(bundle.runtime.startRun(agent.id, { task: "second" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await firstRun;
  });

  it("loads enabled skills and tracks usage on the run", async () => {
    const root = tempRoot();
    const skillRoot = path.join(root, "skills", "reporting");
    fs.mkdirSync(skillRoot, { recursive: true });
    fs.writeFileSync(path.join(skillRoot, "SKILL.md"), "# Reporting\n\nWrite concise reports.\n", "utf8");
    fs.writeFileSync(
      path.join(skillRoot, "skill.json"),
      JSON.stringify({ id: "reporting", version: "1.2.3", requiredTools: ["filesystem"] }),
      "utf8",
    );

    const bundle = createRuntime({
      workspaceRoot: root,
      skillDirectories: [path.join(root, "skills")],
      scheduler: { enabled: false },
    });
    const agent = bundle.runtime.registerAgent(agentDefinition({ skills: ["reporting"] }));

    const run = await bundle.runtime.startRun(agent.id, {});
    const completed = await bundle.runtime.waitForRun(run.id);

    expect(completed.skillUsage).toMatchObject([{ skillId: "reporting", version: "1.2.3" }]);
  });
});

function testRuntime(): OpenArmyRuntimeBundle {
  return createRuntime({
    workspaceRoot: tempRoot(),
    scheduler: { enabled: false },
  });
}

function tempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), ".openarmy-test-"));
  roots.push(root);
  return root;
}

function agentDefinition(patch: Partial<NewAgentDefinition> = {}): NewAgentDefinition {
  return {
    id: "test-agent",
    name: "Test Agent",
    description: "Agent used by runtime tests",
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
    workspacePolicy: {
      isolationMode: "run",
      maxBytes: 1024 * 1024,
    },
    heartbeat: {
      intervalMs: 1_000,
      timeoutMs: 5_000,
    },
    environment: {
      variables: [],
      secrets: [],
    },
    concurrency: 2,
    ...patch,
  };
}
