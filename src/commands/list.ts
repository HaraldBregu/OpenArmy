import { Command } from "commander";
import { listEntries } from "../core/registry.js";
import { logger } from "../utils/logger.js";

export const listCommand = new Command("list")
  .description("List all installed plugins")
  .action(() => {
    const entries = listEntries();

    if (entries.length === 0) {
      logger.info("No plugins installed. Install one with: oa add <package>");
      return;
    }

    console.log("\nInstalled plugins:\n");
    entries.forEach((entry) => {
      console.log(`  ${entry.name}@${entry.version}`);
      console.log(`    Description: ${entry.description}`);
      console.log(`    Input Type: ${entry.inputMapping.type}`);
      if (entry.inputMapping.flag) {
        console.log(`    Flag: ${entry.inputMapping.flag}`);
      }
      if (entry.inputMapping.position !== undefined) {
        console.log(`    Position: ${entry.inputMapping.position}`);
      }
      console.log();
    });
  });
