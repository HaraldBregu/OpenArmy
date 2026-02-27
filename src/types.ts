export type InputMappingType = "flag" | "stdin" | "positional";

export interface InputMapping {
  type: InputMappingType;
  flag?: string;      // required only when type === "flag"
  position?: number;  // required only when type === "positional"
}

export interface OaPluginField {
  description: string;
  inputMapping: InputMapping;
}

export interface PluginPackageJson {
  name: string;
  version: string;
  bin?: Record<string, string> | string;
  oa: OaPluginField;
}

export interface RegistryEntry {
  name: string;
  version: string;
  installedAt: string;
  binName: string;
  binPath: string;
  inputMapping: InputMapping;
  description: string;
}

export interface Registry {
  version: 1;
  packages: Record<string, RegistryEntry>;
}

export interface ResolvedPlugin {
  binPath: string;
  inputMapping: InputMapping;
  packageName: string;
}
