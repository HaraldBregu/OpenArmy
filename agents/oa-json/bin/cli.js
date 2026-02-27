#!/usr/bin/env node

const args = process.argv.slice(2);
let mode = "format"; // default: pretty format

// Parse mode argument
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--mode=")) {
    mode = args[i].substring("--mode=".length);
  } else if (args[i] === "--mode" && i + 1 < args.length) {
    mode = args[i + 1];
  }
}

// Read from stdin
let input = "";
process.stdin.on("data", chunk => {
  input += chunk;
});

process.stdin.on("end", () => {
  try {
    const parsed = JSON.parse(input);
    let result;

    switch (mode.toLowerCase()) {
      case "format":
      case "pretty":
        result = JSON.stringify(parsed, null, 2);
        break;
      case "minify":
      case "compact":
        result = JSON.stringify(parsed);
        break;
      case "validate":
        console.log("✓ Valid JSON");
        process.exit(0);
        break;
      default:
        console.error(`Unknown mode: ${mode}. Use: format, minify, or validate`);
        process.exit(1);
    }

    console.log(result);
  } catch (err) {
    console.error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
});

// Handle timeout
setTimeout(() => {
  if (!input) {
    console.error("No input provided");
    process.exit(1);
  }
}, 100);
