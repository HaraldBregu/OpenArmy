import { randomUUID } from "crypto";
import {
  AgentDefinition,
  LoadedSkillContext,
  ModelProviderConfig,
  ModelRequest,
  ModelResponse,
  RunRecord,
} from "../types.js";
import { notFound, validationError } from "./errors.js";

export class ModelProviderRegistry {
  private readonly providers = new Map<string, ModelProviderConfig>();

  constructor(providers: ModelProviderConfig[] = []) {
    for (const provider of providers) {
      this.register(provider);
    }
  }

  register(provider: ModelProviderConfig): ModelProviderConfig {
    if (!provider.id.trim()) {
      throw validationError("provider id is required");
    }
    if (!provider.models.includes(provider.defaultModel)) {
      throw validationError(`default model ${provider.defaultModel} is not listed for provider ${provider.id}`);
    }

    this.providers.set(provider.id, provider);
    return provider;
  }

  list(): ModelProviderConfig[] {
    return [...this.providers.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  get(id: string): ModelProviderConfig {
    const provider = this.providers.get(id);
    if (!provider) {
      throw notFound("Model provider", id);
    }

    return provider;
  }

  select(agent: AgentDefinition): { provider: ModelProviderConfig; model: string } {
    const provider = this.get(agent.provider);
    if (!provider.models.includes(agent.model)) {
      throw validationError(`model ${agent.model} is not available from provider ${provider.id}`);
    }

    return { provider, model: agent.model };
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    if (request.provider.type === "openai-compatible") {
      return this.openAiCompatibleResponse(request);
    }

    return this.localResponse(
      request.run,
      request.agent,
      request.model,
      request.input,
      request.skills,
    );
  }

  private async openAiCompatibleResponse(request: ModelRequest): Promise<ModelResponse> {
    const { provider, model, input, skills } = request;
    if (!provider.apiBaseUrl) {
      throw validationError(`provider ${provider.id} has no apiBaseUrl configured`);
    }

    const authHeader = this.resolveAuthHeader(provider);
    const systemParts: string[] = skills.map((s) => `<skill id="${s.definition.id}">\n${s.instructions}\n</skill>`);
    const systemPrompt = systemParts.length > 0 ? systemParts.join("\n\n") : undefined;
    const userContent = typeof input === "string" ? input : JSON.stringify(input);

    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: userContent });

    const body = JSON.stringify({ model, messages, stream: false });
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(body)),
    };
    if (authHeader) {
      headers["authorization"] = authHeader;
    }

    const response = await fetch(`${provider.apiBaseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(provider.timeoutMs),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw validationError(`provider ${provider.id} returned HTTP ${response.status}: ${text}`);
    }

    const json = await response.json() as {
      id?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content ?? "";
    const requestId = json.id ?? randomUUID();

    return { requestId, content, metadata: { providerType: "openai-compatible", model } };
  }

  private resolveAuthHeader(provider: ModelProviderConfig): string | undefined {
    if (!provider.auth || provider.auth.method === "none") {
      return undefined;
    }
    if (provider.auth.method === "bearer") {
      return `Bearer ${provider.auth.envVar ?? ""}`;
    }
    if (provider.auth.method === "env" && provider.auth.envVar) {
      const token = process.env[provider.auth.envVar];
      if (token) {
        return `Bearer ${token}`;
      }
    }
    return undefined;
  }

  private localResponse(
    run: RunRecord,
    agent: AgentDefinition,
    model: string,
    input: unknown,
    skills: LoadedSkillContext[],
  ): ModelResponse {
    const skillList = skills.map((skill) => skill.definition.id);
    return {
      requestId: randomUUID(),
      content: JSON.stringify(
        {
          runId: run.id,
          agentId: agent.id,
          model,
          status: "completed",
          input,
          skills: skillList,
          message: "Local provider executed the agent run without external model access.",
        },
        null,
        2,
      ),
      metadata: {
        providerType: "local",
        skillCount: skillList.length,
      },
    };
  }
}
