import path from "path";
import os from "os";

export const OA_HOME = path.join(os.homedir(), ".oa");
export const OA_PACKAGES_DIR = path.join(OA_HOME, "packages");
export const OA_REGISTRY_PATH = path.join(OA_HOME, "registry.json");
