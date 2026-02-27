import { Registry, RegistryEntry } from "../types.js";
import { OA_REGISTRY_PATH } from "../constants.js";
import { readJsonFile, writeJsonFile, fileExists, ensureDir } from "../utils/fs.js";
import path from "path";

export function loadRegistry(): Registry {
  if (!fileExists(OA_REGISTRY_PATH)) {
    return { version: 1, packages: {} };
  }

  try {
    return readJsonFile<Registry>(OA_REGISTRY_PATH);
  } catch {
    // If corrupted, return empty registry
    return { version: 1, packages: {} };
  }
}

export function saveRegistry(registry: Registry): void {
  const dir = path.dirname(OA_REGISTRY_PATH);
  ensureDir(dir);
  writeJsonFile(OA_REGISTRY_PATH, registry);
}

export function addEntry(entry: RegistryEntry): void {
  const registry = loadRegistry();
  registry.packages[entry.name] = entry;
  saveRegistry(registry);
}

export function removeEntry(packageName: string): void {
  const registry = loadRegistry();
  delete registry.packages[packageName];
  saveRegistry(registry);
}

export function getEntry(packageName: string): RegistryEntry | null {
  const registry = loadRegistry();
  return registry.packages[packageName] || null;
}

export function listEntries(): RegistryEntry[] {
  const registry = loadRegistry();
  return Object.values(registry.packages);
}

export function entryExists(packageName: string): boolean {
  const registry = loadRegistry();
  return packageName in registry.packages;
}
