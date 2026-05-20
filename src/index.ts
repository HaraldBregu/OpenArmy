#!/usr/bin/env node

import fs from "fs";
import { Command } from "commander";
import { GatewayServer } from "./gateway/gateway-server.js";
import { createRuntime } from "./runtime/create-runtime.js";
import { JsonValue, NewAgentDefinition } from "./types.js";

const program = new Command();

program
  .name("oa")
  .description("OpenArmy - agentic AI runtime for configurable agents, tools, skills, and gateways")
  .version("2.0.0");

program
  .command("init")
  .description("Initialize the OpenArmy runtime workspace and register a local starter agent")
  .action(() => {
    const { runtime, config } = createRuntime();
    try {
      runtime.agentRegistry.get("local-assistant");
      console.log(JSON.stringify({ ok: true, workspaceRoot: config.workspaceRoot, agentId: "local-assistant" }, null, 2));
      return;
    } catch {
      const agent = runtime.registerAgent(defaultAgentDefinition());
      console.log(JSON.stringify({ ok: true, workspaceRoot: config.workspaceRoot, agent }, null, 2));
    }
  });

program
  .command("agents")
  .description("List registered agents")
  .action(() => {
    const { runtime } = createRuntime();
    console.log(JSON.stringify(runtime.agentRegistry.list(), null, 2));
  });

program
  .command("register")
  .description("Register an agent definition from a JSON file")
  .argument("<file>", "Path to an agent definition JSON file")
  .action((file: string) => {
    const { runtime } = createRuntime();
    const definition = JSON.parse(fs.readFileSync(file, "utf8")) as NewAgentDefinition;
    console.log(JSON.stringify(runtime.registerAgent(definition), null, 2));
  });

program
  .command("run")
  .description("Start an agent run and wait for completion")
  .argument("<agent-id>", "Agent id")
  .option("-i, --input <value>", "Inline input. JSON is parsed when possible.")
  .option("-f, --file <path>", "Read input from a file. JSON is parsed when possible.")
  .option("--timeout <ms>", "Wait timeout in milliseconds", "30000")
  .action(async (agentId: string, options: { input?: string; file?: string; timeout: string }) => {
    const { runtime } = createRuntime();
    const input = parseInput(options.input, options.file);
    const run = await runtime.startRun(agentId, input);
    const completed = await runtime.waitForRun(run.id, Number(options.timeout));
    console.log(JSON.stringify(completed, null, 2));
    if (completed.status === "failed" || completed.status === "cancelled" || completed.status === "stale") {
      process.exitCode = 1;
    }
  });

program
  .command("runs")
  .description("List agent runs")
  .action(() => {
    const { runtime } = createRuntime();
    console.log(JSON.stringify(runtime.runTracker.list(), null, 2));
  });

program
  .command("cancel")
  .description("Cancel a run")
  .argument("<run-id>", "Run id")
  .option("-r, --reason <reason>", "Cancellation reason")
  .action((runId: string, options: { reason?: string }) => {
    const { runtime } = createRuntime();
    console.log(JSON.stringify(runtime.cancelRun(runId, options.reason), null, 2));
  });

program
  .command("tools")
  .description("List available tool groups")
  .action(() => {
    const { runtime } = createRuntime();
    console.log(JSON.stringify(runtime.toolRegistry.listGroups(), null, 2));
  });

program
  .command("skills")
  .description("List available skills")
  .action(() => {
    const { runtime } = createRuntime();
    console.log(JSON.stringify(runtime.skillRegistry.list(), null, 2));
  });

program
  .command("providers")
  .description("List configured model providers")
  .action(() => {
    const { runtime } = createRuntime();
    console.log(JSON.stringify(runtime.providerRegistry.list(), null, 2));
  });

program
  .command("serve")
  .description("Start the HTTP and WebSocket gateway")
  .option("--host <host>", "Host to bind")
  .option("--port <port>", "Port to bind")
  .action(async (options: { host?: string; port?: string }) => {
    const bundle = createRuntime({
      gateway: {
        host: options.host ?? process.env.OPENARMY_HOST ?? "127.0.0.1",
        port: options.port ? Number(options.port) : Number(process.env.OPENARMY_PORT ?? 4737),
        authToken: process.env.OPENARMY_TOKEN,
      },
    });
    const gateway = new GatewayServer(bundle.runtime, bundle.config.gateway);
    const address = await gateway.listen();
    console.log(JSON.stringify({ ok: true, gateway: address }, null, 2));
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown OpenArmy error";
  console.error(JSON.stringify({ ok: false, error: { message } }, null, 2));
  process.exitCode = 1;
});

if (process.argv.length === 2) {
  program.outputHelp();
}

function parseInput(inlineInput?: string, filePath?: string): JsonValue {
  if (filePath) {
    return parseMaybeJson(fs.readFileSync(filePath, "utf8"));
  }

  if (inlineInput !== undefined) {
    return parseMaybeJson(inlineInput);
  }

  return {};
}

function parseMaybeJson(value: string): JsonValue {
  try {
    return JSON.parse(value) as JsonValue;
  } catch {
    return value;
  }
}

function defaultAgentDefinition(): NewAgentDefinition {
  return {
    id: "local-assistant",
    name: "Local Assistant",
    description: "Starter local agent that exercises the runtime without external model calls.",
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
      intervalMs: 15_000,
      timeoutMs: 60_000,
    },
    environment: {
      variables: [],
      secrets: [],
    },
    concurrency: 1,
  };
}
