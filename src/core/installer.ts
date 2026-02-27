import path from "path";
import { PluginPackageJson, RegistryEntry } from "../types.js";
import { OA_PACKAGES_DIR } from "../constants.js";
import { npmInstall } from "../utils/npm.js";
import { readJsonFile, ensureDir, fileExists } from "../utils/fs.js";
import { addEntry } from "./registry.js";

// Determine OpenArmy root directory
// This works for both development and production installs
function getOpenArmyRoot(): string {
  let searchPath = process.cwd();

  // Try to find the agents directory by walking up from cwd
  for (let i = 0; i < 10; i++) {
    const agentsPath = path.join(searchPath, "agents");
    if (fileExists(agentsPath)) {
      return searchPath;
    }
    const parent = path.dirname(searchPath);
    if (parent === searchPath) break;
    searchPath = parent;
  }

  // Fallback: assume we're in dist/core, go up 3 levels
  return path.join(process.cwd(), "../../..");
}

const OPENARMY_ROOT = getOpenArmyRoot();

export function validateOaPlugin(pkgJson: PluginPackageJson): { valid: boolean; error?: string } {
  if (!pkgJson.oa) {
    return { valid: false, error: "Package missing 'oa' field in package.json" };
  }

  const { description, inputMapping } = pkgJson.oa;

  if (!description || typeof description !== "string") {
    return { valid: false, error: "oa.description must be a non-empty string" };
  }

  if (!inputMapping || typeof inputMapping !== "object") {
    return { valid: false, error: "oa.inputMapping must be an object" };
  }

  const { type, flag, position } = inputMapping;

  if (!["flag", "stdin", "positional"].includes(type)) {
    return { valid: false, error: `oa.inputMapping.type must be one of: flag, stdin, positional` };
  }

  if (type === "flag" && !flag) {
    return { valid: false, error: "oa.inputMapping.flag is required when type is 'flag'" };
  }

  if (type === "positional" && position === undefined) {
    return { valid: false, error: "oa.inputMapping.position is required when type is 'positional'" };
  }

  return { valid: true };
}

export function resolveBin(pkgJson: PluginPackageJson): { binPath: string; binName: string } | null {
  const { name, bin } = pkgJson;

  if (!bin) {
    return null;
  }

  let binName: string;
  let binPath: string;

  if (typeof bin === "string") {
    binName = name;
    binPath = bin;
  } else {
    // Use first bin entry
    const binNames = Object.keys(bin);
    if (binNames.length === 0) {
      return null;
    }
    binName = binNames[0];
    binPath = bin[binName];
  }

  // Resolve to absolute path within node_modules
  const pkgNodeModulesPath = path.join(OA_PACKAGES_DIR, "node_modules", name);
  const absoluteBinPath = path.join(pkgNodeModulesPath, binPath);

  return { binName, binPath: absoluteBinPath };
}

export function installPlugin(packageName: string): { success: boolean; error?: string; entry?: RegistryEntry } {
  // Create packages directory
  ensureDir(OA_PACKAGES_DIR);

  // Run npm install
  const installResult = npmInstall(OA_PACKAGES_DIR, packageName);
  if (!installResult.success) {
    return { success: false, error: installResult.error };
  }

  // Read installed package.json
  const pkgJsonPath = path.join(OA_PACKAGES_DIR, "node_modules", packageName, "package.json");

  if (!fileExists(pkgJsonPath)) {
    return { success: false, error: `Could not find package.json for ${packageName}` };
  }

  let pkgJson: PluginPackageJson;
  try {
    pkgJson = readJsonFile<PluginPackageJson>(pkgJsonPath);
  } catch (err) {
    return { success: false, error: `Failed to parse package.json: ${err instanceof Error ? err.message : String(err)}` };
  }

  // Validate oa plugin
  const validation = validateOaPlugin(pkgJson);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Resolve bin
  const binResolution = resolveBin(pkgJson);
  if (!binResolution) {
    return { success: false, error: "Package has no bin field defined" };
  }

  // Create registry entry
  const entry: RegistryEntry = {
    name: pkgJson.name,
    version: pkgJson.version,
    installedAt: new Date().toISOString(),
    binName: binResolution.binName,
    binPath: binResolution.binPath,
    inputMapping: pkgJson.oa.inputMapping,
    description: pkgJson.oa.description,
  };

  // Add to registry
  addEntry(entry);

  return { success: true, entry };
}

export function installLocalAgent(agentName: string): { success: boolean; error?: string; entry?: RegistryEntry } {
  const localAgentPath = path.join(OPENARMY_ROOT, "agents", agentName);
  const pkgJsonPath = path.join(localAgentPath, "package.json");

  if (!fileExists(pkgJsonPath)) {
    return { success: false, error: `Local agent ${agentName} not found` };
  }

  let pkgJson: PluginPackageJson;
  try {
    pkgJson = readJsonFile<PluginPackageJson>(pkgJsonPath);
  } catch (err) {
    return { success: false, error: `Failed to parse package.json: ${err instanceof Error ? err.message : String(err)}` };
  }

  // Validate oa plugin
  const validation = validateOaPlugin(pkgJson);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Resolve bin from local path
  const { name, bin } = pkgJson;
  if (!bin) {
    return { success: false, error: "Package has no bin field defined" };
  }

  let binName: string;
  let binPath: string;

  if (typeof bin === "string") {
    binName = name;
    binPath = bin;
  } else {
    const binNames = Object.keys(bin);
    if (binNames.length === 0) {
      return { success: false, error: "Package has no bin field defined" };
    }
    binName = binNames[0];
    binPath = bin[binName];
  }

  const absoluteBinPath = path.join(localAgentPath, binPath);

  // Create registry entry with local agent path
  const entry: RegistryEntry = {
    name: pkgJson.name,
    version: pkgJson.version,
    installedAt: new Date().toISOString(),
    binName: binName,
    binPath: absoluteBinPath,
    inputMapping: pkgJson.oa.inputMapping,
    description: pkgJson.oa.description,
  };

  // Add to registry
  addEntry(entry);

  return { success: true, entry };
}

export function installDefaultAgents(): void {
  const defaultAgents = ["oa-transform", "oa-count", "oa-base64", "oa-json"];

  // Create packages directory
  ensureDir(OA_PACKAGES_DIR);

  for (const agent of defaultAgents) {
    // Try local installation first
    const localResult = installLocalAgent(agent);
    if (localResult.success) {
      continue;
    }

    // Fall back to npm installation (silently fail if not available)
    installPlugin(agent);
  }
}
