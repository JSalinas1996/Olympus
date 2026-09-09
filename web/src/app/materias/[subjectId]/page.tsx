import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SubjectPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data: subject }, { data: assignments }] = await Promise.all([
    supabase.from("subjects").select("id,name,code,period,drive_folder_id").eq("id", subjectId).single(),
    supabase.from("assignments").select("id,title,status,drive_folder_id,documents(count)").eq("subject_id", subjectId).order("title"),
  ]);
  if (!subject) notFound();
  return <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950"><div className="mx-auto max-w-5xl">
    <Link href="/" className="text-sm font-semibold text-blue-700">← Volver a materias</Link>
    <div className="mt-6 flex items-start justify-between gap-6"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">{subject.code || "Materia"}</p><h1 className="mt-2 font-serif text-4xl font-semibold">{subject.name}</h1><p className="mt-2 text-slate-500">{subject.period || "Sin período"}</p></div><span className={`rounded-full px-4 py-2 text-sm font-semibold ${subject.drive_folder_id ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{subject.drive_folder_id ? "Drive sincronizado" : "Drive pendiente"}</span></div>
    <section className="mt-10 grid gap-4 md:grid-cols-2">{(assignments ?? []).map((assignment) => <Link key={assignment.id} href={`/materias/${subject.id}/trabajos/${assignment.id}`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between"><h2 className="font-serif text-2xl font-semibold">{assignment.title}</h2><span className="text-sm font-semibold text-blue-700">Abrir →</span></div><p className="mt-4 text-sm text-slate-500">{assignment.documents?.[0]?.count ?? 0} archivos · {assignment.drive_folder_id ? "Carpeta creada" : "Sin carpeta"}</p></Link>)}</section>
  </div></main>;
}
