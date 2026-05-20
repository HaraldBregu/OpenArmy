import { ToolDefinition } from "../types.js";
import { validationError } from "../runtime/errors.js";
import { WorkspaceManager } from "../runtime/workspace-manager.js";
import { FileParserRegistry } from "./file-parser-registry.js";
import { ToolRegistry } from "./tool-registry.js";

const parserRegistry = new FileParserRegistry();

export function registerFileParseTools(registry: ToolRegistry, workspaceManager: WorkspaceManager): void {
  registry.registerGroup({
    name: "file",
    description: "Parse workspace files into normalized assistant-readable content.",
    implemented: true,
  });

  const definition: ToolDefinition = {
    name: "file.parse",
    group: "file",
    description:
      "Parse a workspace file into normalized text content. Supports text, Markdown, JSON, YAML, CSV, TSV, HTML, XML, PDF, DOCX, XLSX, and images.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative path to the file" },
        maxInputBytes: { type: "number", description: "Override default max parse size in bytes" },
      },
      required: ["path"],
    },
    outputSchema: { type: "object", additionalProperties: true },
    permissionRequirements: ["file:parse"],
    mutatesFiles: false,
    usesNetwork: false,
    longRunning: false,
    parallelSafe: true,
    audit: { event: "file.parse", category: "file" },
  };

  registry.registerTool(definition, async (input, context) => {
    const relativePath = input["path"];
    if (typeof relativePath !== "string" || relativePath.length === 0) {
      throw validationError("path must be a non-empty string");
    }

    const maxBytes = typeof input["maxInputBytes"] === "number" ? input["maxInputBytes"] : undefined;
    const absPath = workspaceManager.resolveInWorkspace(context.workspace.workspacePath, relativePath);
    const result = await parserRegistry.parse(absPath, maxBytes);

    workspaceManager.appendAudit(context.workspace, "file.parse", {
      path: relativePath,
      ok: result.ok,
      ...(result.ok ? { mimeType: result.mimeType, size: result.size } : { error: result.error }),
    });

    return result as unknown as import("../types.js").JsonValue;
  });
}
