import "server-only";
import mammoth from "mammoth";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createWorker, OEM } from "tesseract.js";
import spanishData from "@tesseract.js-data/spa";
import { extractWorkbook } from "./extract-office";

const execFileAsync = promisify(execFile);
export type ExtractedPage = { page: number; text: string; method: "embedded" | "ocr" | "text" };
type PDFPage = ExtractedPage & { imagePath?: string };

async function recognizeImages(images: { page: number; path: string }[]): Promise<ExtractedPage[]> {
  const worker = await createWorker("spa", OEM.LSTM_ONLY, { langPath: spanishData.langPath, gzip: spanishData.gzip, cacheMethod: "none", logger: () => undefined });
  try {
    const pages = [];
    for (const image of images) { const result = await worker.recognize(image.path); pages.push({ page: image.page, text: result.data.text.trim(), method: "ocr" as const }); }
    return pages;
  } finally { await worker.terminate(); }
}

function extension(name: string) { return path.extname(name).toLowerCase(); }

export async function extractDocument(file: File): Promise<ExtractedPage[]> {
  const ext = extension(file.name); const bytes = Buffer.from(await file.arrayBuffer());
  if ([".txt", ".md", ".csv"].includes(ext)) return [{ page: 1, text: bytes.toString("utf8"), method: "text" }];
  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer: bytes });
    return [{ page: 1, text: result.value, method: "text" }];
  }
  if (ext === ".xlsx") return extractWorkbook(bytes);
  const folder = await mkdtemp(path.join(tmpdir(), "olympus-document-"));
  const source = path.join(folder, `source${ext || ".bin"}`); await writeFile(source, bytes);
  try {
    if (ext === ".doc") {
      const { stdout } = await execFileAsync("/usr/bin/textutil", ["-convert", "txt", "-stdout", source], { maxBuffer: 20 * 1024 * 1024 });
      return [{ page: 1, text: stdout, method: "text" }];
    }
    if ([".png", ".jpg", ".jpeg", ".heic", ".tif", ".tiff"].includes(ext)) return await recognizeImages([{ page: 1, path: source }]);
    if (ext !== ".pdf") throw new Error(`El formato ${ext || file.type} todavía no es compatible.`);
    const extractor = path.resolve(process.cwd(), "../desktop-poc/.build/olympus-document-extractor");
    const { stdout } = await execFileAsync(extractor, ["pdf", source], { maxBuffer: 50 * 1024 * 1024, timeout: 10 * 60 * 1000 });
    const pdfPages = (JSON.parse(stdout) as { pages: PDFPage[] }).pages; const scanned = pdfPages.filter(page => page.imagePath).map(page => ({ page: page.page, path: page.imagePath! }));
    const recognized = new Map((await recognizeImages(scanned)).map(page => [page.page, page]));
    return pdfPages.map(page => page.imagePath ? recognized.get(page.page)! : page);
  } finally { await rm(folder, { recursive: true, force: true }); }
}
