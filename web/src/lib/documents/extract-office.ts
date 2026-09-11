import { XMLParser } from "fast-xml-parser";
import { strFromU8, unzipSync } from "fflate";
import type { ExtractedPage } from "./extract";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", removeNSPrefix: true, parseTagValue: false, trimValues: false });

function array<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function xml(files: Record<string, Uint8Array>, name: string) {
  const contents = files[name];
  if (!contents) throw new Error(`La planilla no contiene ${name}.`);
  return parser.parse(strFromU8(contents));
}

function richText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (!value || typeof value !== "object") return "";
  const node = value as Record<string, unknown>;
  if (node.t !== undefined) return richText(node.t);
  if (node.r !== undefined) return array(node.r).map(richText).join("");
  return "";
}

function workbookPath(target: string) {
  const normalized = target.replace(/^\//, "");
  return normalized.startsWith("xl/") ? normalized : `xl/${normalized}`;
}

export function extractWorkbook(bytes: Buffer): ExtractedPage[] {
  const files = unzipSync(new Uint8Array(bytes));
  const totalSize = Object.values(files).reduce((sum, entry) => sum + entry.byteLength, 0);
  if (totalSize > 120 * 1024 * 1024) throw new Error("La planilla descomprimida supera los 120 MB.");

  const workbook = xml(files, "xl/workbook.xml") as { workbook?: { sheets?: { sheet?: unknown } } };
  const relationships = xml(files, "xl/_rels/workbook.xml.rels") as { Relationships?: { Relationship?: unknown } };
  const relationById = new Map(array(relationships.Relationships?.Relationship as Record<string, string> | Record<string, string>[] | undefined).map(relation => [relation["@Id"], relation["@Target"]]));
  const shared = files["xl/sharedStrings.xml"] ? xml(files, "xl/sharedStrings.xml") as { sst?: { si?: unknown } } : null;
  const sharedStrings = array(shared?.sst?.si).map(richText);
  const sheets = array(workbook.workbook?.sheets?.sheet as Record<string, string> | Record<string, string>[] | undefined);
  if (!sheets.length) throw new Error("La planilla no contiene hojas legibles.");

  return sheets.map((sheet, index) => {
    const name = sheet["@name"] || `Hoja ${index + 1}`;
    const target = relationById.get(sheet["@id"]);
    if (!target) throw new Error(`No se encontró el contenido de la hoja ${name}.`);
    const document = xml(files, workbookPath(target)) as { worksheet?: { sheetData?: { row?: unknown } } };
    const lines = [`HOJA: ${name}`];
    for (const row of array(document.worksheet?.sheetData?.row as { c?: unknown } | { c?: unknown }[] | undefined)) {
      for (const cell of array(row.c as Record<string, unknown> | Record<string, unknown>[] | undefined)) {
        const address = String(cell["@r"] || "?");
        const type = String(cell["@t"] || "");
        const formula = richText(cell.f);
        let value = richText(cell.v);
        if (type === "s") value = sharedStrings[Number(value)] ?? value;
        else if (type === "inlineStr") value = richText(cell.is);
        else if (type === "b") value = value === "1" ? "VERDADERO" : "FALSO";
        if (value || formula) lines.push(`${address}: ${value}${formula ? ` | fórmula: =${formula}` : ""}`);
      }
    }
    return { page: index + 1, text: lines.join("\n"), method: "text" as const };
  });
}
