"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteDocument, reprocessDocument, saveModelFeedback } from "@/app/materias/[subjectId]/trabajos/[assignmentId]/actions";
import { materialCategoryForKind, type MaterialCategory } from "@/lib/materials";

export type StoredMaterial = {
  id: string;
  name: string;
  kind: string;
  url: string | null;
  status: string;
  error: string | null;
  pageCount: number | null;
  teacherFeedback: string;
};

type UploadItem = {
  key: string;
  name: string;
  category: MaterialCategory;
  state: "queued" | "uploading" | "done" | "error";
  file: File;
  error?: string;
};

const categories: Array<{ id: MaterialCategory; title: string; description: string; button: string }> = [
  { id: "brief", title: "Enunciado + consignas + rúbrica", description: "Podés cargar todo junto: objetivo, preguntas, consignas, situación problemática y rúbrica.", button: "Elegir archivo principal" },
  { id: "theory", title: "Módulos teóricos", description: "Material de estudio, leyes, resoluciones técnicas, bibliografía y normativa.", button: "Agregar módulos" },
  { id: "models", title: "Modelos anteriores", description: "Trabajos resueltos y correcciones de otros años que sirven como referencia.", button: "Agregar modelos" },
];

function statusLabel(document: StoredMaterial) {
  if (document.status === "ready") return `Texto listo${document.pageCount ? ` · ${document.pageCount} sección(es)` : ""}`;
  if (document.status === "failed") return "No se pudo procesar";
  return "Procesando…";
}

export function MaterialWorkspace({ subjectId, assignmentId, documents }: { subjectId: string; assignmentId: string; documents: StoredMaterial[] }) {
  const router = useRouter();
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const setUpload = (key: string, patch: Partial<UploadItem>) => {
    setUploads(items => items.map(item => item.key === key ? { ...item, ...patch } : item));
  };

  const sendFile = async (item: UploadItem) => {
    setUpload(item.key, { state: "uploading", error: undefined });
    const body = new FormData();
    body.set("category", item.category);
    body.set("file", item.file);
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/materials`, { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No se pudo subir el archivo.");
      setUpload(item.key, { state: "done" });
      return true;
    } catch (error) {
      setUpload(item.key, { state: "error", error: error instanceof Error ? error.message : "No se pudo subir el archivo." });
      return false;
    }
  };

  const runQueue = (items: UploadItem[]) => {
    const batch = async () => {
      let completed = false;
      for (const item of items) completed = (await sendFile(item)) || completed;
      if (completed) router.refresh();
    };
    queue.current = queue.current.then(batch, batch);
  };

  const chooseFiles = (category: MaterialCategory, selected: FileList | null) => {
    if (!selected?.length) return;
    const items = Array.from(selected).map((file, index): UploadItem => ({
      key: `${category}-${Date.now()}-${index}-${file.name}`,
      name: file.name,
      category,
      state: "queued",
      file,
    }));
    setUploads(current => [...current, ...items]);
    runQueue(items);
  };

  const retry = (item: UploadItem) => {
    runQueue([item]);
  };

  return <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
    <h2 className="font-serif text-2xl font-semibold">Material del trabajo práctico</h2>
    <p className="mt-2 text-sm text-slate-600">Clasificá los archivos para que Olympus sepa qué debe cumplir, qué debe usar como fundamento y qué puede tomar como referencia.</p>
    <div className="mt-6 grid gap-5">
      {categories.map(category => {
        const stored = documents.filter(document => materialCategoryForKind(document.kind) === category.id);
        const categoryUploads = uploads.filter(item => item.category === category.id);
        return <article key={category.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">{category.id === "brief" ? "Prioridad principal" : category.id === "theory" ? "Fundamento académico" : "Referencia docente"}</p><h3 className="mt-1 text-lg font-bold">{category.title}</h3><p className="mt-1 max-w-2xl text-sm text-slate-600">{category.description}</p></div>
            <label className="cursor-pointer rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">
              {category.button}
              <input type="file" multiple accept=".pdf,.doc,.docx,.xlsx,.png,.jpg,.jpeg,.heic,.tif,.tiff,.txt,.csv" className="sr-only" onChange={event => { chooseFiles(category.id, event.target.files); event.currentTarget.value = ""; }}/>
            </label>
          </div>

          {categoryUploads.length > 0 && <div className="mt-4 space-y-2">{categoryUploads.map(item => <div key={item.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><span className="font-medium">{item.name}</span><div className="flex items-center gap-3"><span className={item.state === "done" ? "text-emerald-700" : item.state === "error" ? "text-red-700" : "text-amber-700"}>{item.state === "queued" ? "En cola" : item.state === "uploading" ? "Subiendo y procesando…" : item.state === "done" ? "Carga completa" : item.error}</span>{item.state === "error" && <button type="button" onClick={() => retry(item)} className="font-semibold text-blue-700">Reintentar</button>}</div></div>)}</div>}

          {stored.length > 0 && <div className="mt-4 space-y-3">{stored.map(document => <div key={document.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-4"><div>{document.url ? <a href={document.url} target="_blank" rel="noreferrer" className="font-semibold text-blue-700">{document.name}</a> : <span className="font-semibold">{document.name}</span>}<p className={document.status === "ready" ? "mt-1 text-xs text-emerald-700" : document.status === "failed" ? "mt-1 text-xs text-red-700" : "mt-1 text-xs text-amber-700"}>{statusLabel(document)}</p></div><div className="flex items-center gap-3">{document.status !== "ready" && <form action={reprocessDocument}><input type="hidden" name="subjectId" value={subjectId}/><input type="hidden" name="assignmentId" value={assignmentId}/><input type="hidden" name="documentId" value={document.id}/><button className="font-semibold text-blue-700">Reintentar</button></form>}<form action={deleteDocument}><input type="hidden" name="subjectId" value={subjectId}/><input type="hidden" name="assignmentId" value={assignmentId}/><input type="hidden" name="documentId" value={document.id}/><button className="font-semibold text-red-700">Eliminar</button></form></div></div>
            {document.error && <p className="mt-2 text-xs text-red-700">{document.error}</p>}
            {category.id === "models" && <form action={saveModelFeedback} className="mt-4 border-t border-slate-100 pt-4"><input type="hidden" name="subjectId" value={subjectId}/><input type="hidden" name="assignmentId" value={assignmentId}/><input type="hidden" name="documentId" value={document.id}/><label className="block font-semibold">Correcciones que hizo el docente<textarea name="teacherFeedback" defaultValue={document.teacherFeedback} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal" placeholder="Ej.: pidió justificar mejor el punto 2, corregir las citas o agregar el cálculo final…"/></label><button className="mt-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">Guardar correcciones</button></form>}
          </div>)}</div>}
          {stored.length === 0 && categoryUploads.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm text-slate-500">Todavía no cargaste archivos en esta categoría.</p>}
        </article>;
      })}
    </div>
  </section>;
}
