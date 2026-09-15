import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { buildStudyReportPrompt, validateStudyReportFile, validateStudyReportPackage } from "./study-report";

describe("study report", () => {
  it("accepts a Word package with text and an image", () => {
    const bytes = zipSync({ "word/document.xml": strToU8("<w:document>Informe</w:document>"), "word/media/image1.png": new Uint8Array([1, 2, 3]) });
    expect(validateStudyReportFile("informe.docx", bytes.byteLength).mimeType).toContain("wordprocessingml");
    expect(validateStudyReportPackage(bytes)).toEqual({ hasText: true, hasImage: true });
  });

  it("rejects a Word without an embedded logo", () => {
    const bytes = zipSync({ "word/document.xml": strToU8("<w:document>Informe</w:document>") });
    expect(() => validateStudyReportPackage(bytes)).toThrow("logo");
  });

  it("builds a prompt from the final delivery", () => {
    const prompt = buildStudyReportPrompt({ reportPrompt: "Usá estilo formal.", reviewContext: "Consignas", finalSections: [{ name: "TP.xlsx", text: "Resultado 25" }] });
    expect(prompt).toContain("Usá estilo formal.");
    expect(prompt).toContain("TP.xlsx");
    expect(prompt).toContain("Resultado 25");
    expect(prompt).toContain("logo adjunto");
  });
});
