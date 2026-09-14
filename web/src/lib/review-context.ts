import type { MaterialCategory } from "./materials";

export type ReviewDocument = {
  name: string;
  category: MaterialCategory;
  text: string;
  teacherFeedback: string;
  url: string | null;
};

type ReviewContextInput = {
  subject: string;
  assignment: string;
  manualNotes: string;
  legacyText: string;
  documents: ReviewDocument[];
};

function renderDocuments(documents: ReviewDocument[], includeFeedback = false) {
  if (documents.length === 0) return "Sin archivos procesados en esta categoría.";
  return documents.map(document => {
    const sections = [`--- ${document.name} ---`, document.text.trim()];
    if (includeFeedback && document.teacherFeedback.trim()) sections.push(`CORRECCIONES DEL DOCENTE:\n${document.teacherFeedback.trim()}`);
    if (document.url) sections.push(`Fuente en Drive: ${document.url}`);
    return sections.join("\n");
  }).join("\n\n");
}

export function buildReviewContext(input: ReviewContextInput) {
  const byCategory = (category: MaterialCategory) => input.documents.filter(document => document.category === category);
  const sections = [
    "REGLAS DE USO DEL MATERIAL:\n- El enunciado, las consignas y la rúbrica actuales tienen prioridad.\n- Los módulos teóricos fundamentan la respuesta.\n- Los modelos anteriores sólo orientan sobre estructura y criterios de corrección; no deben copiarse.",
    `MATERIA: ${input.subject}\nTRABAJO: ${input.assignment}`,
    `ENUNCIADO + CONSIGNAS + RÚBRICA:\n${renderDocuments(byCategory("brief"))}`,
    `MÓDULOS TEÓRICOS:\n${renderDocuments(byCategory("theory"))}`,
    `MODELOS ANTERIORES:\n${renderDocuments(byCategory("models"), true)}`,
  ];
  if (input.manualNotes.trim()) sections.push(`NOTAS MANUALES:\n${input.manualNotes.trim()}`);
  if (input.legacyText.trim()) sections.push(`INFORMACIÓN ANTERIOR:\n${input.legacyText.trim()}`);
  return sections.join("\n\n");
}
