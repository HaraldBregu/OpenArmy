#!/usr/bin/env node

const args = process.argv.slice(2);
let input = "";
let mode = "upper"; // default mode

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

// Transform based on mode
let result;
switch (mode.toLowerCase()) {
  case "upper":
  case "uppercase":
    result = input.toUpperCase();
    break;
  case "lower":
  case "lowercase":
    result = input.toLowerCase();
    break;
  case "capitalize":
    result = input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
    break;
  case "reverse":
    result = input.split("").reverse().join("");
    break;
  case "title":
    result = input
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
    break;
  default:
    console.error(`Unknown mode: ${mode}. Use: upper, lower, capitalize, reverse, or title`);
    process.exit(1);
}

console.log(result);
