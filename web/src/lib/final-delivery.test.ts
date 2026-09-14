import { describe, expect, it } from "vitest";
import { scoreFromEvaluation, validateFinalDelivery, validateFinalDeliverySet } from "./final-delivery";

describe("final delivery", () => {
  it("reads the last score", () => expect(scoreFromEvaluation("CALIFICACIÓN: 8/10\nCALIFICACIÓN: 10/10")).toBe(10));
  it("accepts approved Word and Excel files", () => {
    expect(validateFinalDelivery("tp.docx", 100, "CALIFICACIÓN: 10/10").extension).toBe(".docx");
    expect(validateFinalDelivery("tp.xlsx", 100, "CALIFICACION: 10 sobre 10").extension).toBe(".xlsx");
  });
  it("rejects an unapproved or unsupported file", () => {
    expect(() => validateFinalDelivery("tp.pdf", 100, "CALIFICACIÓN: 10/10")).toThrow("Word");
    expect(() => validateFinalDelivery("tp.docx", 100, "CALIFICACIÓN: 9/10")).toThrow("10/10");
  });

  it("accepts one approved file for every selected format", () => {
    const result = validateFinalDeliverySet(
      [{ name: "informe.docx", size: 100 }, { name: "calculos.xlsx", size: 200 }],
      ["docx", "xlsx"],
      "CALIFICACIÓN: 10/10",
    );
    expect(result.map(file => file.extension)).toEqual([".docx", ".xlsx"]);
  });

  it("rejects missing, duplicate, extra and unapproved files", () => {
    const approved = "CALIFICACIÓN: 10/10";
    expect(() => validateFinalDeliverySet([{ name: "informe.docx", size: 100 }], ["docx", "xlsx"], approved)).toThrow("Excel");
    expect(() => validateFinalDeliverySet([{ name: "uno.docx", size: 100 }, { name: "dos.docx", size: 100 }], ["docx"], approved)).toThrow("exactamente un archivo");
    expect(() => validateFinalDeliverySet([{ name: "informe.docx", size: 100 }, { name: "extra.xlsx", size: 100 }], ["docx"], approved)).toThrow("no solicitado");
    expect(() => validateFinalDeliverySet([{ name: "informe.docx", size: 100 }], ["docx"], "CALIFICACIÓN: 9/10")).toThrow("10/10");
  });
});
