#!/usr/bin/env node

const args = process.argv.slice(2);
let input = "";

// Parse --input flag
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--input=")) {
    input = args[i].substring("--input=".length);
    break;
  } else if (args[i] === "--input" && i + 1 < args.length) {
    input = args[i + 1];
    break;
  }
}

// Also check positional argument
if (!input && args.length > 0 && !args[0].startsWith("--")) {
  input = args[0];
}

console.log(input);
