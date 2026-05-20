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
      maxBodyBytes: Number(process.env.OPENARMY_MAX_BODY_BYTES ?? 10 * 1024 * 1024),
      maxPromptChars: Number(process.env.OPENARMY_MAX_PROMPT_CHARS ?? 100_000),
      maxUploadBytes: Number(process.env.OPENARMY_MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024),
      maxUploadFiles: Number(process.env.OPENARMY_MAX_UPLOAD_FILES ?? 20),
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
    mcpServers: [],
    logLevel: "info",
    toolPermissions: [],
  };
}

export function validateRuntimeConfig(config: RuntimeConfig): RuntimeConfig {
  if (!config.workspaceRoot.trim()) {
    throw validationError("workspaceRoot is required");
  }

  if (!Number.isInteger(config.gateway.port) || config.gateway.port < 0) {
    throw validationError("gateway.port must be a non-negative integer");
  }

  if (config.gateway.maxBodyBytes <= 0) throw validationError("gateway.maxBodyBytes must be positive");
  if (config.gateway.maxUploadBytes <= 0) throw validationError("gateway.maxUploadBytes must be positive");
  if (config.gateway.maxUploadFiles <= 0) throw validationError("gateway.maxUploadFiles must be positive");

  if (config.heartbeat.intervalMs <= 0 || config.heartbeat.timeoutMs <= 0) {
    throw validationError("heartbeat intervals must be positive");
  }

  if (config.providers.length === 0) {
    throw validationError("at least one model provider must be configured");
  }

  if (!Array.isArray(config.mcpServers)) {
    throw validationError("mcpServers must be an array");
  }

  return config;
}
