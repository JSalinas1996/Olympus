import Link from "next/link";
import { notFound } from "next/navigation";
import { MaterialWorkspace } from "@/components/material-workspace";
import { NativeCycle } from "@/components/native-cycle";
import { materialCategoryForKind } from "@/lib/materials";
import { buildReviewContext } from "@/lib/review-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveAssignmentSettings } from "./actions";

export default async function AssignmentPage({ params }: { params: Promise<{ subjectId: string; assignmentId: string }> }) {
  const { subjectId, assignmentId } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data: subject }, { data: assignment }, { data: documents }, { data: rubricItems }, { data: finalEvaluations }] = await Promise.all([
    supabase.from("subjects").select("name,student_prompt,professor_prompt").eq("id", subjectId).single(),
    supabase.from("assignments").select("*").eq("id", assignmentId).eq("subject_id", subjectId).single(),
    supabase.from("documents").select("id,name,kind,mime_type,drive_web_url,size_bytes,processing_status,processing_error,page_count,teacher_feedback,document_chunks(page_number,position,content)").eq("assignment_id", assignmentId).order("created_at", { ascending: false }),
    supabase.from("rubric_items").select("description").eq("assignment_id", assignmentId).eq("position", 0).limit(1),
    supabase.from("evaluations").select("feedback,estimated_score").eq("assignment_id", assignmentId).eq("estimated_score", 10).order("created_at", { ascending: false }).limit(1),
  ]);
  if (!subject || !assignment) notFound();

  const finalDelivery = (documents ?? []).find(document => document.kind === "generated") ?? null;
  const materials = (documents ?? []).filter(document => document.kind !== "generated");
  const legacySections = [
    ["Información del proyecto", assignment.project_information],
    ["Enunciado y situación problemática", assignment.problem_statement],
    ["Objetivo del trabajo", assignment.objective],
    ["Consignas", assignment.instructions],
    ["Rúbrica de evaluación", rubricItems?.[0]?.description],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()));
  const legacyText = legacySections.map(([label, value]) => `${label.toUpperCase()}:\n${value.trim()}`).join("\n\n");
  const reviewDocuments = materials.flatMap(document => {
    const category = materialCategoryForKind(document.kind);
    const text = [...(document.document_chunks ?? [])].sort((a, b) => a.position - b.position).map(chunk => `[Sección ${chunk.page_number ?? "?"}]\n${chunk.content}`).join("\n\n").trim();
    if (!category || document.processing_status !== "ready" || !text) return [];
    return [{ name: document.name, category, text, teacherFeedback: document.teacher_feedback ?? "", url: document.drive_web_url }];
  });
  const reviewContext = buildReviewContext({
    subject: subject.name,
    assignment: assignment.title,
    manualNotes: assignment.manual_notes ?? "",
    legacyText,
    documents: reviewDocuments,
  });
  const failedBriefNames = materials.filter(document => materialCategoryForKind(document.kind) === "brief" && document.processing_status === "failed").map(document => document.name);

  return <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950"><div className="mx-auto max-w-5xl">
    <Link href={`/materias/${subjectId}`} className="text-sm font-semibold text-blue-700">← Volver a {subject.name}</Link>
    <h1 className="mt-6 font-serif text-4xl font-semibold">{assignment.title}</h1>
    <p className="mt-2 text-slate-500">Subí el expediente del docente, el material teórico y los modelos tal como los recibiste.</p>

    <div className="mt-8"><MaterialWorkspace subjectId={subjectId} assignmentId={assignmentId} documents={materials.map(document => ({ id: document.id, name: document.name, kind: document.kind, url: document.drive_web_url, status: document.processing_status, error: document.processing_error, pageCount: document.page_count, teacherFeedback: document.teacher_feedback ?? "" }))}/></div>

    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <h2 className="font-serif text-2xl font-semibold">Configuración del trabajo</h2>
      <p className="mt-1 text-sm text-slate-500">Sólo completá estas secciones cuando quieras agregar contexto o cambiar los prompts heredados de la materia.</p>
      <form action={saveAssignmentSettings} className="mt-5 space-y-4">
        <input type="hidden" name="subjectId" value={subjectId}/><input type="hidden" name="assignmentId" value={assignmentId}/>
        <details className="rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer font-semibold">Notas manuales opcionales</summary>
          <textarea name="manualNotes" defaultValue={assignment.manual_notes ?? ""} rows={5} className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm" placeholder="Agregá aquí cualquier indicación que no figure en los archivos…"/>
        </details>
        <details className="rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer font-semibold">Prompts de Claude y ChatGPT</summary>
          <div className="mt-4 grid gap-5 md:grid-cols-2"><label><span className="text-sm font-semibold">Prompt de Claude</span><textarea name="studentPromptOverride" defaultValue={assignment.student_prompt_override ?? subject.student_prompt ?? ""} rows={6} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"/></label><label><span className="text-sm font-semibold">Prompt de ChatGPT</span><textarea name="professorPromptOverride" defaultValue={assignment.professor_prompt_override ?? subject.professor_prompt ?? ""} rows={6} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"/></label></div>
        </details>
        <button className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">Guardar notas y prompts</button>
      </form>
      {legacySections.length > 0 && <details className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><summary className="cursor-pointer font-semibold text-amber-950">Información anterior</summary><p className="mt-2 text-xs text-amber-800">Se conserva y continúa formando parte del contexto de las IA.</p><pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-amber-950">{legacyText}</pre></details>}
    </section>

    <NativeCycle assignmentId={assignmentId} subject={subject.name} assignment={assignment.title} studentPrompt={assignment.student_prompt_override ?? subject.student_prompt ?? ""} professorPrompt={assignment.professor_prompt_override ?? subject.professor_prompt ?? ""} reviewContext={reviewContext} hasUsableMaterial={reviewDocuments.length > 0 || Boolean((assignment.manual_notes ?? "").trim()) || Boolean(legacyText)} failedBriefNames={failedBriefNames} finalDelivery={finalDelivery ? { id: finalDelivery.id, name: finalDelivery.name, mimeType: finalDelivery.mime_type, url: finalDelivery.drive_web_url, evaluation: finalEvaluations?.[0]?.feedback ?? "" } : null}/>
  </div></main>;
}
