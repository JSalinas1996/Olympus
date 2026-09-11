import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { extractWorkbook } from "./extract-office";

function workbookFixture() {
  return Buffer.from(zipSync({
    "xl/workbook.xml": strToU8(`<?xml version="1.0"?><workbook xmlns:r="relationships"><sheets><sheet name="Cálculo" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`),
    "xl/sharedStrings.xml": strToU8(`<?xml version="1.0"?><sst><si><t>Importe A</t></si><si><t>Importe B</t></si><si><t>Total</t></si></sst>`),
    "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2"><v>100</v></c><c r="B2"><v>50</v></c><c r="C2"><f>A2+B2</f><v>150</v></c></row></sheetData></worksheet>`),
  }));
}

describe("extractWorkbook", () => {
  it("includes sheet names, values and formulas", () => {
    const pages = extractWorkbook(workbookFixture());
    expect(pages).toHaveLength(1);
    expect(pages[0].text).toContain("HOJA: Cálculo");
    expect(pages[0].text).toContain("A1: Importe A");
    expect(pages[0].text).toContain("C2: 150 | fórmula: =A2+B2");
  });
});
