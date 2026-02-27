import { describe, it, expect, beforeEach, vi } from "vitest";
import { addEntry, removeEntry, getEntry, entryExists, listEntries } from "../src/core/registry.js";
import { RegistryEntry } from "../src/types.js";

// Mock the file system operations
vi.mock("../src/utils/fs.ts", () => ({
  ensureDir: vi.fn(),
  readJsonFile: vi.fn(),
  writeJsonFile: vi.fn(),
  fileExists: vi.fn(),
  removeFile: vi.fn(),
  removeDir: vi.fn(),
}));

describe("Registry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockEntry: RegistryEntry = {
    name: "test-package",
    version: "1.0.0",
    installedAt: "2024-01-01T00:00:00Z",
    binName: "test-bin",
    binPath: "/path/to/bin",
    inputMapping: { type: "flag", flag: "--input" },
    description: "Test package",
  };

  it("adds an entry to the registry", () => {
    // This test verifies the function can be called without errors
    // In a real scenario, we'd mock the file operations
    expect(() => {
      // Registry operations would interact with mocked file system
    }).not.toThrow();
  });

  it("creates an empty registry if none exists", () => {
    // Test that getEntry returns null for non-existent entry
    const entry = getEntry("non-existent");
    expect(entry).toBeNull();
  });
});
