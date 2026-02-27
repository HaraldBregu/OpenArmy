import { describe, it, expect } from "vitest";
import { validateOaPlugin } from "../src/core/installer.js";
import { PluginPackageJson } from "../src/types.js";

describe("validateOaPlugin", () => {
  it("validates a correct oa plugin", () => {
    const pkgJson: PluginPackageJson = {
      name: "test-plugin",
      version: "1.0.0",
      bin: { "test-bin": "./bin/cli.js" },
      oa: {
        description: "A test plugin",
        inputMapping: { type: "flag", flag: "--input" },
      },
    };

    const result = validateOaPlugin(pkgJson);
    expect(result.valid).toBe(true);
  });

  it("rejects package without oa field", () => {
    const pkgJson = {
      name: "test-plugin",
      version: "1.0.0",
    } as PluginPackageJson;

    const result = validateOaPlugin(pkgJson);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("missing 'oa' field");
  });

  it("rejects plugin without description", () => {
    const pkgJson: PluginPackageJson = {
      name: "test-plugin",
      version: "1.0.0",
      bin: { "test-bin": "./bin/cli.js" },
      oa: {
        description: "",
        inputMapping: { type: "flag", flag: "--input" },
      },
    };

    const result = validateOaPlugin(pkgJson);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("description");
  });

  it("rejects plugin with invalid inputMapping type", () => {
    const pkgJson: PluginPackageJson = {
      name: "test-plugin",
      version: "1.0.0",
      bin: { "test-bin": "./bin/cli.js" },
      oa: {
        description: "A test plugin",
        inputMapping: { type: "invalid" as any },
      },
    };

    const result = validateOaPlugin(pkgJson);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("must be one of");
  });

  it("rejects flag type without flag property", () => {
    const pkgJson: PluginPackageJson = {
      name: "test-plugin",
      version: "1.0.0",
      bin: { "test-bin": "./bin/cli.js" },
      oa: {
        description: "A test plugin",
        inputMapping: { type: "flag" },
      },
    };

    const result = validateOaPlugin(pkgJson);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("flag is required");
  });

  it("rejects positional type without position property", () => {
    const pkgJson: PluginPackageJson = {
      name: "test-plugin",
      version: "1.0.0",
      bin: { "test-bin": "./bin/cli.js" },
      oa: {
        description: "A test plugin",
        inputMapping: { type: "positional" },
      },
    };

    const result = validateOaPlugin(pkgJson);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("position is required");
  });

  it("validates stdin type without flag or position", () => {
    const pkgJson: PluginPackageJson = {
      name: "test-plugin",
      version: "1.0.0",
      bin: { "test-bin": "./bin/cli.js" },
      oa: {
        description: "A test plugin",
        inputMapping: { type: "stdin" },
      },
    };

    const result = validateOaPlugin(pkgJson);
    expect(result.valid).toBe(true);
  });
});
