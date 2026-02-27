#!/usr/bin/env node

import { Command } from "commander";
import { addCommand } from "./commands/add.js";
import { runCommand } from "./commands/run.js";
import { listCommand } from "./commands/list.js";
import { removeCommand } from "./commands/remove.js";
import { initCommand } from "./commands/init.js";

const program = new Command();

program
  .name("oa")
  .description("OpenArmy - CLI tool for managing oa-compatible plugins")
  .version("1.0.0");

program.addCommand(initCommand);
program.addCommand(addCommand);
program.addCommand(runCommand);
program.addCommand(listCommand);
program.addCommand(removeCommand);

program.parse(process.argv);

if (process.argv.length === 2) {
  program.outputHelp();
}
