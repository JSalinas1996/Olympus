import { NextResponse } from "next/server";
import { extractDocument } from "@/lib/documents/extract";
import { uploadStudyReport } from "@/lib/drive/storage";
import { validateStudyReportFile, validateStudyReportPackage } from "@/lib/study-report";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const { assignmentId } = await params; const data = await request.formData(); const raw = data.get("file");
    if (!(raw instanceof File)) return NextResponse.json({ error: "Falta el archivo Word del informe." }, { status: 400 });
    const checked = validateStudyReportFile(raw.name, raw.size); const bytes = new Uint8Array(await raw.arrayBuffer());
    validateStudyReportPackage(bytes);
    const normalized = new File([bytes], "Informe técnico final.docx", { type: checked.mimeType });
    const pages = await extractDocument(normalized);
    if (!pages.some(page => page.text.trim())) throw new Error("El Word del informe no contiene texto extraíble.");
    const supabase = await createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
    const { data: assignment } = await supabase.from("assignments").select("id,subject_id,drive_folder_id").eq("id", assignmentId).single();
    if (!assignment?.drive_folder_id) return NextResponse.json({ error: "El TP no tiene carpeta de Drive." }, { status: 404 });
    let snapshot: unknown = {};
    const rawSnapshot = String(data.get("configurationSnapshot") || "{}");
    if (rawSnapshot.length <= 10000) { try { const parsed = JSON.parse(rawSnapshot); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) snapshot = parsed; } catch {} }
    const { data: run, error: runError } = await supabase.from("ai_runs").insert({ assignment_id: assignmentId, status: "queued", current_round: 1, current_step: "publishing", run_type: "study_report", configuration_snapshot: snapshot, idempotency_key: crypto.randomUUID() }).select("id").single();
    if (runError) throw runError;
    let report;
    try {
      report = await uploadStudyReport({ subjectId: assignment.subject_id, assignmentId, folderId: assignment.drive_folder_id, file: normalized });
    } catch (uploadError) {
      await supabase.from("ai_runs").update({ status: "blocked", current_step: "publish_failed", error_message: uploadError instanceof Error ? uploadError.message.slice(0, 1000) : "No se pudo guardar el informe.", updated_at: new Date().toISOString() }).eq("id", run.id);
      throw uploadError;
    }
    const { error: completionError } = await supabase.from("ai_runs").update({ status: "completed", current_step: "published", updated_at: new Date().toISOString() }).eq("id", run.id);
    if (completionError) return NextResponse.json({ saved: true, report, warning: "El informe se guardó, pero no se pudo completar su registro de ejecución." });
    return NextResponse.json({ saved: true, report });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo publicar el informe técnico." }, { status: 400 });
  }
}
