import { AgentDefinition, ToolDefinition } from "../types.js";
import { forbidden } from "../runtime/errors.js";

export class ToolAuthorizer {
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
        (permission) =>
          grant.permissions?.includes("*") || grant.permissions?.includes(permission),
      );
    });
  }

  assertAllowed(agent: AgentDefinition, definition: ToolDefinition): void {
    if (!this.isAllowed(agent, definition)) {
      throw forbidden(`agent ${agent.id} is not allowed to use tool ${definition.name}`);
    }
  }
}
