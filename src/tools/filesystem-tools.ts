import fs from "fs";
import path from "path";
import { JsonObject, ToolDefinition } from "../types.js";
import { validationError } from "../runtime/errors.js";
import { WorkspaceManager } from "../runtime/workspace-manager.js";
import { ToolRegistry } from "./tool-registry.js";

const DEFAULT_MAX_BYTES = 1024 * 1024;

function stringInput(input: JsonObject, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.length === 0) {
    throw validationError(`${key} must be a non-empty string`);
  }

  return value;
}

function optionalString(input: JsonObject, key: string): string | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw validationError(`${key} must be a string`);
  }

  return value;
}

function contentInput(input: JsonObject, key: string): string {
  const value = input[key];
  if (typeof value !== "string") {
    throw validationError(`${key} must be a string`);
  }

  return value;
}

function baseDefinition(
  name: string,
  description: string,
  permissionRequirements: string[],
  mutatesFiles: boolean,
): ToolDefinition {
  return {
    name,
    group: "filesystem",
    description,
    inputSchema: { type: "object", additionalProperties: true },
    outputSchema: { type: "object", additionalProperties: true },
    permissionRequirements,
    mutatesFiles,
    usesNetwork: false,
    longRunning: false,
    parallelSafe: !mutatesFiles,
    audit: {
      event: name,
      category: "filesystem",
    },
  };
}

export function registerFilesystemTools(registry: ToolRegistry, workspaceManager: WorkspaceManager): void {
  registry.registerGroup({
    name: "filesystem",
    description: "Read, write, list, move, delete, stat, and search files inside the run workspace.",
    implemented: true,
  });

  registry.registerTool(
    baseDefinition("filesystem.readFile", "Read a workspace file with a size limit.", ["filesystem:read"], false),
    (input, context) => {
      const relativePath = stringInput(input, "path");
      const filePath = workspaceManager.resolveInWorkspace(context.workspace.workspacePath, relativePath);
      const maxBytes = context.agent.workspacePolicy.maxBytes ?? DEFAULT_MAX_BYTES;
      workspaceManager.enforceReadLimit(filePath, maxBytes);
      return {
        path: relativePath,
        content: fs.readFileSync(filePath, "utf8"),
      };
    },
  );

  registry.registerTool(
    baseDefinition("filesystem.writeFile", "Write a workspace file, creating parent directories.", ["filesystem:write"], true),
    (input, context) => {
      const relativePath = stringInput(input, "path");
      const content = contentInput(input, "content");
      const filePath = workspaceManager.resolveInWorkspace(context.workspace.workspacePath, relativePath);
      const maxBytes = context.agent.workspacePolicy.maxBytes ?? DEFAULT_MAX_BYTES;
      workspaceManager.enforceWriteLimit(content, maxBytes);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, "utf8");
      workspaceManager.appendAudit(context.workspace, "filesystem.writeFile", { path: relativePath });
      return { path: relativePath, bytes: Buffer.byteLength(content, "utf8") };
    },
  );

  registry.registerTool(
    baseDefinition("filesystem.appendFile", "Append text to a workspace file.", ["filesystem:write"], true),
    (input, context) => {
      const relativePath = stringInput(input, "path");
      const content = contentInput(input, "content");
      const filePath = workspaceManager.resolveInWorkspace(context.workspace.workspacePath, relativePath);
      const maxBytes = context.agent.workspacePolicy.maxBytes ?? DEFAULT_MAX_BYTES;
      workspaceManager.enforceWriteLimit(content, maxBytes);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.appendFileSync(filePath, content, "utf8");
      workspaceManager.appendAudit(context.workspace, "filesystem.appendFile", { path: relativePath });
      return { path: relativePath, bytes: Buffer.byteLength(content, "utf8") };
    },
  );

  registry.registerTool(
    baseDefinition("filesystem.listDirectory", "List entries inside a workspace directory.", ["filesystem:read"], false),
    (input, context) => {
      const relativePath = optionalString(input, "path") ?? ".";
      const directoryPath = workspaceManager.resolveInWorkspace(context.workspace.workspacePath, relativePath);
      const entries = fs.readdirSync(directoryPath, { withFileTypes: true }).map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
      }));
      return { path: relativePath, entries };
    },
  );

  registry.registerTool(
    baseDefinition("filesystem.createDirectory", "Create a workspace directory.", ["filesystem:write"], true),
    (input, context) => {
      const relativePath = stringInput(input, "path");
      const directoryPath = workspaceManager.resolveInWorkspace(context.workspace.workspacePath, relativePath);
      fs.mkdirSync(directoryPath, { recursive: true });
      workspaceManager.appendAudit(context.workspace, "filesystem.createDirectory", { path: relativePath });
      return { path: relativePath, created: true };
    },
  );

  registry.registerTool(
    baseDefinition("filesystem.deleteFile", "Delete a workspace file.", ["filesystem:delete"], true),
    (input, context) => {
      const relativePath = stringInput(input, "path");
      const filePath = workspaceManager.resolveInWorkspace(context.workspace.workspacePath, relativePath);
      fs.unlinkSync(filePath);
      workspaceManager.appendAudit(context.workspace, "filesystem.deleteFile", { path: relativePath });
      return { path: relativePath, deleted: true };
    },
  );

  registry.registerTool(
    baseDefinition("filesystem.moveFile", "Move or rename a workspace file.", ["filesystem:write"], true),
    (input, context) => {
      const from = stringInput(input, "from");
      const to = stringInput(input, "to");
      const fromPath = workspaceManager.resolveInWorkspace(context.workspace.workspacePath, from);
      const toPath = workspaceManager.resolveInWorkspace(context.workspace.workspacePath, to);
      fs.mkdirSync(path.dirname(toPath), { recursive: true });
      fs.renameSync(fromPath, toPath);
      workspaceManager.appendAudit(context.workspace, "filesystem.moveFile", { from, to });
      return { from, to, moved: true };
    },
  );

  registry.registerTool(
    baseDefinition("filesystem.stat", "Read file metadata inside the workspace.", ["filesystem:read"], false),
    (input, context) => {
      const relativePath = stringInput(input, "path");
      const filePath = workspaceManager.resolveInWorkspace(context.workspace.workspacePath, relativePath);
      const stats = fs.statSync(filePath);
      return {
        path: relativePath,
        type: stats.isDirectory() ? "directory" : "file",
        size: stats.size,
        mtime: stats.mtime.toISOString(),
      };
    },
  );

  registry.registerTool(
    baseDefinition("filesystem.searchFiles", "Search filenames and file contents inside the workspace.", ["filesystem:read"], false),
    (input, context) => {
      const query = stringInput(input, "query");
      const startPath = optionalString(input, "path") ?? ".";
      const root = workspaceManager.resolveInWorkspace(context.workspace.workspacePath, startPath);
      const maxBytes = context.agent.workspacePolicy.maxBytes ?? DEFAULT_MAX_BYTES;
      const matches: Array<{ path: string; match: "name" | "content" }> = [];

      const visit = (currentPath: string): void => {
        for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
          const absolutePath = path.join(currentPath, entry.name);
          const relativePath = path.relative(context.workspace.workspacePath, absolutePath);
          if (entry.name.includes(query)) {
            matches.push({ path: relativePath, match: "name" });
          }
          if (entry.isDirectory()) {
            visit(absolutePath);
            continue;
          }
          const stats = fs.statSync(absolutePath);
          if (stats.size <= maxBytes && fs.readFileSync(absolutePath, "utf8").includes(query)) {
            matches.push({ path: relativePath, match: "content" });
          }
        }
      };

      visit(root);
      return { query, matches };
    },
  );
}
