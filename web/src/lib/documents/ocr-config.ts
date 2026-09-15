import path from "node:path";
import os from "node:os";

export function resolveOcrWorkerPath(projectRoot = process.cwd()) {
  return path.join(projectRoot, "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js");
}

export function resolveOcrCachePath(homeDirectory = os.homedir()) {
  return path.join(homeDirectory, "Library", "Caches", "Olympus Campus", "Tesseract");
}
