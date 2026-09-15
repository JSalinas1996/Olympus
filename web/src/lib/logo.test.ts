import { describe, expect, it } from "vitest";
import { validateLogoFile } from "./logo";

describe("validateLogoFile", () => {
  it("accepts PNG and JPEG logos", () => {
    expect(validateLogoFile("marca.png", 100, "image/png").extension).toBe(".png");
    expect(validateLogoFile("marca.jpeg", 100, "image/jpeg").extension).toBe(".jpeg");
  });

  it("rejects invalid, empty, or oversized logos", () => {
    expect(() => validateLogoFile("marca.svg", 100, "image/svg+xml")).toThrow("PNG o JPEG");
    expect(() => validateLogoFile("marca.jpg", 0, "image/jpeg")).toThrow("vacío");
    expect(() => validateLogoFile("marca.png", 10 * 1024 * 1024 + 1, "image/png")).toThrow("10 MB");
  });
});
