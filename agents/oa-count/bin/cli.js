#!/usr/bin/env node

const args = process.argv.slice(2);
let input = "";
let metric = "all"; // default: show all metrics

// Parse arguments
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--input=")) {
    input = args[i].substring("--input=".length);
  } else if (args[i] === "--input" && i + 1 < args.length) {
    input = args[i + 1];
  } else if (args[i].startsWith("--metric=")) {
    metric = args[i].substring("--metric=".length);
  } else if (args[i] === "--metric" && i + 1 < args.length) {
    metric = args[i + 1];
  } else if (!args[i].startsWith("--") && !input) {
    input = args[i];
  }
}

// Calculate metrics
const chars = input.length;
const words = input.trim().length === 0 ? 0 : input.trim().split(/\s+/).length;
const lines = input.length === 0 ? 0 : input.split("\n").length;

// Output based on metric
switch (metric.toLowerCase()) {
  case "chars":
  case "characters":
    console.log(chars);
    break;
  case "words":
    console.log(words);
    break;
  case "lines":
    console.log(lines);
    break;
  case "all":
  case "json":
    const result = {
      characters: chars,
      words: words,
      lines: lines
    };
    console.log(JSON.stringify(result));
    break;
  default:
    console.error(`Unknown metric: ${metric}. Use: chars, words, lines, all, or json`);
    process.exit(1);
}
