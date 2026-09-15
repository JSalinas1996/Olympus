import type { AIEffort, AIModelSelection, AIProvider } from "./model-options";

export type ConfigurationOrigin = "trabajo" | "materia" | "general" | "sin configurar";

export type SettingsLevel = {
  developmentPrompt?: string | null;
  correctionPrompt?: string | null;
  studyReportPrompt?: string | null;
  claudeModel?: string | null;
  claudeEffort?: string | null;
  chatgptModel?: string | null;
  chatgptEffort?: string | null;
};

export type ResolvedValue = { value: string; origin: ConfigurationOrigin };
export type EffectiveAISettings = {
  developmentPrompt: ResolvedValue;
  correctionPrompt: ResolvedValue;
  studyReportPrompt: ResolvedValue;
  claudeModel: ResolvedValue;
  claudeEffort: ResolvedValue;
  chatgptModel: ResolvedValue;
  chatgptEffort: ResolvedValue;
};

export const DEFAULT_AI_SETTINGS: SettingsLevel = {
  developmentPrompt: "",
  correctionPrompt: "",
  studyReportPrompt: "",
  claudeModel: "Opus 5",
  claudeEffort: "medium",
  chatgptModel: "GPT-5.5",
  chatgptEffort: "medium",
};

function present(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function resolveValue(assignment: string | null | undefined, subject: string | null | undefined, general: string | null | undefined): ResolvedValue {
  const assignmentValue = present(assignment);
  if (assignmentValue) return { value: assignmentValue, origin: "trabajo" };
  const subjectValue = present(subject);
  if (subjectValue) return { value: subjectValue, origin: "materia" };
  const generalValue = present(general);
  if (generalValue) return { value: generalValue, origin: "general" };
  return { value: "", origin: "sin configurar" };
}

export function resolveAISettings(input: { general?: SettingsLevel | null; subject?: SettingsLevel | null; assignment?: SettingsLevel | null }): EffectiveAISettings {
  const { general = {}, subject = {}, assignment = {} } = input;
  return {
    developmentPrompt: resolveValue(assignment?.developmentPrompt, subject?.developmentPrompt, general?.developmentPrompt),
    correctionPrompt: resolveValue(assignment?.correctionPrompt, subject?.correctionPrompt, general?.correctionPrompt),
    studyReportPrompt: resolveValue(assignment?.studyReportPrompt, subject?.studyReportPrompt, general?.studyReportPrompt),
    claudeModel: resolveValue(assignment?.claudeModel, subject?.claudeModel, general?.claudeModel),
    claudeEffort: resolveValue(assignment?.claudeEffort, subject?.claudeEffort, general?.claudeEffort || "automatic"),
    chatgptModel: resolveValue(assignment?.chatgptModel, subject?.chatgptModel, general?.chatgptModel),
    chatgptEffort: resolveValue(assignment?.chatgptEffort, subject?.chatgptEffort, general?.chatgptEffort || "automatic"),
  };
}

export function nativeModelSelection(settings: EffectiveAISettings, provider: AIProvider): AIModelSelection {
  const model = provider === "claude" ? settings.claudeModel.value : settings.chatgptModel.value;
  const effort = provider === "claude" ? settings.claudeEffort.value : settings.chatgptEffort.value;
  return { provider, model, effort: effort as AIEffort };
}
