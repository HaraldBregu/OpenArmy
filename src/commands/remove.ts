import { Command } from "commander";
import { removeEntry, entryExists } from "../core/registry.js";
import { npmUninstall } from "../utils/npm.js";
import { OA_PACKAGES_DIR } from "../constants.js";
import { logger } from "../utils/logger.js";

export const removeCommand = new Command("remove")
  .description("Remove an installed plugin")
  .argument("<package>", "Package name to remove")
  .action((packageName: string) => {
    if (!entryExists(packageName)) {
      logger.error(`Plugin '${packageName}' not found`);
      process.exit(1);
    }

    // Remove from npm
    const uninstalled = npmUninstall(OA_PACKAGES_DIR, packageName);

    if (!uninstalled) {
      logger.warn(`Failed to uninstall package from npm, but removing from registry`);
    }

    // Remove from registry
    removeEntry(packageName);

    logger.success(`Removed plugin '${packageName}'`);
  });
