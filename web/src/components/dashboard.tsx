"use client";

import { BookOpen, Bot, Clock3, FileCheck2, Files, Grid2X2, LayoutList, LibraryBig, Plus, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { type Subject } from "@/lib/demo-data";
import Link from "next/link";

type ViewMode = "grid" | "list";

function SubjectCard({ subject, view }: { subject: Subject; view: ViewMode }) {
  const tones = {
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    neutral: "bg-slate-50 text-slate-600 ring-slate-200",
  };
  const tone = tones[subject.updateTone];

  if (view === "list") {
    return (
      <article className="group grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-lg md:grid-cols-[minmax(230px,1.4fr)_1fr_1fr_auto] md:items-center">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{subject.code} · {subject.period}</p>
          <h3 className="font-serif text-xl font-semibold text-slate-950">{subject.name}</h3>
        </div>
        <div className="flex gap-5 text-sm text-slate-600"><span>{subject.sources} fuentes</span><span>{subject.precedents} antecedentes</span></div>
        <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${tone}`}>{subject.update}</span>
        <button className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold transition group-hover:border-slate-900 group-hover:bg-slate-950 group-hover:text-white">Abrir materia</button>
      </article>
    );
  }

  return (
    <article className="group flex min-h-72 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${subject.status === "En curso" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{subject.status}</span>
        <span className="text-xs font-medium text-slate-400">{subject.code}</span>
      </div>
      <h3 className="mt-5 font-serif text-2xl font-semibold tracking-tight text-slate-950">{subject.name}</h3>
      <p className="mt-1 text-sm text-slate-500">{subject.period}</p>
      <div className="mt-5 flex gap-5 border-y border-slate-100 py-4 text-sm text-slate-600">
        <span className="flex items-center gap-1.5"><Files className="size-4 text-slate-400" />{subject.sources} fuentes</span>
        <span className="flex items-center gap-1.5"><FileCheck2 className="size-4 text-slate-400" />{subject.precedents} antecedentes</span>
      </div>
      <div className="mt-auto pt-4">
        <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${tone}`}>{subject.update}</span>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${subject.progress}%` }} /></div>
          <span className="text-xs font-semibold text-slate-500">{subject.progress}%</span>
        </div>
      </div>
    </article>
  );
}

export function Dashboard({ initialSubjects }: { initialSubjects: Subject[] }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const visibleSubjects = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return initialSubjects.filter((subject) => {
      const searchable = `${subject.name} ${subject.code} ${subject.period} ${subject.update}`.toLocaleLowerCase("es");
      return !normalized || searchable.includes(normalized);
    });
  }, [initialSubjects, query]);

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-900">
      <header className="border-b border-white/10 bg-[#0c1830] text-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-500 shadow-lg shadow-blue-500/25"><BookOpen className="size-5" /></div>
            <div><p className="font-serif text-xl font-semibold">Olympus</p><p className="text-xs text-blue-200">Contador Público</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-blue-100 sm:flex"><Bot className="size-4" />Claude + ChatGPT<span className="size-2 rounded-full bg-emerald-400" /></div>
            <button aria-label="Abrir perfil" className="grid size-10 place-items-center rounded-full bg-white text-sm font-bold text-slate-900">JS</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[235px_1fr]">
        <aside className="hidden min-h-[calc(100vh-73px)] border-r border-slate-200 bg-white px-4 py-7 lg:block">
          <nav className="space-y-1" aria-label="Navegación principal">
            <a className="flex items-center gap-3 rounded-xl bg-blue-50 px-3 py-3 text-sm font-semibold text-blue-700" href="#"><LibraryBig className="size-5" />Materias</a>
            <a className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50" href="#"><Clock3 className="size-5" />Actividad reciente</a>
            <a className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50" href="#"><Sparkles className="size-5" />Ejecuciones de IA</a>
          </nav>
          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Este semestre</p><p className="mt-3 text-3xl font-semibold">4</p><p className="text-sm text-slate-500">materias en curso</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-3/5 rounded-full bg-blue-600" /></div>
          </div>
        </aside>

        <main className="min-w-0 px-5 py-8 lg:px-10 lg:py-10">
          <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div><p className="text-sm font-semibold text-blue-700">Mi carrera</p><h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight text-slate-950">Materias</h1><p className="mt-2 text-base text-slate-500">Organizá el material y continuá tus trabajos prácticos.</p></div>
            <Link href="/materias/nueva" className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"><Plus className="size-4" />Nueva materia</Link>
          </div>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <label className="relative flex-1"><span className="sr-only">Buscar materias</span><Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" placeholder="Buscar por materia, código o actividad…" /></label>
              <div className="flex self-start rounded-xl bg-slate-100 p-1 xl:self-auto">
                <button onClick={() => setView("grid")} aria-label="Vista en cuadrícula" aria-pressed={view === "grid"} className={`grid size-9 place-items-center rounded-lg ${view === "grid" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}><Grid2X2 className="size-4" /></button>
                <button onClick={() => setView("list")} aria-label="Vista en lista" aria-pressed={view === "list"} className={`grid size-9 place-items-center rounded-lg ${view === "list" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}><LayoutList className="size-4" /></button>
              </div>
            </div>
          </section>

          <div className="mt-5 flex items-center justify-between"><p className="text-sm text-slate-500"><strong className="text-slate-800">{visibleSubjects.length}</strong> materias</p><p className="hidden text-sm text-slate-400 sm:block">Ordenadas por actividad reciente</p></div>
          {visibleSubjects.length ? (
            <section className={`mt-4 ${view === "grid" ? "grid gap-4 md:grid-cols-2 2xl:grid-cols-3" : "space-y-3"}`} aria-label="Listado de materias">
              {visibleSubjects.map((subject) => <SubjectCard key={subject.id} subject={subject} view={view} />)}
            </section>
          ) : (
            <div className="mt-4 grid min-h-72 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white text-center"><div><Search className="mx-auto size-8 text-slate-300" /><h2 className="mt-4 font-serif text-xl font-semibold">No encontramos materias</h2><p className="mt-1 text-sm text-slate-500">Probá con otra búsqueda o cambiá el filtro.</p></div></div>
          )}
        </main>
      </div>
    </div>
  );
}
