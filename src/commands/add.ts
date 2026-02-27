import { Command } from "commander";
import { installPlugin } from "../core/installer.js";
import { logger } from "../utils/logger.js";

export const addCommand = new Command("add")
  .description("Install an oa-compatible npm package")
  .argument("<package>", "Package name or path to install")
  .action((packageName: string) => {
    logger.info(`Installing ${packageName}...`);

    const result = installPlugin(packageName);

    if (!result.success) {
      logger.error(result.error || "Installation failed");
      process.exit(1);
    }

    const entry = result.entry!;
    logger.success(`Installed ${entry.name}@${entry.version}`);
    logger.info(`Description: ${entry.description}`);
  });
