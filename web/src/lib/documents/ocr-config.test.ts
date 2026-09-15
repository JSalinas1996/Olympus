import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveOcrCachePath, resolveOcrWorkerPath } from "./ocr-config";

describe("OCR worker configuration", () => {
  it("resolves the installed Node worker instead of a bundled placeholder", () => {
    const workerPath = resolveOcrWorkerPath();
    expect(workerPath).not.toContain("/ROOT/");
    expect(existsSync(workerPath)).toBe(true);
  });

  it("keeps the language cache outside the repository", () => {
    expect(resolveOcrCachePath("/Users/test")).toBe("/Users/test/Library/Caches/Olympus Campus/Tesseract");
  });
});
