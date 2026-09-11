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
