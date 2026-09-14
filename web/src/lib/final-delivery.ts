const mimeByExtension = {
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

export function scoreFromEvaluation(evaluation: string) {
  const matches = [...evaluation.matchAll(/calificaci[oó]n\s*:\s*(10|[0-9](?:[.,][0-9]+)?)\s*(?:\/|sobre)\s*10/gi)];
  return matches.length ? Number(matches.at(-1)![1].replace(",", ".")) : null;
}

export function validateFinalDelivery(name: string, size: number, evaluation: string) {
  const extension = name.toLowerCase().slice(name.lastIndexOf(".")) as keyof typeof mimeByExtension;
  if (!(extension in mimeByExtension)) throw new Error("La entrega final debe ser Word (.docx) o Excel (.xlsx).");
  if (size <= 0 || size > 40 * 1024 * 1024) throw new Error("El archivo final está vacío o supera los 40 MB.");
  if (scoreFromEvaluation(evaluation) !== 10) throw new Error("La entrega sólo puede publicarse cuando ChatGPT indique CALIFICACIÓN: 10/10.");
  return { extension, mimeType: mimeByExtension[extension] };
}

type FinalFileInfo = { name: string; size: number };

export function validateFinalDeliverySet(files: FinalFileInfo[], rawFormats: unknown, evaluation: string) {
  if (!Array.isArray(rawFormats) || rawFormats.length === 0) throw new Error("Seleccioná Word, Excel o ambos formatos.");
  const formats = [...new Set(rawFormats.map(format => String(format).toLowerCase()))];
  if (formats.some(format => format !== "docx" && format !== "xlsx")) throw new Error("La entrega incluye un formato no permitido.");
  if (scoreFromEvaluation(evaluation) !== 10) throw new Error("La entrega sólo puede publicarse cuando ChatGPT indique CALIFICACIÓN: 10/10.");

  const checked = files.map(file => ({ file, ...validateFinalDelivery(file.name, file.size, evaluation) }));
  for (const item of checked) {
    const format = item.extension.slice(1);
    if (!formats.includes(format)) throw new Error(`El archivo ${item.file.name} tiene un formato no solicitado.`);
  }
  for (const format of formats) {
    const extension = `.${format}`;
    const count = checked.filter(item => item.extension === extension).length;
    const label = format === "docx" ? "Word" : "Excel";
    if (count === 0) throw new Error(`Falta el archivo ${label} solicitado.`);
    if (count !== 1) throw new Error(`La entrega debe contener exactamente un archivo ${label}.`);
  }
  if (checked.length !== formats.length) throw new Error("La entrega contiene archivos adicionales.");
  return checked.map(({ extension, mimeType }) => ({ extension, mimeType }));
}
