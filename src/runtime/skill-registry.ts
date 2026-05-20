import fs from "fs";
import path from "path";
import { LoadedSkillContext, SkillDefinition } from "../types.js";
import { notFound, validationError } from "./errors.js";
import { ensureDir, pathExists } from "./json-store.js";

interface SkillManifest {
  id?: string;
  name?: string;
  description?: string;
  version?: string;
  triggers?: string[];
  requiredTools?: string[];
}

export class SkillRegistry {
  private readonly skills = new Map<string, SkillDefinition>();

  constructor(private readonly skillDirectories: string[] = []) {}

  discover(): SkillDefinition[] {
    for (const directory of this.skillDirectories) {
      ensureDir(directory);
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue;
        }

        const sourcePath = path.join(directory, entry.name);
        const skillFile = path.join(sourcePath, "SKILL.md");
        if (!pathExists(skillFile)) {
          continue;
        }

        const manifest = this.readManifest(sourcePath);
        this.register({
          id: manifest.id ?? entry.name,
          name: manifest.name ?? entry.name,
          description: manifest.description ?? "Local OpenArmy skill",
          version: manifest.version ?? "0.0.0",
          sourcePath,
          triggers: manifest.triggers ?? [],
          requiredTools: manifest.requiredTools ?? [],
        });
      }
    }

    return this.list();
  }

  register(skill: SkillDefinition): SkillDefinition {
    if (!skill.id.trim()) {
      throw validationError("skill id is required");
    }

    if (!pathExists(path.join(skill.sourcePath, "SKILL.md"))) {
      throw validationError(`skill ${skill.id} must include SKILL.md`);
    }

    this.skills.set(skill.id, skill);
    return skill;
  }

  list(): SkillDefinition[] {
    return [...this.skills.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  get(id: string): SkillDefinition {
    const skill = this.skills.get(id);
    if (!skill) {
      throw notFound("Skill", id);
    }

    return skill;
  }

  load(id: string, maxBytes = 64 * 1024): LoadedSkillContext {
    const definition = this.get(id);
    const skillFile = path.join(definition.sourcePath, "SKILL.md");
    const stats = fs.statSync(skillFile);
    if (stats.size > maxBytes) {
      throw validationError(`skill ${id} exceeds load limit of ${maxBytes} bytes`);
    }

    return {
      definition,
      instructions: fs.readFileSync(skillFile, "utf8"),
      loadedAt: new Date().toISOString(),
    };
  }

  private readManifest(sourcePath: string): SkillManifest {
    const manifestPath = path.join(sourcePath, "skill.json");
    if (!pathExists(manifestPath)) {
      return {};
    }

    return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as SkillManifest;
  }
}
