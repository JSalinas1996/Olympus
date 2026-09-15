import { describe, expect, it } from "vitest";
import { modelLabelsMatch, normalizeModelLabel } from "./model-options";

describe("model labels", () => {
  it("normalizes case, accents and whitespace", () => {
    expect(normalizeModelLabel("  ÓPUS   5 ")).toBe("opus 5");
    expect(modelLabelsMatch("Opus 5", "OPUS 5")).toBe(true);
  });

  it("does not accept a different family or effort", () => {
    expect(modelLabelsMatch("Opus 5 Máx", "Opus 5 Medio")).toBe(false);
    expect(modelLabelsMatch("Sonnet 5", "Opus 5")).toBe(false);
  });
});
