import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AIModelFields } from "@/components/ai-model-fields";
import { DEFAULT_AI_SETTINGS } from "@/lib/ai/settings";
import { saveSubjectAISettings } from "./actions";

export default async function SubjectPage({ params, searchParams }: { params: Promise<{ subjectId: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { subjectId } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [{ data: subject }, { data: assignments }, { data: general }] = await Promise.all([
    supabase.from("subjects").select("id,name,code,period,drive_folder_id,student_prompt,professor_prompt,study_report_prompt,claude_model,claude_effort,chatgpt_model,chatgpt_effort").eq("id", subjectId).single(),
    supabase.from("assignments").select("id,title,status,drive_folder_id,documents(count)").eq("subject_id", subjectId).order("title"),
    supabase.from("user_ai_settings").select("development_prompt,correction_prompt,study_report_prompt,claude_model,claude_effort,chatgpt_model,chatgpt_effort").maybeSingle(),
  ]);
  if (!subject) notFound();
  return <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950"><div className="mx-auto max-w-5xl">
    <Link href="/" className="text-sm font-semibold text-blue-700">← Volver a materias</Link>
    <div className="mt-6 flex items-start justify-between gap-6"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">{subject.code || "Materia"}</p><h1 className="mt-2 font-serif text-4xl font-semibold">{subject.name}</h1><p className="mt-2 text-slate-500">{subject.period || "Sin período"}</p></div><span className={`rounded-full px-4 py-2 text-sm font-semibold ${subject.drive_folder_id ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{subject.drive_folder_id ? "Drive sincronizado" : "Drive pendiente"}</span></div>
    <section className="mt-10 grid gap-4 md:grid-cols-2">{(assignments ?? []).map((assignment) => <Link key={assignment.id} href={`/materias/${subject.id}/trabajos/${assignment.id}`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between"><h2 className="font-serif text-2xl font-semibold">{assignment.title}</h2><span className="text-sm font-semibold text-blue-700">Abrir →</span></div><p className="mt-4 text-sm text-slate-500">{assignment.documents?.[0]?.count ?? 0} archivos · {assignment.drive_folder_id ? "Carpeta creada" : "Sin carpeta"}</p></Link>)}</section>
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="font-serif text-2xl font-semibold">IA y prompts de la materia</h2><p className="mt-1 text-sm text-slate-500">Dejá un campo vacío para usar la configuración general.</p>
      <form action={saveSubjectAISettings} className="mt-6 space-y-5"><input type="hidden" name="subjectId" value={subjectId}/>
        <label className="block"><span className="mb-2 block text-sm font-semibold">Desarrollo con Claude</span><textarea name="developmentPrompt" defaultValue={subject.student_prompt ?? ""} placeholder={general?.development_prompt || "Configuralo en la sección general"} rows={5} className="w-full rounded-xl border border-slate-200 p-3 text-sm"/></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold">Corrección con ChatGPT</span><textarea name="correctionPrompt" defaultValue={subject.professor_prompt ?? ""} placeholder={general?.correction_prompt || "Configuralo en la sección general"} rows={5} className="w-full rounded-xl border border-slate-200 p-3 text-sm"/></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold">Informe técnico con Claude</span><textarea name="studyReportPrompt" defaultValue={subject.study_report_prompt ?? ""} placeholder={general?.study_report_prompt || "Configuralo en la sección general"} rows={5} className="w-full rounded-xl border border-slate-200 p-3 text-sm"/></label>
        <div className="grid gap-4 md:grid-cols-2"><AIModelFields provider="claude" prefix="claude" model={subject.claude_model} effort={subject.claude_effort} allowInherit inheritedLabel={`configuración general (${general?.claude_model || DEFAULT_AI_SETTINGS.claudeModel})`}/><AIModelFields provider="chatgpt" prefix="chatgpt" model={subject.chatgpt_model} effort={subject.chatgpt_effort} allowInherit inheritedLabel={`configuración general (${general?.chatgpt_model || DEFAULT_AI_SETTINGS.chatgptModel})`}/></div>
        {query.error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">No se pudo guardar la configuración. Revisá los valores.</p>}{query.saved && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Configuración de la materia guardada.</p>}
        <div className="flex justify-end"><button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Guardar configuración de la materia</button></div>
      </form>
    </section>
  </div></main>;
}
