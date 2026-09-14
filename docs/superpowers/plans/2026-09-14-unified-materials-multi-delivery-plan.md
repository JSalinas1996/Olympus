# Unified TP Materials and Multi-File Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the structured TP form with three multi-file material groups and let one AI cycle create, review, store, and download Word, Excel, or both as one final submission.

**Architecture:** The Next.js page becomes a server-rendered workspace composed from a focused client uploader and the existing native-cycle bridge. Existing document kinds provide backward-compatible categories, while two additive Supabase columns store manual notes and teacher feedback. The Objective-C coordinator changes from one extension to an ordered format array and returns a file array; the final-delivery endpoint stages the whole approved set in Drive before replacing the prior set.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/PostgreSQL, Google Drive API, Objective-C/AppKit/WebKit/Accessibility, Vitest, clang.

---

### Task 1: Add persistence for notes and teacher feedback

**Files:**
- Create: `web/supabase/migrations/202609140001_unified_materials.sql`
- Modify: `web/src/app/materias/[subjectId]/trabajos/[assignmentId]/actions.ts`

- [x] **Step 1: Write the additive migration**

```sql
alter table public.assignments
  add column if not exists manual_notes text not null default '';

alter table public.documents
  add column if not exists teacher_feedback text not null default '';
```

- [x] **Step 2: Add focused server actions**

Replace the structured-form schema with notes and prompts, and add feedback validation:

```ts
const assignmentSettingsSchema = z.object({
  subjectId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  manualNotes: z.string().max(100000),
  studentPromptOverride: z.string().max(30000),
  professorPromptOverride: z.string().max(30000),
});

const modelFeedbackSchema = z.object({
  subjectId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  documentId: z.string().uuid(),
  teacherFeedback: z.string().max(100000),
});
```

`saveAssignmentSettings` updates `manual_notes`, `student_prompt_override`, and `professor_prompt_override`. `saveModelFeedback` updates `teacher_feedback` only where `assignment_id` matches and `kind` is `precedent_work` or `precedent_correction`, then revalidates the TP path.

- [x] **Step 3: Apply the migration to the configured Supabase project**

Run the migration through the existing authenticated project setup path and verify both columns with a read that selects `manual_notes` from `assignments` and `teacher_feedback` from `documents`.

- [x] **Step 4: Verify static checks**

Run: `cd web && npm run lint`

Expected: exit 0 with no ESLint errors.

- [x] **Step 5: Commit**

```bash
git add web/supabase/migrations/202609140001_unified_materials.sql web/src/app/materias/[subjectId]/trabajos/[assignmentId]/actions.ts
git commit -m "Add unified TP material metadata"
```

### Task 2: Build reliable categorized multi-file uploads

**Files:**
- Create: `web/src/lib/materials.ts`
- Create: `web/src/lib/materials.test.ts`
- Create: `web/src/components/material-workspace.tsx`
- Create: `web/src/app/api/assignments/[assignmentId]/materials/route.ts`
- Modify: `web/src/lib/drive/storage.ts`
- Modify: `web/src/app/materias/[subjectId]/trabajos/[assignmentId]/page.tsx`

- [x] **Step 1: Write category tests**

```ts
import { describe, expect, it } from "vitest";
import { materialCategoryForKind } from "./materials";

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
```

- [x] **Step 2: Run the test and verify it fails**

Run: `cd web && npx vitest run src/lib/materials.test.ts`

Expected: FAIL because `materials.ts` does not exist.

- [x] **Step 3: Implement category mapping and validation constants**

```ts
export type MaterialCategory = "brief" | "theory" | "models";
export const documentKindByCategory = {
  brief: "assignment",
  theory: "source",
  models: "precedent_work",
} as const;
export function materialCategoryForKind(kind: string): MaterialCategory | null {
  if (kind === "assignment" || kind === "rubric") return "brief";
  if (kind === "source") return "theory";
  if (kind === "precedent_work" || kind === "precedent_correction") return "models";
  return null;
}
export const acceptedMaterialExtensions = [".pdf", ".doc", ".docx", ".xlsx", ".png", ".jpg", ".jpeg", ".heic", ".tif", ".tiff", ".txt", ".csv"];
export const maxMaterialBytes = 40 * 1024 * 1024;
```

- [x] **Step 4: Update Drive folder mapping**

Use these folder names for new uploads while leaving existing Drive data untouched:

```ts
const documentFolderByKind = {
  source: "02 - Módulos teóricos",
  assignment: "01 - Enunciado, consignas y rúbrica",
  rubric: "01 - Enunciado, consignas y rúbrica",
  precedent_work: "03 - Modelos anteriores",
  precedent_correction: "03 - Modelos anteriores",
} as const;
```

- [x] **Step 5: Add one-file upload API**

The `POST` route authenticates the user, validates `category`, reads exactly one `file`, checks extension and 40 MB size, confirms the assignment belongs to the authenticated user through RLS, calls `uploadAssignmentDocument`, and returns `{ documentId, name, processingStatus }`. It returns a Spanish JSON error with status 400/401/404 rather than redirecting to the dashboard.

- [x] **Step 6: Build the client upload queue**

`MaterialWorkspace` renders three fixed cards. Each `<input type="file" multiple>` sends files sequentially to the API with `FormData` containing `category` and `file`. Its state records:

```ts
type UploadItem = {
  key: string;
  name: string;
  category: MaterialCategory;
  state: "queued" | "uploading" | "done" | "error";
  error?: string;
};
```

After the queue finishes, call `router.refresh()`. Preserve failed rows with a Retry button that resends the original `File` object. The main card text must say that objective, questions, consignas, and rubric may be together in the same file.

- [x] **Step 7: Render stored documents by category**

Pass documents from the page into `MaterialWorkspace`, grouped by `materialCategoryForKind`. Preserve Drive, reprocess, and delete actions. Under each model, render its `teacher_feedback` textarea and a `Guardar correcciones` form bound to `saveModelFeedback`.

- [x] **Step 8: Run focused and full web checks**

Run: `cd web && npm test && npm run lint`

Expected: all Vitest files pass and ESLint exits 0.

- [x] **Step 9: Commit**

```bash
git add web/src/lib/materials.ts web/src/lib/materials.test.ts web/src/components/material-workspace.tsx web/src/app/api/assignments/[assignmentId]/materials/route.ts web/src/lib/drive/storage.ts web/src/app/materias/[subjectId]/trabajos/[assignmentId]/page.tsx
git commit -m "Add categorized multi-file TP uploads"
```

### Task 3: Replace structured fields and build role-aware AI context

**Files:**
- Create: `web/src/lib/review-context.ts`
- Create: `web/src/lib/review-context.test.ts`
- Modify: `web/src/app/materias/[subjectId]/trabajos/[assignmentId]/page.tsx`
- Modify: `web/src/components/native-cycle.tsx`

- [x] **Step 1: Write context-order tests**

Test that `buildReviewContext` emits sections in the approved order and places teacher feedback next to its model:

```ts
const context = buildReviewContext({
  subject: "Auditoría II",
  assignment: "TP2",
  manualNotes: "Usar tono académico",
  legacyText: "Objetivo anterior",
  documents: [
    { name: "modelo.docx", category: "models", text: "Modelo", teacherFeedback: "Faltó justificar" },
    { name: "modulo.pdf", category: "theory", text: "Teoría", teacherFeedback: "" },
    { name: "consigna.pdf", category: "brief", text: "Consigna", teacherFeedback: "" },
  ],
});
expect(context.indexOf("ENUNCIADO + CONSIGNAS + RÚBRICA")).toBeLessThan(context.indexOf("MÓDULOS TEÓRICOS"));
expect(context.indexOf("MÓDULOS TEÓRICOS")).toBeLessThan(context.indexOf("MODELOS ANTERIORES"));
expect(context).toContain("CORRECCIONES DEL DOCENTE: Faltó justificar");
```

- [x] **Step 2: Run the test and verify it fails**

Run: `cd web && npx vitest run src/lib/review-context.test.ts`

Expected: FAIL because `buildReviewContext` is not implemented.

- [x] **Step 3: Implement the pure context builder**

The output begins with the precedence rule:

```text
REGLAS DE USO DEL MATERIAL:
- El enunciado, las consignas y la rúbrica actuales tienen prioridad.
- Los módulos teóricos fundamentan la respuesta.
- Los modelos anteriores sólo orientan sobre estructura y criterios de corrección; no deben copiarse.
```

Then emit subject, TP, the three material categories, optional manual notes, and a read-only `INFORMACIÓN ANTERIOR` section when legacy structured fields contain text.

- [x] **Step 4: Simplify TP settings UI**

Remove the five large structured textareas from the main screen. Add collapsed `<details>` sections for `Notas manuales opcionales`, `Información anterior` when needed, and `Prompts de Claude y ChatGPT`. Save notes and prompts through `saveAssignmentSettings`.

- [x] **Step 5: Tighten cycle blockers**

Block start when prompts are missing, no processed material/manual notes exist, or any document in the `brief` category failed extraction. Theory/model failures remain visible but do not block. Use `buildReviewContext` as the only context source.

- [x] **Step 6: Run tests and production build**

Run: `cd web && npm test && npm run lint && npm run build`

Expected: all tests pass, lint exits 0, and Next.js production compilation succeeds.

- [x] **Step 7: Commit**

```bash
git add web/src/lib/review-context.ts web/src/lib/review-context.test.ts web/src/app/materias/[subjectId]/trabajos/[assignmentId]/page.tsx web/src/components/native-cycle.tsx
git commit -m "Build AI context from unified TP materials"
```

### Task 4: Extend the native cycle to Word, Excel, or both

**Files:**
- Modify: `desktop-poc/App/FileCycle.h`
- Modify: `desktop-poc/App/FileCycle.m`
- Modify: `desktop-poc/App/CycleCoordinator.m`
- Modify: `desktop-poc/Tests/FileCycleTests.m`
- Modify: `web/src/components/native-cycle.tsx`

- [x] **Step 1: Add failing format-set tests**

Expose and test:

```objc
NSArray<NSString *> *OlympusValidatedFormats(id rawFormats, NSError **error);
```

Assertions:

```objc
Require([OlympusValidatedFormats(@[@"docx"], &error) isEqual:@[@"docx"]], @"acepta Word");
Require([OlympusValidatedFormats(@[@"xlsx", @"docx"], &error) isEqual:@[@"docx", @"xlsx"]], @"ordena Word y Excel");
Require(OlympusValidatedFormats(@[], &error) == nil, @"rechaza selección vacía");
Require(OlympusValidatedFormats(@[@"pdf"], &error) == nil, @"rechaza formatos ajenos");
```

- [x] **Step 2: Run native tests and verify failure**

Run: `cd desktop-poc && make clean && make test`

Expected: compile or link failure because `OlympusValidatedFormats` is absent.

- [x] **Step 3: Implement deterministic format validation**

Return formats in `docx`, `xlsx` order, remove duplicates, and reject non-array, empty, or unsupported input with a Spanish `OlympusCycle` error.

- [x] **Step 4: Change the native payload and strict instruction**

Replace `format` with `formats` in React:

```ts
const [formats, setFormats] = useState<Array<"docx" | "xlsx">>(["docx"]);
send("start-file-cycle", { prompt, professorPrompt, reviewContext, formats, maxRounds: 3 });
```

Render two checkboxes and prevent unchecking the last selected format. `StrictFileInstruction` receives the array and requires exactly one downloadable file per selected extension in every round.

- [x] **Step 5: Download and extract every selected file per round**

For each extension, record button count and the same Downloads snapshot before sending Claude. Then wait for a new button, press it, wait for one stable file of that extension, copy it to `round-N.ext`, and extract text. Build the ChatGPT section as:

```text
ENTREGABLE WORD (.docx):
...

ENTREGABLE EXCEL (.xlsx):
...
```

If any requested format is missing, duplicated, empty, or unreadable, return an error before ChatGPT and clean the private run.

- [x] **Step 6: Return an approved file array**

On 10/10, return:

```objc
@{ @"approved": @YES,
   @"rounds": @(round),
   @"files": @[ @{ @"fileName": name,
                     @"mimeType": mime,
                     @"fileBase64": base64 }, ... ],
   @"evaluation": evaluation,
   @"score": @10,
   @"runDirectory": runDirectory }
```

Correction rounds tell Claude to replace every requested deliverable, even when ChatGPT mentioned only one.

- [x] **Step 7: Run native and web checks**

Run: `cd desktop-poc && make test && make app`

Run: `cd web && npm test && npm run lint`

Expected: native tests print `FileCycleTests: OK`, codesign verification succeeds, and all web checks pass.

- [x] **Step 8: Commit**

```bash
git add desktop-poc/App/FileCycle.h desktop-poc/App/FileCycle.m desktop-poc/App/CycleCoordinator.m desktop-poc/Tests/FileCycleTests.m web/src/components/native-cycle.tsx
git commit -m "Support paired Word and Excel AI cycles"
```

### Task 5: Publish and display an atomic final file set

**Files:**
- Modify: `web/src/lib/final-delivery.ts`
- Modify: `web/src/lib/final-delivery.test.ts`
- Modify: `web/src/lib/drive/storage.ts`
- Modify: `web/src/app/api/assignments/[assignmentId]/final-delivery/route.ts`
- Modify: `web/src/components/native-cycle.tsx`
- Modify: `web/src/app/materias/[subjectId]/trabajos/[assignmentId]/page.tsx`

- [x] **Step 1: Add failing final-set validation tests**

```ts
expect(validateFinalDeliverySet([
  { name: "entrega.docx", size: 100 },
  { name: "calculos.xlsx", size: 200 },
], ["docx", "xlsx"], "CALIFICACIÓN: 10/10")).toHaveLength(2);

expect(() => validateFinalDeliverySet(
  [{ name: "entrega.docx", size: 100 }],
  ["docx", "xlsx"],
  "CALIFICACIÓN: 10/10",
)).toThrow("Falta el archivo Excel");

expect(() => validateFinalDeliverySet(
  [{ name: "a.docx", size: 100 }, { name: "b.docx", size: 100 }],
  ["docx"],
  "CALIFICACIÓN: 10/10",
)).toThrow("exactamente un archivo Word");
```

- [x] **Step 2: Run tests and verify failure**

Run: `cd web && npx vitest run src/lib/final-delivery.test.ts`

Expected: FAIL because `validateFinalDeliverySet` is absent.

- [x] **Step 3: Implement final-set validation**

Parse the JSON `formats` field, require one file for each selected format, reject extras/duplicates, validate every size and extension, and require the last score occurrence to equal 10.

- [x] **Step 4: Stage all files in Drive before replacement**

Replace `uploadFinalDelivery` with:

```ts
export async function uploadFinalDeliveries(input: {
  subjectId: string;
  assignmentId: string;
  folderId: string;
  files: File[];
}): Promise<Array<FinalDocument>>;
```

Upload all new Drive files, insert all new `generated` document rows, then delete prior generated rows/files. On upload or insert failure, delete every newly created Drive file and database row while leaving the prior set untouched.

- [x] **Step 5: Update final-delivery API records**

Read `data.getAll("files")` and `JSON.parse(data.get("formats"))`, validate the set, normalize MIME types, and publish through `uploadFinalDeliveries`. Create one `ai_runs` record, one `versions` record with `content: { files: documents.map(...) }`, and one evaluation. Return `{ saved: true, documents }`.

- [x] **Step 6: Publish and render all approved files**

Change `NativeComplete` to contain `files`. Append every `File` to `FormData` with key `files`, include `formats`, and keep the entire pending result for retry. Change `finalDelivery` to `finalDeliveries` and render one row per stored generated document with its own download and Drive links under a single `ENTREGA FINAL · 10/10` card.

- [x] **Step 7: Run full web validation**

Run: `cd web && npm test && npm run lint && npm run build && npm audit --omit=dev`

Expected: tests, lint, TypeScript, and production build pass; audit reports 0 vulnerabilities.

- [x] **Step 8: Commit**

```bash
git add web/src/lib/final-delivery.ts web/src/lib/final-delivery.test.ts web/src/lib/drive/storage.ts web/src/app/api/assignments/[assignmentId]/final-delivery/route.ts web/src/components/native-cycle.tsx web/src/app/materias/[subjectId]/trabajos/[assignmentId]/page.tsx
git commit -m "Publish complete final delivery sets"
```

### Task 6: Install and verify Olympus Campus end to end

**Files:**
- Modify: `desktop-poc/README.md`
- Modify: `docs/superpowers/plans/2026-09-14-unified-materials-multi-delivery-plan.md`

- [x] **Step 1: Update usage documentation**

Document the three material categories, multiple selection, model feedback field, output checkboxes, paired correction rule, and the requirement to leave native Claude and ChatGPT logged in while the cycle runs.

- [x] **Step 2: Run all automated checks from a clean state**

Run:

```bash
cd web && npm test && npm run lint && npm run build
cd ../desktop-poc && make clean && make test && make app
codesign --verify --deep --strict /tmp/OlympusCampusBuild.app
```

Expected: every command exits 0.

- [x] **Step 3: Install the signed native application**

Stop only the existing Olympus process and its Node child, then run:

```bash
/usr/bin/ditto /tmp/OlympusCampusBuild.app "/Users/joaquin/Applications/Olympus Campus.app"
codesign --verify --deep --strict "/Users/joaquin/Applications/Olympus Campus.app"
```

- [ ] **Step 4: Verify the real upload workflow**

Open Olympus Campus, choose a test TP, select at least two small files in **Enunciado + consignas + rúbrica**, and verify both appear with `Texto listo`. Add a model, save a unique teacher correction note, reload, and verify the note persists and appears in the generated review context.

- [ ] **Step 5: Verify native single and paired selections**

Confirm the start button accepts Word only, Excel only, and both selected. Run a controlled Word + Excel cycle when subscription limits permit. Verify Claude produces both, ChatGPT receives both extracted contents, the UI shows one 10/10 evaluation, Drive contains the complete final pair, and both native download buttons create valid files in Downloads.

- [x] **Step 6: Check compatibility and cleanup behavior**

Open the existing Personas Jurídicas test TP and verify its legacy structured text appears under **Información anterior**, its previous single Word final remains downloadable, and no existing Drive folder or document was moved or deleted during migration.

- [x] **Step 7: Mark completed plan items and commit documentation**

Update this plan’s checkboxes to reflect executed steps, then run:

```bash
git add desktop-poc/README.md docs/superpowers/plans/2026-09-14-unified-materials-multi-delivery-plan.md
git commit -m "Document unified Olympus workflow"
```

- [x] **Step 8: Push and verify repository state**

Run: `git push origin main && git status --short`

Expected: GitHub `main` advances to the final commit and the working tree is clean.
