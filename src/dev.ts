#!/usr/bin/env node

import { GatewayServer } from "./gateway/gateway-server.js";
import { createRuntime } from "./runtime/create-runtime.js";
import { NewAgentDefinition } from "./types.js";

const host = process.env.OPENARMY_HOST ?? "127.0.0.1";
const port = Number(process.env.OPENARMY_PORT ?? 4737);
const authToken = process.env.OPENARMY_TOKEN;

const bundle = createRuntime({
  gateway: { host, port, authToken },
  scheduler: { enabled: true },
});

ensureStarterAgent(bundle.runtime as Parameters<typeof ensureStarterAgent>[0]);

const gateway = new GatewayServer(bundle.runtime, bundle.config.gateway);

const address = await gateway.listen();

console.log(
  JSON.stringify(
    {
      ok: true,
      status: "running",
      gateway: address,
      workspaceRoot: bundle.config.workspaceRoot,
      providers: bundle.providerRegistry.list().map((p) => p.id),
      skills: bundle.skillRegistry.list().map((s) => s.id),
    },
    null,
    2,
  ),
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void gateway.close().then(() => process.exit(0));
  });
}

function ensureStarterAgent(runtime: { registerAgent: (def: NewAgentDefinition) => unknown; agentRegistry: { get: (id: string) => unknown } }): void {
  try {
    runtime.agentRegistry.get("local-assistant");
  } catch {
    runtime.registerAgent({
      id: "local-assistant",
      name: "Local Assistant",
      description: "Starter local agent for development.",
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
      heartbeat: { intervalMs: 15_000, timeoutMs: 60_000 },
      environment: { variables: [], secrets: [] },
      concurrency: 1,
    });
  }
}
