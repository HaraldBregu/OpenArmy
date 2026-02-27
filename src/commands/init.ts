import { Command } from "commander";
import { installDefaultAgents } from "../core/installer.js";
import { logger } from "../utils/logger.js";
import { ensureDir } from "../utils/fs.js";
import { OA_HOME } from "../constants.js";

export const initCommand = new Command("init")
  .description("Initialize OpenArmy with default agents")
  .action(() => {
    logger.info("Initializing OpenArmy with default agents...");

    // Ensure OA_HOME directory exists
    ensureDir(OA_HOME);

    logger.info("Installing default agents (oa-transform, oa-count, oa-base64, oa-json)...");

    try {
      installDefaultAgents();
      logger.success("✓ Default agents installed successfully!");
      logger.info(`OpenArmy home: ${OA_HOME}`);
      logger.info("Run 'oa list' to see installed agents");
    } catch (err) {
      logger.error(`Failed to initialize: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });
