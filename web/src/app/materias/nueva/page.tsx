import Link from "next/link";
import { ArrowLeft, BookPlus } from "lucide-react";
import { createSubject } from "./actions";
import { CreateSubjectButton } from "./submit-button";

const inputClass = "w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50";

export default async function NewSubjectPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="min-h-screen bg-[#f7f8fb] px-5 py-8 lg:py-12"><div className="mx-auto max-w-3xl">
    <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"><ArrowLeft className="size-4" />Volver a materias</Link>
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
      <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><BookPlus className="size-5" /></div><div><h1 className="font-serif text-3xl font-semibold">Nueva materia</h1><p className="text-sm text-slate-500">Configurá sus datos y los roles de las dos IA.</p></div></div>
      <form action={createSubject} className="mt-8 space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Nombre</span><input required name="name" className={`h-12 ${inputClass}`} placeholder="Ej. Personas Jurídicas" /></label>
          <label><span className="mb-2 block text-sm font-semibold">Código</span><input name="code" className={`h-12 ${inputClass}`} placeholder="Ej. CPB-312" /></label>
          <label><span className="mb-2 block text-sm font-semibold">Período</span><input name="period" className={`h-12 ${inputClass}`} placeholder="Ej. 2.º semestre 2026" /></label>
        </div>
        <label className="block"><span className="mb-2 block text-sm font-semibold">Prompt de Claude · Alumno</span><textarea name="studentPrompt" rows={7} className={`p-4 ${inputClass}`} placeholder="Indicaciones generales para desarrollar los trabajos…" /></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold">Prompt de ChatGPT · Catedrático</span><textarea name="professorPrompt" rows={7} className={`p-4 ${inputClass}`} placeholder="Criterios generales para corregir los trabajos…" /></label>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
        <div className="flex justify-end gap-3"><Link href="/" className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold">Cancelar</Link><CreateSubjectButton /></div>
      </form>
    </section>
  </div></main>;
}
