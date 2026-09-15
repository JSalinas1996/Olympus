"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Logo = { name: string; url: string | null } | null;

export function LogoSettings({ logo }: { logo: Logo }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true); setMessage("Guardando el logo en Drive…");
    const body = new FormData(); body.set("logo", file);
    try {
      const response = await fetch("/api/settings/logo", { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No se pudo guardar el logo.");
      setMessage("Logo guardado correctamente."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar el logo."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  };

  const remove = async () => {
    setBusy(true); setMessage("Eliminando el logo…");
    try {
      const response = await fetch("/api/settings/logo", { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No se pudo eliminar el logo.");
      setMessage("Logo eliminado."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo eliminar el logo."); }
    finally { setBusy(false); }
  };

  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h3 className="font-semibold">Logo institucional</h3><p className="mt-1 text-sm text-slate-500">Se insertará en todos los informes técnicos. PNG o JPEG, hasta 10 MB.</p></div>
      <input ref={input} type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" disabled={busy} onChange={event => void upload(event.target.files?.[0])} className="block max-w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2.5 file:font-semibold file:text-white" />
    </div>
    {logo && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white p-4"><div><p className="text-sm font-semibold text-emerald-800">{logo.name}</p><p className="text-xs text-slate-500">Logo vigente en Google Drive</p></div><div className="flex flex-wrap gap-2"><a href="/api/settings/logo/download" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">Descargar</a>{logo.url && <a href={logo.url} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">Abrir en Drive</a>}<button type="button" disabled={busy} onClick={() => void remove()} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Eliminar</button></div></div>}
    {message && <p role="status" className="mt-3 text-sm font-medium text-slate-700">{message}</p>}
  </div>;
}
