#!/usr/bin/env node

const args = process.argv.slice(2);
let input = "";
let mode = "encode"; // default: encode

// Parse arguments
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--input=")) {
    input = args[i].substring("--input=".length);
  } else if (args[i] === "--input" && i + 1 < args.length) {
    input = args[i + 1];
  } else if (args[i].startsWith("--mode=")) {
    mode = args[i].substring("--mode=".length);
  } else if (args[i] === "--mode" && i + 1 < args.length) {
    mode = args[i + 1];
  } else if (!args[i].startsWith("--") && !input) {
    input = args[i];
  }
}

try {
  let result;
  switch (mode.toLowerCase()) {
    case "encode":
      result = Buffer.from(input).toString("base64");
      break;
    case "decode":
      result = Buffer.from(input, "base64").toString("utf-8");
      break;
    default:
      console.error(`Unknown mode: ${mode}. Use: encode or decode`);
      process.exit(1);
  }
  console.log(result);
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
