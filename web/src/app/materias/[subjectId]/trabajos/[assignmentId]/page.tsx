import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveAssignment, uploadDocument } from "./actions";
import { NativeCycle } from "@/components/native-cycle";

const fields = [["projectInformation", "Información del proyecto", "project_information"], ["problemStatement", "Enunciado y situación problemática", "problem_statement"], ["objective", "Objetivo del trabajo", "objective"], ["instructions", "Consignas", "instructions"]] as const;

export default async function AssignmentPage({ params }: { params: Promise<{ subjectId: string; assignmentId: string }> }) {
  const { subjectId, assignmentId } = await params; const supabase = await createSupabaseServerClient();
  const [{ data: subject }, { data: assignment }, { data: documents }] = await Promise.all([
    supabase.from("subjects").select("name,student_prompt,professor_prompt").eq("id", subjectId).single(),
    supabase.from("assignments").select("*").eq("id", assignmentId).eq("subject_id", subjectId).single(),
    supabase.from("documents").select("id,name,kind,drive_web_url,size_bytes").eq("assignment_id", assignmentId).order("created_at", { ascending: false }),
  ]); if (!subject || !assignment) notFound();
  return <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950"><div className="mx-auto max-w-5xl">
    <Link href={`/materias/${subjectId}`} className="text-sm font-semibold text-blue-700">← Volver a {subject.name}</Link><h1 className="mt-6 font-serif text-4xl font-semibold">{assignment.title}</h1><p className="mt-2 text-slate-500">Cargá toda la información antes de iniciar el ciclo de revisión.</p>
    <form action={saveAssignment} className="mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><input type="hidden" name="subjectId" value={subjectId}/><input type="hidden" name="assignmentId" value={assignmentId}/>
      {fields.map(([name,label,column]) => <label key={name} className="block"><span className="text-sm font-semibold">{label}</span><textarea name={name} defaultValue={assignment[column] ?? ""} rows={4} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500"/></label>)}
      <div className="grid gap-5 md:grid-cols-2"><label><span className="text-sm font-semibold">Prompt de Claude</span><textarea name="studentPromptOverride" defaultValue={assignment.student_prompt_override ?? subject.student_prompt} rows={6} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"/></label><label><span className="text-sm font-semibold">Prompt de ChatGPT</span><textarea name="professorPromptOverride" defaultValue={assignment.professor_prompt_override ?? subject.professor_prompt} rows={6} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"/></label></div>
      <button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Guardar información y prompts</button>
    </form>
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><h2 className="font-serif text-2xl font-semibold">Archivos en Drive</h2><form action={uploadDocument} className="mt-5 flex flex-wrap items-end gap-3"><input type="hidden" name="subjectId" value={subjectId}/><input type="hidden" name="assignmentId" value={assignmentId}/><label className="text-sm font-semibold">Tipo<select name="kind" className="mt-2 block rounded-xl border border-slate-200 px-3 py-2"><option value="source">Información y fuentes</option><option value="assignment">Enunciado</option><option value="rubric">Rúbrica</option><option value="precedent_work">Modelo anterior</option><option value="precedent_correction">Corrección anterior</option></select></label><input required name="file" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt" className="text-sm"/><button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">Subir a Drive</button></form><div className="mt-5 space-y-2">{(documents ?? []).map((document) => <a key={document.id} href={document.drive_web_url ?? "#"} target="_blank" className="flex justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"><span>{document.name}</span><span className="text-slate-500">{document.kind}</span></a>)}</div></section>
    <NativeCycle subject={subject.name} assignment={assignment.title} studentPrompt={assignment.student_prompt_override ?? subject.student_prompt ?? ""} professorPrompt={assignment.professor_prompt_override ?? subject.professor_prompt ?? ""} projectInformation={assignment.project_information ?? ""} problemStatement={assignment.problem_statement ?? ""} objective={assignment.objective ?? ""} instructions={assignment.instructions ?? ""} documents={(documents ?? []).map(document => ({ name: document.name, kind: document.kind, url: document.drive_web_url }))}/>
  </div></main>;
}
