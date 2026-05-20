import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { createRuntime } from "../src/runtime/create-runtime.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), ".openarmy-skill-test-"));
  roots.push(root);
  return root;
}

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("SkillRegistry.install", () => {
  it("creates SKILL.md and skill.json in the skills directory", () => {
    const root = tempRoot();
    const bundle = createRuntime({ workspaceRoot: root, scheduler: { enabled: false } });

    const skill = bundle.skillRegistry.install("My Test Skill");

    expect(skill.id).toBe("my-test-skill");
    expect(skill.name).toBe("My Test Skill");
    expect(skill.version).toBe("1.0.0");

    const skillRoot = path.join(root, "skills", "my-test-skill");
    expect(fs.existsSync(path.join(skillRoot, "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(skillRoot, "skill.json"))).toBe(true);

    const md = fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");
    expect(md).toContain("My Test Skill");

    const manifest = JSON.parse(fs.readFileSync(path.join(skillRoot, "skill.json"), "utf8")) as { id: string };
    expect(manifest.id).toBe("my-test-skill");
  });

  it("makes the installed skill available through list()", () => {
    const root = tempRoot();
    const bundle = createRuntime({ workspaceRoot: root, scheduler: { enabled: false } });

    bundle.skillRegistry.install("Reporting");
    const found = bundle.skillRegistry.list().find((s) => s.id === "reporting");
    expect(found).toBeDefined();
    expect(found?.name).toBe("Reporting");
  });

  it("makes the installed skill loadable", () => {
    const root = tempRoot();
    const bundle = createRuntime({ workspaceRoot: root, scheduler: { enabled: false } });

    bundle.skillRegistry.install("Report Writer");
    const loaded = bundle.skillRegistry.load("report-writer");
    expect(loaded.definition.id).toBe("report-writer");
    expect(loaded.instructions).toContain("Report Writer");
  });

  it("throws when the skill already exists", () => {
    const root = tempRoot();
    const bundle = createRuntime({ workspaceRoot: root, scheduler: { enabled: false } });

    bundle.skillRegistry.install("Duplicate Skill");
    expect(() => bundle.skillRegistry.install("Duplicate Skill")).toThrow(/already exists/);
  });

  it("persists the skill across new SkillRegistry instances via discover()", () => {
    const root = tempRoot();
    const first = createRuntime({ workspaceRoot: root, scheduler: { enabled: false } });
    first.skillRegistry.install("Persistent Skill");

    const second = createRuntime({ workspaceRoot: root, scheduler: { enabled: false } });
    const found = second.skillRegistry.list().find((s) => s.id === "persistent-skill");
    expect(found).toBeDefined();
  });
});
