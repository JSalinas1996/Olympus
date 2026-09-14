import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveAssignment } from "./actions";
import { NativeCycle } from "@/components/native-cycle";
import { MaterialWorkspace } from "@/components/material-workspace";

const fields = [["projectInformation", "Información del proyecto", "project_information"], ["problemStatement", "Enunciado y situación problemática", "problem_statement"], ["objective", "Objetivo del trabajo", "objective"], ["instructions", "Consignas", "instructions"]] as const;

export default async function AssignmentPage({ params }: { params: Promise<{ subjectId: string; assignmentId: string }> }) {
  const { subjectId, assignmentId } = await params; const supabase = await createSupabaseServerClient();
  const [{ data: subject }, { data: assignment }, { data: documents }, { data: rubricItems }, { data: finalEvaluations }] = await Promise.all([
    supabase.from("subjects").select("name,student_prompt,professor_prompt").eq("id", subjectId).single(),
    supabase.from("assignments").select("*").eq("id", assignmentId).eq("subject_id", subjectId).single(),
    supabase.from("documents").select("id,name,kind,mime_type,drive_web_url,size_bytes,processing_status,processing_error,page_count,teacher_feedback,document_chunks(page_number,position,content)").eq("assignment_id", assignmentId).order("created_at", { ascending: false }),
    supabase.from("rubric_items").select("description").eq("assignment_id", assignmentId).eq("position", 0).limit(1),
    supabase.from("evaluations").select("feedback,estimated_score").eq("assignment_id", assignmentId).eq("estimated_score", 10).order("created_at", { ascending: false }).limit(1),
  ]); if (!subject || !assignment) notFound();
  const finalDelivery = (documents ?? []).find(document => document.kind === "generated") ?? null;
  const materials = (documents ?? []).filter(document => document.kind !== "generated");
  return <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950"><div className="mx-auto max-w-5xl">
    <Link href={`/materias/${subjectId}`} className="text-sm font-semibold text-blue-700">← Volver a {subject.name}</Link><h1 className="mt-6 font-serif text-4xl font-semibold">{assignment.title}</h1><p className="mt-2 text-slate-500">Cargá toda la información antes de iniciar el ciclo de revisión.</p>
    <form action={saveAssignment} className="mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><input type="hidden" name="subjectId" value={subjectId}/><input type="hidden" name="assignmentId" value={assignmentId}/>
      {fields.map(([name,label,column]) => <label key={name} className="block"><span className="text-sm font-semibold">{label}</span><textarea name={name} defaultValue={assignment[column] ?? ""} rows={4} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500"/></label>)}
      <label className="block"><span className="text-sm font-semibold">Rúbrica de evaluación del docente</span><textarea name="rubricText" defaultValue={rubricItems?.[0]?.description ?? ""} rows={5} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500" placeholder="Pegá aquí los criterios, puntajes y objetivos necesarios para obtener la máxima nota."/></label>
      <div className="grid gap-5 md:grid-cols-2"><label><span className="text-sm font-semibold">Prompt de Claude</span><textarea name="studentPromptOverride" defaultValue={assignment.student_prompt_override ?? subject.student_prompt} rows={6} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"/></label><label><span className="text-sm font-semibold">Prompt de ChatGPT</span><textarea name="professorPromptOverride" defaultValue={assignment.professor_prompt_override ?? subject.professor_prompt} rows={6} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"/></label></div>
      <button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Guardar información y prompts</button>
    </form>
    <div className="mt-6"><MaterialWorkspace subjectId={subjectId} assignmentId={assignmentId} documents={materials.map(document => ({ id: document.id, name: document.name, kind: document.kind, url: document.drive_web_url, status: document.processing_status, error: document.processing_error, pageCount: document.page_count, teacherFeedback: document.teacher_feedback ?? "" }))}/></div>
    <NativeCycle assignmentId={assignmentId} subject={subject.name} assignment={assignment.title} studentPrompt={assignment.student_prompt_override ?? subject.student_prompt ?? ""} professorPrompt={assignment.professor_prompt_override ?? subject.professor_prompt ?? ""} projectInformation={assignment.project_information ?? ""} problemStatement={assignment.problem_statement ?? ""} objective={assignment.objective ?? ""} rubric={rubricItems?.[0]?.description ?? ""} instructions={assignment.instructions ?? ""} documents={materials.map(document => ({ name: document.name, kind: document.kind, url: document.drive_web_url, status: document.processing_status, text: [...(document.document_chunks ?? [])].sort((a,b) => a.position-b.position).map(chunk => `[Sección ${chunk.page_number ?? "?"}]\n${chunk.content}`).join("\n\n") }))} finalDelivery={finalDelivery ? { id: finalDelivery.id, name: finalDelivery.name, mimeType: finalDelivery.mime_type, url: finalDelivery.drive_web_url, evaluation: finalEvaluations?.[0]?.feedback ?? "" } : null}/>
  </div></main>;
}
