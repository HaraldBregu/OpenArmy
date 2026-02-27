import { spawnSync } from "child_process";
import { ResolvedPlugin } from "../types.js";

export function buildArgs(inputValue: string, plugin: ResolvedPlugin): string[] {
  const { inputMapping } = plugin;

  switch (inputMapping.type) {
    case "flag": {
      const flag = inputMapping.flag!;
      return [`${flag}=${inputValue}`];
    }
    case "positional": {
      const position = inputMapping.position!;
      const args: string[] = [];
      for (let i = 0; i < position; i++) {
        args.push("");
      }
      args.push(inputValue);
      return args.filter(arg => arg !== "" || args.indexOf(arg) >= position);
    }
    case "stdin": {
      // stdin type doesn't add args, input goes via stdin
      return [];
    }
    default: {
      return [];
    }
  }
}

export function runPlugin(
  binPath: string,
  plugin: ResolvedPlugin,
  inputValue: string
): { success: boolean; output?: string; error?: string; exitCode?: number } {
  const args = buildArgs(inputValue, plugin);

  const result = spawnSync("node", [binPath, ...args], {
    input: plugin.inputMapping.type === "stdin" ? inputValue : undefined,
    stdio: ["pipe", "inherit", "inherit"],
    encoding: "utf-8",
  });

  if (result.error) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  return {
    success: result.status === 0,
    exitCode: result.status ?? undefined,
  };
}
