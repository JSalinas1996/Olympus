export type AIProvider = "claude" | "chatgpt";
export type AIEffort = "automatic" | "low" | "medium" | "high" | "xhigh" | "max";

export type AIModelSelection = {
  provider: AIProvider;
  model: string;
  effort: AIEffort;
};

export const CLAUDE_MODELS = ["Opus 5", "Sonnet 5"] as const;
export const CHATGPT_MODELS = ["GPT-6 Astra", "GPT-5.6 Sol", "GPT-5.6 Terra", "GPT-5.6 Luna", "GPT-5.5"] as const;

export const EFFORT_LABELS: Record<AIEffort, string> = {
  automatic: "Automático",
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
  xhigh: "Muy alto",
  max: "Máx",
};

export function normalizeModelLabel(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("es");
}

export function modelLabelsMatch(actual: string, expected: string) {
  return Boolean(expected.trim()) && normalizeModelLabel(actual) === normalizeModelLabel(expected);
}

export function modelOptionsFor(provider: AIProvider): readonly string[] {
  return provider === "claude" ? CLAUDE_MODELS : CHATGPT_MODELS;
}

export function isEffort(value: unknown): value is AIEffort {
  return typeof value === "string" && Object.hasOwn(EFFORT_LABELS, value);
}
