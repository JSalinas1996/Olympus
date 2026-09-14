export type MaterialCategory = "brief" | "theory" | "models";

export const documentKindByCategory = {
  brief: "assignment",
  theory: "source",
  models: "precedent_work",
} as const;

export const acceptedMaterialExtensions = [
  ".pdf", ".doc", ".docx", ".xlsx", ".png", ".jpg", ".jpeg", ".heic", ".tif", ".tiff", ".txt", ".csv",
] as const;

export const maxMaterialBytes = 40 * 1024 * 1024;

export function materialCategoryForKind(kind: string): MaterialCategory | null {
  if (kind === "assignment" || kind === "rubric") return "brief";
  if (kind === "source") return "theory";
  if (kind === "precedent_work" || kind === "precedent_correction") return "models";
  return null;
}

export function isMaterialCategory(value: string): value is MaterialCategory {
  return value === "brief" || value === "theory" || value === "models";
}

export function validateMaterialFile(name: string, size: number) {
  const extension = name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  if (!acceptedMaterialExtensions.includes(extension as (typeof acceptedMaterialExtensions)[number])) {
    throw new Error(`El formato ${extension || "sin extensión"} no es compatible.`);
  }
  if (size <= 0) throw new Error("El archivo está vacío.");
  if (size > maxMaterialBytes) throw new Error("El archivo supera el límite de 40 MB.");
  return { extension };
}
