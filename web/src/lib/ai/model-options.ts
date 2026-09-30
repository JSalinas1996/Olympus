export type AIProvider = "claude" | "chatgpt";
export type AIEffort = "automatic" | "low" | "medium" | "high" | "xhigh" | "max";
export type AIModelMode = "family" | "exact";

export type AIModelSelection = {
  provider: AIProvider;
  modelMode: AIModelMode;
  model: string;
  effort: AIEffort;
};

export type AIModelOption = {
  value: string;
  family: string;
  label: string;
};

export type ParsedModelPreference = {
  mode: AIModelMode;
  model: string;
  storedValue: string;
  label: string;
};

export const CLAUDE_MODELS: readonly AIModelOption[] = [
  { value: "family:opus", family: "opus", label: "Opus · última versión disponible" },
  { value: "family:sonnet", family: "sonnet", label: "Sonnet · última versión disponible" },
] as const;

export const CHATGPT_MODELS: readonly AIModelOption[] = [
  { value: "family:astra", family: "astra", label: "Astra · última versión disponible" },
  { value: "family:sol", family: "sol", label: "Sol · última versión disponible" },
  { value: "family:terra", family: "terra", label: "Terra · última versión disponible" },
  { value: "family:luna", family: "luna", label: "Luna · última versión disponible" },
  { value: "family:gpt", family: "gpt", label: "GPT base · última versión disponible" },
] as const;

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

export function modelOptionsFor(provider: AIProvider): readonly AIModelOption[] {
  return provider === "claude" ? CLAUDE_MODELS : CHATGPT_MODELS;
}

function legacyFamily(provider: AIProvider, value: string) {
  const normalized = normalizeModelLabel(value);
  if (provider === "claude") {
    if (/\bopus\b/.test(normalized)) return "opus";
    if (/\bsonnet\b/.test(normalized)) return "sonnet";
    return null;
  }
  for (const family of ["astra", "sol", "terra", "luna"]) {
    if (new RegExp(`\\b${family}\\b`).test(normalized)) return family;
  }
  if (/^gpt(?:[-\s]+\d+(?:\.\d+)*)?$/.test(normalized)) return "gpt";
  return null;
}

export function parseModelPreference(provider: AIProvider, rawValue: string | null | undefined): ParsedModelPreference {
  const value = rawValue?.trim() ?? "";
  const options = modelOptionsFor(provider);
  if (value.startsWith("family:")) {
    const family = normalizeModelLabel(value.slice("family:".length));
    const option = options.find(candidate => candidate.family === family);
    if (option) return { mode: "family", model: option.family, storedValue: option.value, label: option.label };
  }
  const family = legacyFamily(provider, value);
  const option = family ? options.find(candidate => candidate.family === family) : null;
  if (option) return { mode: "family", model: option.family, storedValue: option.value, label: option.label };
  return { mode: "exact", model: value, storedValue: value, label: value };
}

export function modelPreferenceLabel(provider: AIProvider, value: string | null | undefined) {
  return parseModelPreference(provider, value).label;
}

export function buildAIModelSelection(provider: AIProvider, value: string, effort: string): AIModelSelection {
  const preference = parseModelPreference(provider, value);
  return {
    provider,
    modelMode: preference.mode,
    model: preference.model,
    effort: isEffort(effort) ? effort : "automatic",
  };
}

export function effortOptionsFor(provider: AIProvider): AIEffort[] {
  return provider === "claude"
    ? ["automatic", "low", "medium", "high", "max"]
    : ["automatic", "low", "medium", "high", "xhigh", "max"];
}

export function isEffort(value: unknown): value is AIEffort {
  return typeof value === "string" && Object.hasOwn(EFFORT_LABELS, value);
}
