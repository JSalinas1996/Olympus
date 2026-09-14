import { describe, expect, it } from "vitest";
import { materialCategoryForKind, validateMaterialFile } from "./materials";

describe("materialCategoryForKind", () => {
  it("groups current and legacy document kinds", () => {
    expect(materialCategoryForKind("assignment")).toBe("brief");
    expect(materialCategoryForKind("rubric")).toBe("brief");
    expect(materialCategoryForKind("source")).toBe("theory");
    expect(materialCategoryForKind("precedent_work")).toBe("models");
    expect(materialCategoryForKind("precedent_correction")).toBe("models");
    expect(materialCategoryForKind("generated")).toBeNull();
  });
});

describe("validateMaterialFile", () => {
  it("accepts a supported non-empty file", () => {
    expect(validateMaterialFile("consignas.pdf", 1024)).toEqual({ extension: ".pdf" });
  });

  it("rejects unsupported, empty, and oversized files", () => {
    expect(() => validateMaterialFile("archivo.zip", 1024)).toThrow("no es compatible");
    expect(() => validateMaterialFile("vacio.pdf", 0)).toThrow("vacío");
    expect(() => validateMaterialFile("grande.pdf", 40 * 1024 * 1024 + 1)).toThrow("40 MB");
  });
});
