import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { GatewayServer } from "../src/gateway/gateway-server.js";
import { createRuntime } from "../src/runtime/create-runtime.js";
import { NewAgentDefinition } from "../src/types.js";

const roots: string[] = [];
const gateways: GatewayServer[] = [];

afterEach(async () => {
  for (const gateway of gateways.splice(0)) {
    await gateway.close();
  }
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("GatewayServer", () => {
  it("serves health without auth and protects management endpoints", async () => {
    const bundle = createRuntime({
      workspaceRoot: tempRoot(),
      scheduler: { enabled: false },
      gateway: {
        host: "127.0.0.1",
        port: 0,
        authToken: "secret",
      },
    });
    bundle.runtime.registerAgent(agentDefinition());
    const gateway = new GatewayServer(bundle.runtime, bundle.config.gateway);
    gateways.push(gateway);
    const address = await gateway.listen();
    const baseUrl = `http://${address.host}:${address.port}`;

    const health = await fetch(`${baseUrl}/health`);
    expect(await health.json()).toMatchObject({ ok: true, data: { status: "ok" } });

    const unauthorized = await fetch(`${baseUrl}/agents`);
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });

    const agents = await fetch(`${baseUrl}/agents`, {
      headers: { authorization: "Bearer secret" },
    });
    expect(agents.status).toBe(200);
    expect(await agents.json()).toMatchObject({ ok: true, data: [{ id: "gateway-agent" }] });
  });

  it("starts runs through the HTTP API and exposes run logs", async () => {
    const bundle = createRuntime({
      workspaceRoot: tempRoot(),
      scheduler: { enabled: false },
      gateway: {
        host: "127.0.0.1",
        port: 0,
      },
    });
    bundle.runtime.registerAgent(agentDefinition());
    const gateway = new GatewayServer(bundle.runtime, bundle.config.gateway);
    gateways.push(gateway);
    const address = await gateway.listen();
    const baseUrl = `http://${address.host}:${address.port}`;

    const response = await fetch(`${baseUrl}/agents/gateway-agent/runs`, {
      method: "POST",
      body: JSON.stringify({ input: { task: "gateway" } }),
    });
    expect(response.status).toBe(202);
    const envelope = (await response.json()) as { data: { id: string } };
    await bundle.runtime.waitForRun(envelope.data.id);

    const logs = await fetch(`${baseUrl}/runs/${envelope.data.id}/logs`);
    const logEnvelope = (await logs.json()) as { ok: boolean; data: Array<{ event: string }> };
    expect(logEnvelope.ok).toBe(true);
    expect(logEnvelope.data.some((entry) => entry.event === "run.created")).toBe(true);
  });
});

function tempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), ".openarmy-test-"));
  roots.push(root);
  return root;
}

function agentDefinition(): NewAgentDefinition {
  return {
    id: "gateway-agent",
    name: "Gateway Agent",
    description: "Agent used by gateway tests",
    provider: "local",
    model: "local-runtime",
    tools: [],
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
    concurrency: 1,
  };
}
