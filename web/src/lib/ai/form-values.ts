import { isEffort, type AIEffort, type AIProvider } from "./model-options";

export function modelFromForm(formData: FormData, prefix: string, required: boolean) {
  const choice = String(formData.get(`${prefix}ModelChoice`) ?? "").trim();
  const model = choice === "__custom__" ? String(formData.get(`${prefix}CustomModel`) ?? "").trim() : choice;
  if (required && !model) throw new Error("Seleccioná un modelo para cada IA.");
  if (model.length > 120) throw new Error("El nombre del modelo es demasiado largo.");
  return model;
}

export function effortFromForm(formData: FormData, prefix: string, provider: AIProvider, required: boolean): AIEffort | "" {
  const value = String(formData.get(`${prefix}Effort`) ?? "");
  if (!value && !required) return "";
  if (!isEffort(value) || (provider === "claude" && value === "xhigh")) throw new Error("El nivel de esfuerzo seleccionado no es válido.");
  return value;
}
