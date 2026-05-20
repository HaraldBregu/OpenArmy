import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspacePathGuard } from "../src/tools/workspace-path-guard.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("WorkspacePathGuard", () => {
  it("resolves valid paths inside the workspace", () => {
    const root = tempRoot();
    const guard = new WorkspacePathGuard();
    const resolved = guard.resolve(root, "subdir/file.txt");
    expect(resolved).toBe(path.join(root, "subdir", "file.txt"));
  });

  it("allows the workspace root itself", () => {
    const root = tempRoot();
    const guard = new WorkspacePathGuard();
    expect(guard.resolve(root, ".")).toBe(path.resolve(root));
  });

  it("rejects path traversal outside the workspace", () => {
    const root = tempRoot();
    const guard = new WorkspacePathGuard();
    expect(() => guard.resolve(root, "../secret")).toThrow(/outside the assigned workspace/);
    expect(() => guard.resolve(root, "../../etc/passwd")).toThrow(/outside the assigned workspace/);
  });

  it("rejects null bytes", () => {
    const root = tempRoot();
    const guard = new WorkspacePathGuard();
    expect(() => guard.resolve(root, "file\0name")).toThrow(/non-empty string/);
  });

  it("rejects empty path", () => {
    const root = tempRoot();
    const guard = new WorkspacePathGuard();
    expect(() => guard.resolve(root, "")).toThrow(/non-empty string/);
  });

  it("rejects symlinks that point outside the workspace", () => {
    const root = tempRoot();
    const outside = tempRoot();
    const outsideFile = path.join(outside, "secret.txt");
    fs.writeFileSync(outsideFile, "secret", "utf8");

    const symlinkPath = path.join(root, "link");
    fs.symlinkSync(outside, symlinkPath);

    const guard = new WorkspacePathGuard();
    expect(() => guard.resolve(root, "link")).toThrow(/outside the assigned workspace/);
  });

  it("allows real paths that resolve inside the workspace", () => {
    const root = tempRoot();
    fs.mkdirSync(path.join(root, "real"), { recursive: true });
    fs.writeFileSync(path.join(root, "real", "file.txt"), "data", "utf8");

    const symlinkPath = path.join(root, "link");
    fs.symlinkSync(path.join(root, "real"), symlinkPath);

    const guard = new WorkspacePathGuard();
    expect(() => guard.resolve(root, "link/file.txt")).not.toThrow();
  });
});

function tempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), ".openarmy-guard-test-"));
  roots.push(root);
  return root;
}
