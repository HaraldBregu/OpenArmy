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
      throw validationError(
        "openai-compatible providers are configured but network execution is not implemented in the local foundation",
      );
    }

    return this.localResponse(
      request.run,
      request.agent,
      request.model,
      request.input,
      request.skills,
    );
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
