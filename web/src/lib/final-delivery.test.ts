import { describe, expect, it } from "vitest";
import { scoreFromEvaluation, validateFinalDelivery } from "./final-delivery";

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
});
