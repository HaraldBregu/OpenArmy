import { ResolvedPlugin } from "../types.js";
import { getEntry, entryExists } from "./registry.js";

export function resolvePlugin(packageName: string): ResolvedPlugin | null {
  if (!entryExists(packageName)) {
    return null;
  }

  const entry = getEntry(packageName);
  if (!entry) {
    return null;
  }

  return {
    binPath: entry.binPath,
    inputMapping: entry.inputMapping,
    packageName: entry.name,
  };
}
