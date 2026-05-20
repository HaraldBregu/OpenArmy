import http, { IncomingMessage, Server, ServerResponse } from "http";
import { Socket } from "net";
import { createHash } from "crypto";
import { AgentRuntime } from "../runtime/agent-runtime.js";
import { OpenArmyError, toErrorPayload } from "../runtime/errors.js";
import { McpRegistry } from "../mcp/mcp-registry.js";
import { Scheduler } from "../scheduler/scheduler.js";
import { ApiEnvelope, GatewayMessage, JsonObject, JsonValue, RuntimeConfig } from "../types.js";

interface WebSocketClient {
  socket: Socket;
  subscriptions: Set<string>;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export class GatewayServer {
  private server?: Server;
  private readonly clients = new Set<WebSocketClient>();
  private readonly rateLimits = new Map<string, RateLimitRecord>();
  private readonly maxRequestsPerMinute = 120;

  constructor(
    private readonly runtime: AgentRuntime,
    private readonly config: RuntimeConfig["gateway"],
    private readonly scheduler?: Scheduler,
    private readonly mcpRegistry?: McpRegistry,
  ) {
    this.runtime.on("event", (message: GatewayMessage) => {
      this.broadcast(message);
    });
  }

  listen(): Promise<{ host: string; port: number }> {
    if (this.server) {
      return Promise.resolve(this.address());
    }

    this.server = http.createServer((request, response) => {
      void this.handleHttp(request, response);
    });
    this.server.on("upgrade", (request, socket) => {
      this.handleUpgrade(request, socket as Socket);
    });

    return new Promise((resolve, reject) => {
      const onError = (error: Error): void => {
        this.server?.off("listening", onListening);
        reject(error);
      };
      const onListening = (): void => {
        this.server?.off("error", onError);
        resolve(this.address());
      };

      this.server?.once("error", onError);
      this.server?.once("listening", onListening);
      this.server?.listen(this.config.port, this.config.host);
    });
  }

  close(): Promise<void> {
    for (const client of this.clients) {
      client.socket.destroy();
    }
    this.clients.clear();

    if (!this.server) {
      return Promise.resolve();
    }

    if (!this.server.listening) {
      this.server = undefined;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.server?.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        this.server = undefined;
        resolve();
      });
    });
  }

  private async handleHttp(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      const method = request.method ?? "GET";
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      const segments = url.pathname.split("/").filter(Boolean);

      if (method === "GET" && url.pathname === "/health") {
        this.json(response, 200, {
          ok: true,
          data: {
            status: "ok",
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      this.authorize(request);
      this.enforceRateLimit(request);

      if (segments.length === 1 && segments[0] === "agents" && method === "GET") {
        this.json(response, 200, { ok: true, data: this.runtime.agentRegistry.list() });
        return;
      }

      if (segments.length === 1 && segments[0] === "agents" && method === "POST") {
        const body = await this.readBody<JsonObject>(request);
        this.json(response, 201, { ok: true, data: this.runtime.registerAgent(body as never) });
        return;
      }

      if (segments.length === 2 && segments[0] === "agents" && method === "GET") {
        this.json(response, 200, { ok: true, data: this.runtime.agentRegistry.get(segments[1]) });
        return;
      }

      if (segments.length === 2 && segments[0] === "agents" && method === "PATCH") {
        const body = await this.readBody<JsonObject>(request);
        this.json(response, 200, { ok: true, data: this.runtime.agentRegistry.update(segments[1], body as never) });
        return;
      }

      if (segments.length === 2 && segments[0] === "agents" && method === "DELETE") {
        this.runtime.agentRegistry.remove(segments[1]);
        this.json(response, 200, { ok: true, data: { removed: true } });
        return;
      }

      if (segments.length === 3 && segments[0] === "agents" && segments[2] === "runs" && method === "POST") {
        const body = await this.readBody<JsonObject>(request, {});
        const run = await this.runtime.startRun(segments[1], body.input ?? body);
        this.json(response, 202, { ok: true, data: run });
        return;
      }

      if (segments.length === 1 && segments[0] === "runs" && method === "GET") {
        this.json(response, 200, { ok: true, data: this.runtime.runTracker.list() });
        return;
      }

      if (segments.length === 2 && segments[0] === "runs" && method === "GET") {
        this.json(response, 200, { ok: true, data: this.runtime.runTracker.get(segments[1]) });
        return;
      }

      if (segments.length === 3 && segments[0] === "runs" && segments[2] === "cancel" && method === "POST") {
        const body = await this.readBody<JsonObject>(request, {});
        const reason = typeof body.reason === "string" ? body.reason : undefined;
        this.json(response, 200, { ok: true, data: this.runtime.cancelRun(segments[1], reason) });
        return;
      }

      if (segments.length === 3 && segments[0] === "runs" && segments[2] === "pause" && method === "POST") {
        this.json(response, 200, { ok: true, data: this.runtime.pauseRun(segments[1]) });
        return;
      }

      if (segments.length === 3 && segments[0] === "runs" && segments[2] === "resume" && method === "POST") {
        this.json(response, 200, { ok: true, data: this.runtime.resumeRun(segments[1]) });
        return;
      }

      if (segments.length === 3 && segments[0] === "runs" && segments[2] === "message" && method === "POST") {
        const body = await this.readBody<JsonObject>(request);
        this.json(response, 200, { ok: true, data: this.runtime.sendInput(segments[1], body) });
        return;
      }

      if (segments.length === 3 && segments[0] === "runs" && segments[2] === "logs" && method === "GET") {
        this.json(response, 200, { ok: true, data: this.runtime.runTracker.logs(segments[1]) });
        return;
      }

      if (segments.length === 1 && segments[0] === "tools" && method === "GET") {
        this.json(response, 200, { ok: true, data: this.runtime.toolRegistry.listGroups() });
        return;
      }

      if (segments.length === 1 && segments[0] === "skills" && method === "GET") {
        this.json(response, 200, { ok: true, data: this.runtime.skillRegistry.list() });
        return;
      }

      if (segments.length === 1 && segments[0] === "providers" && method === "GET") {
        this.json(response, 200, { ok: true, data: this.runtime.providerRegistry.list() });
        return;
      }

      if (segments.length === 1 && segments[0] === "mcp" && method === "GET") {
        this.json(response, 200, { ok: true, data: this.mcpRegistry?.list() ?? [] });
        return;
      }

      if (segments.length === 2 && segments[0] === "scheduler" && segments[1] === "history" && method === "GET") {
        this.json(response, 200, { ok: true, data: this.scheduler?.history() ?? [] });
        return;
      }

      if (segments.length === 3 && segments[0] === "runs" && segments[2] === "spawn" && method === "POST") {
        const body = await this.readBody<JsonObject>(request);
        const agentId = typeof body.agentId === "string" ? body.agentId : undefined;
        if (!agentId) {
          throw new OpenArmyError("BAD_REQUEST", "agentId is required", 400);
        }
        const input = body.input ?? {};
        const run = await this.runtime.spawnSubAgent(segments[1], agentId, input);
        this.json(response, 202, { ok: true, data: run });
        return;
      }

      throw new OpenArmyError("ROUTE_NOT_FOUND", `${method} ${url.pathname} is not supported`, 404);
    } catch (error) {
      const payload = toErrorPayload(error);
      this.json(response, payload.statusCode, {
        ok: false,
        error: {
          code: payload.code,
          message: payload.message,
          details: payload.details,
        },
      });
    }
  }

  private handleUpgrade(request: IncomingMessage, socket: Socket): void {
    try {
      this.authorize(request);
      const key = request.headers["sec-websocket-key"];
      if (typeof key !== "string") {
        throw new OpenArmyError("BAD_WEBSOCKET_REQUEST", "missing sec-websocket-key", 400);
      }

      const accept = createHash("sha1")
        .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
        .digest("base64");
      socket.write(
        [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${accept}`,
          "",
          "",
        ].join("\r\n"),
      );

      const client: WebSocketClient = { socket, subscriptions: new Set() };
      this.clients.add(client);
      socket.on("data", (buffer) => this.handleSocketData(client, buffer));
      socket.on("close", () => this.clients.delete(client));
      socket.on("error", () => this.clients.delete(client));
      this.send(client, {
        type: "gateway.connected",
        timestamp: new Date().toISOString(),
        payload: { ok: true },
      });
    } catch (error) {
      const payload = toErrorPayload(error);
      socket.write(`HTTP/1.1 ${payload.statusCode} ${payload.code}\r\n\r\n${payload.message}`);
      socket.destroy();
    }
  }

  private handleSocketData(client: WebSocketClient, buffer: Buffer): void {
    const messageText = decodeFrame(buffer);
    if (!messageText) {
      return;
    }

    try {
      const message = JSON.parse(messageText) as GatewayMessage;
      void this.handleGatewayMessage(client, message);
    } catch (error) {
      this.send(client, {
        type: "gateway.error",
        timestamp: new Date().toISOString(),
        payload: {
          code: "BAD_MESSAGE",
          message: error instanceof Error ? error.message : "Invalid gateway message",
        },
      });
    }
  }

  private async handleGatewayMessage(client: WebSocketClient, message: GatewayMessage): Promise<void> {
    if (message.type === "run.subscribe" && message.runId) {
      client.subscriptions.add(message.runId);
      this.send(client, {
        type: "run.subscribed",
        runId: message.runId,
        correlationId: message.correlationId,
        timestamp: new Date().toISOString(),
        payload: { subscribed: true },
      });
      return;
    }

    if (message.type === "run.start" && message.agentId) {
      const run = await this.runtime.startRun(message.agentId, message.payload);
      client.subscriptions.add(run.id);
      this.send(client, {
        type: "run.started",
        runId: run.id,
        agentId: message.agentId,
        correlationId: message.correlationId,
        timestamp: new Date().toISOString(),
        payload: run as unknown as JsonValue,
      });
      return;
    }

    if (message.type === "run.message" && message.runId) {
      const run = this.runtime.sendInput(message.runId, message.payload);
      this.send(client, {
        type: "run.message.accepted",
        runId: message.runId,
        correlationId: message.correlationId,
        timestamp: new Date().toISOString(),
        payload: { status: run.status },
      });
      return;
    }

    if (message.type === "run.cancel" && message.runId) {
      const run = this.runtime.cancelRun(message.runId);
      this.send(client, {
        type: "run.cancelled",
        runId: message.runId,
        correlationId: message.correlationId,
        timestamp: new Date().toISOString(),
        payload: { status: run.status },
      });
      return;
    }

    throw new OpenArmyError("BAD_MESSAGE", `unsupported gateway message type: ${message.type}`, 400);
  }

  private broadcast(message: GatewayMessage): void {
    for (const client of this.clients) {
      if (!message.runId || client.subscriptions.size === 0 || client.subscriptions.has(message.runId)) {
        this.send(client, message);
      }
    }
  }

  private send(client: WebSocketClient, message: GatewayMessage): void {
    client.socket.write(encodeFrame(JSON.stringify(message)));
  }

  private authorize(request: IncomingMessage): void {
    if (!this.config.authToken) {
      return;
    }

    const bearer = request.headers.authorization;
    const token = request.headers["x-openarmy-token"];
    const authorized =
      bearer === `Bearer ${this.config.authToken}` || token === this.config.authToken;

    if (!authorized) {
      throw new OpenArmyError("UNAUTHORIZED", "missing or invalid OpenArmy API token", 401);
    }
  }

  private enforceRateLimit(request: IncomingMessage): void {
    const key = request.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    const windowMs = 60_000;

    let record = this.rateLimits.get(key);
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
      this.rateLimits.set(key, record);
    }

    record.count += 1;
    if (record.count > this.maxRequestsPerMinute) {
      throw new OpenArmyError("RATE_LIMITED", "too many requests", 429);
    }
  }

  private async readBody<T>(request: IncomingMessage, fallback?: T): Promise<T> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const raw = Buffer.concat(chunks).toString("utf8");
    if (!raw.trim()) {
      if (fallback !== undefined) {
        return fallback;
      }
      throw new OpenArmyError("BAD_REQUEST", "request body is required", 400);
    }

    return JSON.parse(raw) as T;
  }

  private json<T>(response: ServerResponse, statusCode: number, envelope: ApiEnvelope<T>): void {
    const body = JSON.stringify(envelope);
    response.writeHead(statusCode, {
      "content-type": "application/json; charset=utf-8",
      "content-length": Buffer.byteLength(body),
    });
    response.end(body);
  }

  private address(): { host: string; port: number } {
    const address = this.server?.address();
    if (typeof address === "object" && address) {
      return {
        host: address.address,
        port: address.port,
      };
    }

    return {
      host: this.config.host,
      port: this.config.port,
    };
  }
}

function encodeFrame(payload: string): Buffer {
  const payloadBuffer = Buffer.from(payload);
  const length = payloadBuffer.length;

  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), payloadBuffer]);
  }

  if (length < 65_536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, payloadBuffer]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, payloadBuffer]);
}

function decodeFrame(buffer: Buffer): string | null {
  if (buffer.length < 2) {
    return null;
  }

  const opcode = buffer[0] & 0x0f;
  if (opcode === 0x8) {
    return null;
  }

  let offset = 2;
  let length = buffer[1] & 0x7f;
  if (length === 126) {
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    length = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }

  const masked = (buffer[1] & 0x80) !== 0;
  let mask: Buffer | undefined;
  if (masked) {
    mask = buffer.subarray(offset, offset + 4);
    offset += 4;
  }

  const payload = buffer.subarray(offset, offset + length);
  if (!masked || !mask) {
    return payload.toString("utf8");
  }

  const unmasked = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    unmasked[index] = payload[index] ^ mask[index % 4];
  }

  return unmasked.toString("utf8");
}
