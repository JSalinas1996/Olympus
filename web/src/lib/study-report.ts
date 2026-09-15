import { strFromU8, unzipSync } from "fflate";

const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function validateStudyReportFile(name: string, size: number) {
  if (!name.toLocaleLowerCase("es").endsWith(".docx")) throw new Error("El informe técnico debe ser un archivo Word (.docx).");
  if (size <= 0) throw new Error("El informe técnico está vacío.");
  if (size > 40 * 1024 * 1024) throw new Error("El informe técnico supera el límite de 40 MB.");
  return { mimeType: docxMime };
}

export function validateStudyReportPackage(bytes: Uint8Array) {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(bytes); } catch { throw new Error("El Word del informe está dañado o no puede abrirse."); }
  const document = files["word/document.xml"];
  if (!document || !strFromU8(document).replace(/<[^>]+>/g, "").trim()) throw new Error("El Word del informe no contiene texto válido.");
  if (!Object.keys(files).some(name => name.startsWith("word/media/") && files[name].byteLength > 0)) throw new Error("El Word del informe no contiene el logo incorporado.");
  return { hasText: true, hasImage: true };
}

export function buildStudyReportPrompt(input: { reportPrompt: string; reviewContext: string; finalSections: { name: string; text: string }[] }) {
  const finalText = input.finalSections.map(file => `ARCHIVO FINAL — ${file.name}:\n${file.text}`).join("\n\n");
  return `${input.reportPrompt.trim()}\n\nActuá como redactor académico y generá un único documento Word editable (.docx) titulado “Informe técnico de estudio”. Usá el logo adjunto e insertalo dentro del documento. Basate exclusivamente en el contexto académico y la entrega final incluidos a continuación. No inventes datos, normas, fuentes, citas ni resultados. El archivo debe abrir correctamente, contener el informe completo y quedar listo para descargar. No generes PDF ni Excel.\n\nCONTEXTO ACADÉMICO DEL TP:\n${input.reviewContext.trim()}\n\nENTREGA FINAL APROBADA:\n${finalText}`;
}
