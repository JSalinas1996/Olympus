import { NextRequest, NextResponse } from "next/server";
import { uploadFinalDelivery } from "@/lib/drive/storage";
import { validateFinalDelivery } from "@/lib/final-delivery";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const { assignmentId } = await params; const data = await request.formData();
    const file = data.get("file"); const evaluation = String(data.get("evaluation") || ""); const rounds = Number(data.get("rounds") || 1);
    if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo final." }, { status: 400 });
    const checked = validateFinalDelivery(file.name, file.size, evaluation);
    const normalized = new File([await file.arrayBuffer()], file.name, { type: checked.mimeType });
    const supabase = await createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
    const { data: assignment } = await supabase.from("assignments").select("id,subject_id,drive_folder_id").eq("id", assignmentId).single();
    if (!assignment?.drive_folder_id) return NextResponse.json({ error: "El TP no tiene carpeta de Drive." }, { status: 404 });
    const document = await uploadFinalDelivery({ subjectId: assignment.subject_id, assignmentId, folderId: assignment.drive_folder_id, file: normalized });
    const { data: run, error: runError } = await supabase.from("ai_runs").insert({ assignment_id: assignmentId, status: "completed", current_round: Math.max(1, rounds), current_step: "published", idempotency_key: crypto.randomUUID() }).select("id").single();
    if (runError) throw runError;
    const { data: latest } = await supabase.from("versions").select("version_number").eq("assignment_id", assignmentId).order("version_number", { ascending: false }).limit(1).maybeSingle();
    const { data: version, error: versionError } = await supabase.from("versions").insert({ assignment_id: assignmentId, run_id: run.id, version_number: (latest?.version_number ?? 0) + 1, author: "claude", drive_file_id: document.drive_file_id, content: { name: document.name, mimeType: document.mime_type, size: document.size_bytes, driveUrl: document.drive_web_url } }).select("id").single();
    if (versionError) throw versionError;
    const { error: evaluationError } = await supabase.from("evaluations").insert({ assignment_id: assignmentId, version_id: version.id, estimated_score: 10, feedback: evaluation });
    if (evaluationError) throw evaluationError;
    await supabase.from("assignments").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", assignmentId);
    return NextResponse.json({ saved: true, document });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo publicar la entrega final." }, { status: 400 });
  }
}
