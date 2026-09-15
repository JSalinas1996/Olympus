const maxLogoBytes = 10 * 1024 * 1024;
const allowedLogoTypes = new Set(["image/png", "image/jpeg"]);

export function validateLogoFile(name: string, size: number, mimeType: string) {
  const extension = name.toLocaleLowerCase("es").match(/\.(png|jpe?g)$/)?.[0];
  if (!extension || !allowedLogoTypes.has(mimeType)) throw new Error("El logo debe ser un archivo PNG o JPEG.");
  if (size <= 0) throw new Error("El logo está vacío.");
  if (size > maxLogoBytes) throw new Error("El logo supera el límite de 10 MB.");
  return { extension, mimeType };
}
