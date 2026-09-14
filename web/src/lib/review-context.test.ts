import { describe, expect, it } from "vitest";
import { buildReviewContext } from "./review-context";

describe("buildReviewContext", () => {
  it("orders categories and keeps teacher corrections beside the model", () => {
    const context = buildReviewContext({
      subject: "Auditoría II",
      assignment: "TP2",
      manualNotes: "Usar tono académico",
      legacyText: "Objetivo anterior",
      documents: [
        { name: "modelo.docx", category: "models", text: "Modelo", teacherFeedback: "Faltó justificar", url: null },
        { name: "modulo.pdf", category: "theory", text: "Teoría", teacherFeedback: "", url: "https://drive.test/modulo" },
        { name: "consigna.pdf", category: "brief", text: "Consigna", teacherFeedback: "", url: null },
      ],
    });
    expect(context.indexOf("ENUNCIADO + CONSIGNAS + RÚBRICA")).toBeLessThan(context.indexOf("MÓDULOS TEÓRICOS"));
    expect(context.indexOf("MÓDULOS TEÓRICOS")).toBeLessThan(context.indexOf("MODELOS ANTERIORES"));
    expect(context).toContain("CORRECCIONES DEL DOCENTE:\nFaltó justificar");
    expect(context).toContain("NOTAS MANUALES:\nUsar tono académico");
    expect(context).toContain("INFORMACIÓN ANTERIOR:\nObjetivo anterior");
    expect(context).toContain("Fuente en Drive: https://drive.test/modulo");
  });

  it("labels empty categories without inventing content", () => {
    const context = buildReviewContext({ subject: "Costos", assignment: "TP1", manualNotes: "", legacyText: "", documents: [] });
    expect(context).toContain("Sin archivos procesados en esta categoría.");
    expect(context).not.toContain("NOTAS MANUALES:");
    expect(context).not.toContain("INFORMACIÓN ANTERIOR:");
  });
});
