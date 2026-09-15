import { describe, expect, it } from "vitest";
import { nativeModelSelection, resolveAISettings } from "./settings";

describe("resolveAISettings", () => {
  const general = {
    developmentPrompt: "general development",
    correctionPrompt: "general correction",
    studyReportPrompt: "general report",
    claudeModel: "Opus 5",
    claudeEffort: "medium",
    chatgptModel: "GPT-5.5",
    chatgptEffort: "high",
  };

  it("uses assignment, then subject, then general values", () => {
    const result = resolveAISettings({
      general,
      subject: { developmentPrompt: "subject development", claudeModel: "Sonnet 5" },
      assignment: { developmentPrompt: "assignment development", chatgptEffort: "xhigh" },
    });
    expect(result.developmentPrompt).toEqual({ value: "assignment development", origin: "trabajo" });
    expect(result.claudeModel).toEqual({ value: "Sonnet 5", origin: "materia" });
    expect(result.studyReportPrompt).toEqual({ value: "general report", origin: "general" });
    expect(result.chatgptEffort).toEqual({ value: "xhigh", origin: "trabajo" });
  });

  it("treats blank overrides as inherited values", () => {
    const result = resolveAISettings({ general, subject: { developmentPrompt: "  " }, assignment: { claudeModel: "" } });
    expect(result.developmentPrompt.origin).toBe("general");
    expect(result.claudeModel.origin).toBe("general");
  });

  it("marks a missing required model as unconfigured", () => {
    const result = resolveAISettings({ general: { claudeEffort: "automatic", chatgptEffort: "automatic" } });
    expect(result.claudeModel).toEqual({ value: "", origin: "sin configurar" });
    expect(result.chatgptModel).toEqual({ value: "", origin: "sin configurar" });
  });

  it("builds the native contract", () => {
    const result = resolveAISettings({ general });
    expect(nativeModelSelection(result, "claude")).toEqual({ provider: "claude", model: "Opus 5", effort: "medium" });
  });
});
