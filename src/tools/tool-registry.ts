import { randomUUID } from "crypto";
import {
  AgentDefinition,
  JsonObject,
  JsonValue,
  RunRecord,
  RunWorkspace,
  ToolDefinition,
  ToolExecutionContext,
  ToolGroupDefinition,
  ToolHandler,
} from "../types.js";
import { notFound, validationError } from "../runtime/errors.js";
import { RunTracker } from "../runtime/run-tracker.js";
import { ToolAuthorizer } from "./tool-authorizer.js";
import { ToolAuditLogger } from "./tool-audit-logger.js";

interface RegisteredTool {
  definition: ToolDefinition;
  handler?: ToolHandler;
}

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();
  private readonly groups = new Map<string, Omit<ToolGroupDefinition, "tools">>();
  private readonly authorizer = new ToolAuthorizer();
  private readonly auditLogger = new ToolAuditLogger();

  constructor(private readonly runTracker?: RunTracker) {}

  registerGroup(group: Omit<ToolGroupDefinition, "tools">): void {
    this.groups.set(group.name, group);
  }

  registerTool(definition: ToolDefinition, handler: ToolHandler): ToolDefinition {
    this.registerGroup({
      name: definition.group,
      description: this.groups.get(definition.group)?.description ?? definition.group,
      implemented: true,
    });
    this.tools.set(definition.name, { definition, handler });
    return definition;
  }

  listGroups(): ToolGroupDefinition[] {
    const groups = [...this.groups.values()].map((group) => ({
      ...group,
      implemented: group.implemented || this.hasImplementedTools(group.name),
      tools: this.list().filter((tool) => tool.group === group.name),
    }));

    return groups.sort((a, b) => a.name.localeCompare(b.name));
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()]
      .map((tool) => tool.definition)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get(name: string): ToolDefinition {
    const tool = this.tools.get(name);
    if (!tool) {
      throw notFound("Tool", name);
    }

    return tool.definition;
  }

  isAllowed(agent: AgentDefinition, definition: ToolDefinition): boolean {
    return agent.tools.some((grant) => {
      const groupMatches = grant.group === "*" || grant.group === definition.group;
      if (!groupMatches) {
        return false;
      }

      const toolMatches =
        !grant.tools ||
        grant.tools.includes("*") ||
        grant.tools.includes(definition.name) ||
        grant.tools.includes(definition.name.replace(`${definition.group}.`, ""));

      if (!toolMatches) {
        return false;
      }

      if (definition.permissionRequirements.length === 0) {
        return true;
      }

      return definition.permissionRequirements.every(
        (permission) => grant.permissions?.includes("*") || grant.permissions?.includes(permission),
      );
    });
  }

  assertAllowed(agent: AgentDefinition, definition: ToolDefinition): void {
    if (!this.isAllowed(agent, definition)) {
      throw forbidden(`agent ${agent.id} is not allowed to use tool ${definition.name}`);
    }
  }

  async execute(
    name: string,
    input: JsonObject,
    context: ToolExecutionContext,
  ): Promise<JsonValue> {
    const registered = this.tools.get(name);
    if (!registered?.handler) {
      throw notFound("Tool", name);
    }

    this.assertAllowed(context.agent, registered.definition);
    this.validateObjectInput(input);

    const callId = randomUUID();
    this.runTracker?.addToolCall(context.run.id, {
      id: callId,
      toolName: registered.definition.name,
      group: registered.definition.group,
      startedAt: new Date().toISOString(),
      status: "running",
      mutatesFiles: registered.definition.mutatesFiles,
      usesNetwork: registered.definition.usesNetwork,
      auditMetadata: {
        event: registered.definition.audit.event,
      },
    });

    try {
      const result = await registered.handler(input, context);
      this.runTracker?.updateToolCall(context.run.id, callId, {
        status: "completed",
        completedAt: new Date().toISOString(),
      });
      return result;
    } catch (error) {
      this.runTracker?.updateToolCall(context.run.id, callId, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown tool error",
      });
      throw error;
    }
  }

  buildContext(agent: AgentDefinition, run: RunRecord, workspace: RunWorkspace): ToolExecutionContext {
    return { agent, run, workspace };
  }

  private hasImplementedTools(group: string): boolean {
    return [...this.tools.values()].some((tool) => tool.definition.group === group);
  }

  private validateObjectInput(input: JsonObject): void {
    if (input === null || Array.isArray(input) || typeof input !== "object") {
      throw validationError("tool input must be an object");
    }
  }
}

export function registerPlannedToolGroups(registry: ToolRegistry): void {
  const groups: Array<Omit<ToolGroupDefinition, "tools">> = [
    {
      name: "shell",
      description: "Run workspace-scoped commands, stream stdin, and apply patches with explicit permission.",
      implemented: false,
    },
    {
      name: "planning",
      description: "Update task plans and status for long-running work.",
      implemented: false,
    },
    {
      name: "parallel",
      description: "Run independent read or shell actions in parallel when safe.",
      implemented: false,
    },
    {
      name: "subagents",
      description: "Spawn, message, wait for, resume, and close child agents.",
      implemented: false,
    },
    {
      name: "mcp",
      description: "List and read MCP-provided resources.",
      implemented: false,
    },
    {
      name: "tool-discovery",
      description: "Search deferred or plugin-provided tools.",
      implemented: false,
    },
    {
      name: "web",
      description: "Search/open pages, click/find text, screenshots, weather, finance, sports, and time.",
      implemented: false,
    },
    {
      name: "image",
      description: "Generate or edit images through configured image providers.",
      implemented: false,
    },
    {
      name: "apps",
      description: "Browser, Figma, GitHub, Documents, Presentations, Spreadsheets, Vercel, and Photoshop tools.",
      implemented: false,
    },
  ];

  for (const group of groups) {
    registry.registerGroup(group);
  }
}
