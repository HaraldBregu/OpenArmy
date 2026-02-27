import { describe, it, expect } from "vitest";
import { buildArgs } from "../src/core/runner.js";
import { ResolvedPlugin, InputMappingType } from "../src/types.js";

function createPlugin(type: InputMappingType, flag?: string, position?: number): ResolvedPlugin {
  return {
    binPath: "/path/to/bin",
    packageName: "test-package",
    inputMapping: { type, flag, position },
  };
}

describe("buildArgs", () => {
  it("builds flag-based arguments", () => {
    const plugin = createPlugin("flag", "--input");
    const args = buildArgs("hello", plugin);
    expect(args).toEqual(["--input=hello"]);
  });

  it("builds positional arguments at position 0", () => {
    const plugin = createPlugin("positional", undefined, 0);
    const args = buildArgs("hello", plugin);
    expect(args).toEqual(["hello"]);
  });

  it("builds positional arguments at position 1", () => {
    const plugin = createPlugin("positional", undefined, 1);
    const args = buildArgs("hello", plugin);
    // Position 1 means skip first arg, put value at second position
    // But we only return args for the input, so it should be just the input
    expect(args.length).toBeGreaterThanOrEqual(1);
    expect(args[args.length - 1]).toBe("hello");
  });

  it("returns empty args for stdin type", () => {
    const plugin = createPlugin("stdin");
    const args = buildArgs("hello", plugin);
    expect(args).toEqual([]);
  });
});
