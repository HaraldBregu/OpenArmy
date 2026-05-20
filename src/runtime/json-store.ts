import fs from "fs";
import path from "path";
import { JsonValue } from "../types.js";

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function pathExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!pathExists(filePath)) {
    return fallback;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.trim()) {
    return fallback;
  }

  return JSON.parse(raw) as T;
}

export function writeJsonFile(filePath: string, value: JsonValue | unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function appendJsonLine(filePath: string, value: JsonValue | unknown): void {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

export function readJsonLines<T>(filePath: string): T[] {
  if (!pathExists(filePath)) {
    return [];
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export function safeRemoveFile(filePath: string): void {
  if (pathExists(filePath)) {
    fs.unlinkSync(filePath);
  }
}
