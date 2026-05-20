import fs from "fs";
import path from "path";
import { forbidden, validationError } from "../runtime/errors.js";

export class WorkspacePathGuard {
  resolve(workspaceRoot: string, requestedPath: string): string {
    if (!requestedPath || requestedPath.includes("\0")) {
      throw validationError("path must be a non-empty string");
    }

    // Resolve the root via realpathSync so OS-level symlinks (e.g. /tmp → /private/tmp
    // on macOS) don't cause false-positive containment failures.
    const resolvedRoot = fs.existsSync(workspaceRoot)
      ? fs.realpathSync(path.resolve(workspaceRoot))
      : path.resolve(workspaceRoot);

    const resolvedPath = path.resolve(resolvedRoot, requestedPath);
    this.assertInsideRoot(resolvedPath, resolvedRoot);

    if (fs.existsSync(resolvedPath)) {
      const real = fs.realpathSync(resolvedPath);
      this.assertInsideRoot(real, resolvedRoot);
    } else {
      const dir = path.dirname(resolvedPath);
      if (fs.existsSync(dir)) {
        const realDir = fs.realpathSync(dir);
        this.assertInsideRoot(realDir, resolvedRoot);
      }
    }

    return resolvedPath;
  }

  private assertInsideRoot(resolvedPath: string, resolvedRoot: string): void {
    const inside =
      resolvedPath === resolvedRoot || resolvedPath.startsWith(`${resolvedRoot}${path.sep}`);
    if (!inside) {
      throw forbidden("filesystem access outside the assigned workspace is not allowed");
    }
  }
}
