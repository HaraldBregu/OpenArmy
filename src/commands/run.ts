import { Command } from "commander";
import { resolvePlugin } from "../core/resolver.js";
import { runPlugin } from "../core/runner.js";
import { logger } from "../utils/logger.js";

export const runCommand = new Command("run")
  .description("Run an installed plugin with input")
  .argument("<package>", "Package name to run")
  .option("--input <value>", "Input value for the plugin")
  .action((packageName: string, options: { input?: string }) => {
    const plugin = resolvePlugin(packageName);

    if (!plugin) {
      logger.error(`Plugin '${packageName}' not found. Install it with: oa add ${packageName}`);
      process.exit(1);
    }

    const inputValue = options.input || "";

    const result = runPlugin(plugin.binPath, plugin, inputValue);

    if (!result.success) {
      if (result.error) {
        logger.error(result.error);
      }
      process.exit(result.exitCode || 1);
    }
  });
