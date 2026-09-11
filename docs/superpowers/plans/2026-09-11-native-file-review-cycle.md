# Native File Review Cycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Olympus accept study materials and prompts, have Claude generate a Word or Excel file, use ChatGPT's textual feedback to request corrected files, and publish only the final 10/10 file to Drive.

**Architecture:** The React page prepares the academic brief and receives native progress events. The macOS coordinator owns one isolated Claude conversation and one isolated ChatGPT conversation per cycle, watches a private run directory for generated files, extracts their contents locally, and returns the final file to the authenticated web layer. The web API uploads only the approved file to the TP's Drive `Entrega final` folder and records its metadata in Supabase.

**Tech Stack:** Objective-C/AppKit/WebKit/Accessibility, Next.js 16, TypeScript, Supabase, Google Drive API, Mammoth, SheetJS.

---

### Task 1: Office file extraction

**Files:**
- Modify: `web/package.json`
- Modify: `web/src/lib/documents/extract.ts`
- Create: `web/src/lib/documents/extract.test.ts`

- [ ] **Step 1: Add fixture-based tests for Word and Excel extraction**

Create two small in-memory fixtures and assert that Word paragraphs and Excel sheet names, formulas, and calculated values are present in the extracted text.

- [ ] **Step 2: Run the tests and verify the Excel case fails**

Run: `npm test -- extract.test.ts`
Expected: Word passes; Excel reports an unsupported `.xlsx` format.

- [ ] **Step 3: Add SheetJS and implement Excel extraction**

Add `xlsx` to dependencies. In `extractDocument`, parse the workbook with `XLSX.read(bytes, { type: "buffer", cellFormula: true })` and emit one extracted page per sheet. Render each populated cell as `A1: value | fórmula: =...` so ChatGPT receives both the displayed result and procedure.

- [ ] **Step 4: Run extraction tests**

Run: `npm test -- extract.test.ts`
Expected: both fixtures pass.

### Task 2: Final delivery publication API

**Files:**
- Modify: `web/src/lib/drive/storage.ts`
- Create: `web/src/app/api/assignments/[assignmentId]/final-delivery/route.ts`
- Create: `web/src/lib/final-delivery.ts`
- Create: `web/src/lib/final-delivery.test.ts`
- Create: `web/supabase/migrations/202609110004_final_deliveries.sql`

- [ ] **Step 1: Test final file validation and score parsing**

Cover `.docx`/`.xlsx`, the 40 MB limit, `CALIFICACIÓN: 10/10`, and rejection of incomplete evaluations.

- [ ] **Step 2: Add final-delivery metadata**

Add `final_file_name`, `final_mime_type`, `final_drive_file_id`, `final_drive_web_url`, and `final_evaluation` to `assignments`. Keep all fields nullable.

- [ ] **Step 3: Implement Drive replacement**

Add `uploadFinalDelivery({ assignmentId, folderId, file })`. Create or reuse `Entrega final`, upload the new file, update Supabase, and only then delete the previous Drive file. If upload or database update fails, preserve the previous final delivery.

- [ ] **Step 4: Implement authenticated multipart endpoint**

Validate the signed-in user, assignment ownership, score, extension, size, and Drive folder. Return `{ name, mimeType, driveUrl, downloadUrl }`.

- [ ] **Step 5: Run API helper tests**

Run: `npm test -- final-delivery.test.ts`
Expected: all validation cases pass.

### Task 3: Native run files and download detection

**Files:**
- Create: `desktop-poc/App/FileCycle.h`
- Create: `desktop-poc/App/FileCycle.m`
- Modify: `desktop-poc/Makefile`

- [ ] **Step 1: Define the run-file interface**

Expose `BeginRun`, `SnapshotDownloads`, `WaitForNewOfficeFile`, `CopyVersionToRun`, and `CleanRun`. Limit accepted extensions to `.docx` and `.xlsx` and require size stability across three polls.

- [ ] **Step 2: Implement the private run directory**

Use `~/Library/Application Support/Olympus Campus/Runs/<UUID>/`. Copy each round to `round-<n>.<ext>` and never write intermediate files to Drive.

- [ ] **Step 3: Implement deterministic download selection**

Compare file URL, modification date, and size against the pre-request snapshot. Reject partial `.crdownload`/`.download` files, zero-byte files, multiple candidates, and format changes across rounds.

- [ ] **Step 4: Compile and run a local detector probe**

Run: `make app`
Expected: signed app builds successfully and detector assertions pass.

### Task 4: Reliable native chat sessions

**Files:**
- Create: `desktop-poc/App/AIApplication.h`
- Create: `desktop-poc/App/AIApplication.m`
- Modify: `desktop-poc/App/main.m`
- Modify: `desktop-poc/Makefile`

- [ ] **Step 1: Extract application automation from `main.m`**

Define operations to raise an application window, open and verify a new chat, send a prompt to the active chat, send a follow-up without opening another chat, read the latest response, and press the download action associated with the latest Claude response.

- [ ] **Step 2: Verify new-chat identity before typing**

Capture the active conversation title or URL before pressing `Nuevo`; require it to change or expose an empty composer. If verification fails, return a typed error and do not send keystrokes.

- [ ] **Step 3: Associate responses with the submitted prompt**

Normalize whitespace and inspect the active conversation only. Accept response headings in Spanish and English and ignore timestamps. Do not traverse inactive conversation content.

- [ ] **Step 4: Compile the app**

Run: `make app`
Expected: build and `codesign --verify --deep --strict` pass.

### Task 5: File-based Claude and ChatGPT coordinator

**Files:**
- Create: `desktop-poc/App/CycleCoordinator.h`
- Create: `desktop-poc/App/CycleCoordinator.m`
- Modify: `desktop-poc/App/main.m`

- [ ] **Step 1: Define cycle messages**

Accept `{ action: "start-file-cycle", prompt, professorPrompt, format, maxRounds }`. Emit `olympus-cycle-progress`, `olympus-cycle-failed`, and `olympus-cycle-complete` with round, stage, file metadata, evaluation, and final file bytes.

- [ ] **Step 2: Implement the first Claude round**

Append a strict instruction requiring exactly one `.docx` or `.xlsx` attachment, snapshot Downloads, submit in a new Claude chat, wait for completion, press download, and capture the new file.

- [ ] **Step 3: Implement ChatGPT evaluation**

Extract the downloaded file locally and send the structured representation plus professor prompt in a new ChatGPT chat. Require concrete corrections and a final `CALIFICACIÓN: X/10` line.

- [ ] **Step 4: Implement revisions in the same Claude chat**

For scores below 10, reactivate the cycle's Claude conversation and send the entire ChatGPT correction as a follow-up. Require a complete replacement file in the original format and repeat download detection.

- [ ] **Step 5: Complete or stop safely**

On 10/10 emit the final file and evaluation. At the round limit emit a stopped result without publishing. Clean intermediate files after the web layer acknowledges publication or after an unrecoverable error.

### Task 6: Olympus interface and persistence

**Files:**
- Modify: `web/src/components/native-cycle.tsx`
- Modify: `web/src/app/materias/[subjectId]/trabajos/[assignmentId]/page.tsx`

- [ ] **Step 1: Add format and cycle controls**

Add a Word/Excel selector, disabled states, current round and stage, cancel action, and explicit validation when prompts or materials are missing.

- [ ] **Step 2: Receive native progress and final file**

Decode the final base64 payload into a `File`, POST it with the evaluation to the authenticated final-delivery API, acknowledge native cleanup, and refresh the page.

- [ ] **Step 3: Display only the final delivery**

Show final file name, format, 10/10 correction, `Descargar archivo final`, and `Abrir en Drive`. Remove the browser-generated Word conversion because Claude's real file is authoritative.

- [ ] **Step 4: Validate the production bundle**

Run: `npm run lint && npm run build`
Expected: ESLint and Next.js build pass.

### Task 7: End-to-end acceptance

**Files:**
- Modify: `desktop-poc/README.md`

- [ ] **Step 1: Verify material and prompt persistence**

From Olympus, upload one PDF, one image, one Word file, and one Excel file; confirm Drive links and extracted text. Save both prompts, restart Olympus, and confirm values persist.

- [ ] **Step 2: Run a Word cycle**

Use a small deterministic assignment. Confirm Claude creates `.docx`, ChatGPT returns text, a requested revision creates a new `.docx`, and only the 10/10 file appears in Drive.

- [ ] **Step 3: Run an Excel cycle**

Use a workbook with formulas. Confirm ChatGPT receives formulas and values, Claude preserves `.xlsx`, and only the approved workbook appears in Drive.

- [ ] **Step 4: Verify failure safety**

Close each AI app in turn, simulate a missing download and ambiguous downloads, and confirm Olympus stops without typing into an existing chat or publishing an intermediate file.

- [ ] **Step 5: Install and commit**

Install the signed app at `~/Applications/Olympus Campus.app`, update the README with the tested workflow, commit all source and migration changes, and push `main` to GitHub.

