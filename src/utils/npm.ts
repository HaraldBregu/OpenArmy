import { spawnSync } from "child_process";

export function npmInstall(
  prefix: string,
  packageName: string
): { success: boolean; error?: string } {
  const result = spawnSync("npm", ["install", "--prefix", prefix, packageName], {
    stdio: "pipe",
    encoding: "utf-8",
  });

  if (result.error) {
    return { success: false, error: result.error.message };
  }

  if (result.status !== 0) {
    return {
      success: false,
      error: result.stderr || `npm install failed with status ${result.status}`,
    };
  }

  return { success: true };
}

export function npmUninstall(prefix: string, packageName: string): boolean {
  const result = spawnSync("npm", ["uninstall", "--prefix", prefix, packageName], {
    stdio: "pipe",
    encoding: "utf-8",
  });

  return result.status === 0;
}

export function npmList(prefix: string): { success: boolean; packages?: Record<string, string>; error?: string } {
  const result = spawnSync(
    "npm",
    ["list", "--prefix", prefix, "--json"],
    {
      stdio: "pipe",
      encoding: "utf-8",
    }
  );

  if (result.status !== 0) {
    return { success: false, error: result.stderr || "npm list failed" };
  }

  try {
    const json = JSON.parse(result.stdout);
    return { success: true, packages: json.dependencies || {} };
  } catch {
    return { success: false, error: "Failed to parse npm list output" };
  }
}
