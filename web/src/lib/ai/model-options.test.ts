import { describe, expect, it } from "vitest";
import { buildAIModelSelection, modelLabelsMatch, modelPreferenceLabel, normalizeModelLabel, parseModelPreference } from "./model-options";

describe("model preferences", () => {
  it("normalizes case, accents and whitespace", () => {
    expect(normalizeModelLabel("  ÓPUS   5 ")).toBe("opus 5");
    expect(modelLabelsMatch("Opus 5", "OPUS 5")).toBe(true);
  });

  it("maps historical Claude versions to a stable family", () => {
    expect(parseModelPreference("claude", "Opus 5")).toEqual({
      mode: "family",
      model: "opus",
      storedValue: "family:opus",
      label: "Opus · última versión disponible",
    });
    expect(parseModelPreference("claude", "Opus 5.5").model).toBe("opus");
  });

  it("maps historical ChatGPT versions without changing families", () => {
    expect(parseModelPreference("chatgpt", "GPT-6 Astra").model).toBe("astra");
    expect(parseModelPreference("chatgpt", "GPT-5.6 Sol").model).toBe("sol");
    expect(parseModelPreference("chatgpt", "GPT-5.5").model).toBe("gpt");
  });

  it("keeps unknown custom models exact", () => {
    expect(parseModelPreference("claude", "Modelo privado 7")).toEqual({
      mode: "exact",
      model: "Modelo privado 7",
      storedValue: "Modelo privado 7",
      label: "Modelo privado 7",
    });
  });

  it("builds the native family contract and a readable label", () => {
    expect(buildAIModelSelection("claude", "Opus 5", "high")).toEqual({ provider: "claude", modelMode: "family", model: "opus", effort: "high" });
    expect(modelPreferenceLabel("claude", "family:opus")).toBe("Opus · última versión disponible");
  });
});
