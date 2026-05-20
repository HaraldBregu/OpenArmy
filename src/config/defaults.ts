import path from "path";
import { ModelProviderConfig, RuntimeConfig } from "../types.js";
import { validationError } from "../runtime/errors.js";

const DEFAULT_PROVIDER: ModelProviderConfig = {
  id: "local",
  type: "local",
  auth: { method: "none" },
  models: ["local-runtime"],
  defaultModel: "local-runtime",
  timeoutMs: 30_000,
  retryPolicy: {
    retries: 0,
    backoffMs: 0,
  },
};

export function defaultRuntimeConfig(cwd = process.cwd()): RuntimeConfig {
  const workspaceRoot = process.env.OPENARMY_HOME ?? path.join(cwd, ".openarmy");

  return {
    workspaceRoot,
    gateway: {
      host: process.env.OPENARMY_HOST ?? "127.0.0.1",
      port: Number(process.env.OPENARMY_PORT ?? 4737),
      authToken: process.env.OPENARMY_TOKEN,
    },
    scheduler: {
      enabled: process.env.OPENARMY_SCHEDULER !== "false",
    },
    heartbeat: {
      intervalMs: Number(process.env.OPENARMY_HEARTBEAT_INTERVAL_MS ?? 15_000),
      timeoutMs: Number(process.env.OPENARMY_HEARTBEAT_TIMEOUT_MS ?? 60_000),
    },
    skillDirectories: [path.join(workspaceRoot, "skills")],
    providers: [DEFAULT_PROVIDER],
    logLevel: "info",
    toolPermissions: [],
  };
}

export function validateRuntimeConfig(config: RuntimeConfig): RuntimeConfig {
  if (!config.workspaceRoot.trim()) {
    throw validationError("workspaceRoot is required");
  }

  if (!Number.isInteger(config.gateway.port) || config.gateway.port <= 0) {
    throw validationError("gateway.port must be a positive integer");
  }

  if (config.heartbeat.intervalMs <= 0 || config.heartbeat.timeoutMs <= 0) {
    throw validationError("heartbeat intervals must be positive");
  }

  if (config.providers.length === 0) {
    throw validationError("at least one model provider must be configured");
  }

  return config;
}
