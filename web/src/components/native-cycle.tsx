"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    __OLYMPUS_NATIVE__?: boolean;
    webkit?: { messageHandlers?: { olympus?: { postMessage: (value: unknown) => void } } };
  }
}

type FinalDelivery = { id: string; name: string; mimeType: string; url: string | null; evaluation: string };

type Props = {
  assignmentId: string;
  studentPrompt: string;
  professorPrompt: string;
  reviewContext: string;
  hasUsableMaterial: boolean;
  failedBriefNames: string[];
  finalDeliveries: FinalDelivery[];
};

type NativeProgress = { status?: string; stage?: string; round?: number; fileName?: string; evaluation?: string; score?: number | null };
type NativeFile = { fileName: string; mimeType: string; fileBase64: string };
type NativeComplete = NativeProgress & { formats: Array<"docx" | "xlsx">; files: NativeFile[]; evaluation: string; rounds: number };

function fileFromBase64(file: NativeFile) {
  const binary = window.atob(file.fileBase64);
  const chunks: ArrayBuffer[] = [];
  for (let offset = 0; offset < binary.length; offset += 1024 * 1024) {
    const slice = binary.slice(offset, offset + 1024 * 1024);
    const buffer = new ArrayBuffer(slice.length);
    const bytes = new Uint8Array(buffer);
    for (let index = 0; index < slice.length; index++) bytes[index] = slice.charCodeAt(index);
    chunks.push(buffer);
  }
  return new File(chunks, file.fileName, { type: file.mimeType });
}

export function NativeCycle(props: Props) {
  const router = useRouter();
  const [native, setNative] = useState(false);
  const [formats, setFormats] = useState<Array<"docx" | "xlsx">>(["docx"]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [stage, setStage] = useState("");
  const [round, setRound] = useState(0);
  const [fileName, setFileName] = useState("");
  const [evaluation, setEvaluation] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [userFeedback, setUserFeedback] = useState("");
  const [pendingFinal, setPendingFinal] = useState<NativeComplete | null>(null);

  const send = useCallback((action: string, extra: Record<string, unknown> = {}) => {
    window.webkit?.messageHandlers?.olympus?.postMessage({ action, ...extra });
  }, []);

  const publish = useCallback(async (detail: NativeComplete) => {
    setPendingFinal(detail);
    setStatus("ChatGPT aprobó el trabajo. Guardando el archivo final en Drive…");
    setStage("publicando");
    try {
      const body = new FormData();
      for (const file of detail.files) body.append("files", fileFromBase64(file));
      body.set("formats", JSON.stringify(detail.formats));
      body.set("evaluation", detail.evaluation);
      body.set("rounds", String(detail.rounds));
      const response = await fetch(`/api/assignments/${props.assignmentId}/final-delivery`, { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No se pudo guardar la entrega final.");
      setStatus(detail.files.length > 1 ? "Entrega final completa aprobada y guardada en Google Drive." : "Entrega final aprobada y guardada en Google Drive.");
      setStage("completado");
      setPendingFinal(null);
      send("cycle-persisted");
      router.refresh();
    } catch (error) {
      setStatus(`${error instanceof Error ? error.message : "No se pudo guardar la entrega final."} El archivo sigue disponible para reintentar.`);
      setStage("guardado pendiente");
    } finally {
      setRunning(false);
    }
  }, [props.assignmentId, router, send]);

  useEffect(() => {
    const detect = () => setNative(Boolean(window.__OLYMPUS_NATIVE__ && window.webkit?.messageHandlers?.olympus));
    const progress = (event: Event) => {
      const detail = (event as CustomEvent<NativeProgress>).detail;
      if (detail.status) setStatus(detail.status);
      if (detail.stage) setStage(detail.stage);
      if (detail.round) setRound(detail.round);
      if (detail.fileName) setFileName(detail.fileName);
      if (detail.evaluation) setEvaluation(detail.evaluation);
      if (typeof detail.score === "number") setScore(detail.score);
    };
    const failed = (event: Event) => {
      const detail = (event as CustomEvent<NativeProgress>).detail;
      progress(event);
      setStatus(detail.status || "El ciclo se detuvo sin publicar ningún archivo.");
      setRunning(false);
    };
    const complete = (event: Event) => {
      const detail = (event as CustomEvent<NativeComplete>).detail;
      setEvaluation(detail.evaluation);
      setScore(10);
      setRound(detail.rounds);
      setFileName(detail.fileName || detail.files.map(file => file.fileName).join(", "));
      void publish(detail);
    };
    detect();
    window.addEventListener("olympus-native-ready", detect);
    window.addEventListener("olympus-cycle-progress", progress);
    window.addEventListener("olympus-cycle-failed", failed);
    window.addEventListener("olympus-cycle-complete", complete);
    return () => {
      window.removeEventListener("olympus-native-ready", detect);
      window.removeEventListener("olympus-cycle-progress", progress);
      window.removeEventListener("olympus-cycle-failed", failed);
      window.removeEventListener("olympus-cycle-complete", complete);
    };
  }, [publish]);

  const blockers = [
    !props.studentPrompt.trim() && "Falta el prompt de Claude.",
    !props.professorPrompt.trim() && "Falta el prompt de ChatGPT.",
    !props.hasUsableMaterial && "Subí un material procesable o agregá una nota manual antes de iniciar.",
    props.failedBriefNames.length > 0 && `Reprocesá o eliminá los archivos principales sin texto: ${props.failedBriefNames.join(", ")}.`,
  ].filter(Boolean) as string[];

  const prompt = useMemo(() => `${props.studentPrompt}\n\nActuá como alumno de la carrera de Contador Público y desarrollá el trabajo con rigor académico. Usá la información provista y, cuando corresponda, fuentes web verificables y citadas. Si falta evidencia, indicalo: no inventes datos, normas, citas ni resultados.\n\n${props.reviewContext}${userFeedback.trim() ? `\n\nINDICACIONES ADICIONALES DEL ALUMNO:\n${userFeedback.trim()}` : ""}`, [props.studentPrompt, props.reviewContext, userFeedback]);

  const start = () => {
    setRunning(true);
    setStatus("Preparando una conversación nueva y aislada en Claude…");
    setStage("preparando");
    setRound(1);
    setFileName("");
    setEvaluation("");
    setScore(null);
    setPendingFinal(null);
    send("start-file-cycle", { prompt, professorPrompt: props.professorPrompt, reviewContext: props.reviewContext, formats, maxRounds: 3 });
  };

  const toggleFormat = (format: "docx" | "xlsx") => {
    setFormats(current => current.includes(format)
      ? (current.length === 1 ? current : current.filter(value => value !== format))
      : ([...current, format].sort((a, b) => a === "docx" ? -1 : b === "docx" ? 1 : 0) as Array<"docx" | "xlsx">));
  };

  if (!native) return <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Abrí este trabajo desde la aplicación <strong>Olympus Campus</strong> para usar tus sesiones nativas de Claude y ChatGPT.</div>;

  return <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-serif text-2xl font-semibold">Desarrollo y corrección con IA</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">Claude crea el archivo, ChatGPT lo corrige y Olympus pide nuevas versiones hasta obtener 10/10. Sólo se guarda la entrega final aprobada.</p></div><button type="button" onClick={() => send("open-ai-apps")} className="rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-semibold">Abrir Claude y ChatGPT</button></div>
    <div className="mt-5 grid gap-4 md:grid-cols-[280px_1fr]"><fieldset disabled={running} className="rounded-xl border border-blue-200 bg-white p-4"><legend className="px-1 text-sm font-semibold">Archivos que pide el docente</legend><p className="mb-3 text-xs text-slate-500">Podés seleccionar uno o los dos.</p><div className="space-y-2"><label className="flex cursor-pointer items-center gap-3 text-sm font-medium"><input type="checkbox" checked={formats.includes("docx")} onChange={() => toggleFormat("docx")} className="size-4"/>Word (.docx)</label><label className="flex cursor-pointer items-center gap-3 text-sm font-medium"><input type="checkbox" checked={formats.includes("xlsx")} onChange={() => toggleFormat("xlsx")} className="size-4"/>Excel (.xlsx)</label></div></fieldset><label className="text-sm font-semibold">Indicaciones adicionales del alumno<textarea value={userFeedback} onChange={event => setUserFeedback(event.target.value)} disabled={running} rows={4} className="mt-2 w-full rounded-xl border border-blue-200 bg-white p-3 text-sm" placeholder="Ej. Usá un tono más natural, agregá un cuadro comparativo o respetá este criterio de diseño…"/></label></div>
    {blockers.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{blockers.join(" ")}</div>}
    <div className="mt-5 flex gap-3"><button type="button" disabled={running || blockers.length > 0} onClick={start} className="flex-1 rounded-xl bg-blue-600 px-5 py-4 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">{running ? "Ciclo en curso…" : "Iniciar Claude → ChatGPT → Claude"}</button>{running && <button type="button" onClick={() => { send("cancel-file-cycle"); setStatus("Cancelando el ciclo…"); }} className="rounded-xl border border-red-300 bg-white px-5 py-3 text-sm font-semibold text-red-700">Cancelar</button>}</div>
    {status && <div className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-blue-950"><div className="flex flex-wrap gap-x-5 gap-y-1"><strong>{status}</strong>{round > 0 && <span>Ronda {round}/3</span>}{stage && <span className="capitalize">Etapa: {stage}</span>}{fileName && <span>Archivo: {fileName}</span>}{score !== null && <span>Calificación: {score}/10</span>}</div></div>}
    {evaluation && <details open className="mt-4 rounded-xl bg-white p-4"><summary className="cursor-pointer font-semibold">Última corrección de ChatGPT</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap font-sans text-sm text-slate-700">{evaluation}</pre></details>}
    {pendingFinal && <button type="button" onClick={() => void publish(pendingFinal)} className="mt-4 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Reintentar guardado en Drive</button>}
    {props.finalDeliveries.length > 0 && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Entrega final · 10/10</p><div className="mt-3 space-y-3">{props.finalDeliveries.map(delivery => <div key={delivery.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3"><p className="font-semibold text-emerald-950">{delivery.name}</p><div className="flex flex-wrap gap-2"><a href={`/api/documents/${delivery.id}/download`} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Descargar</a>{delivery.url && <a href={delivery.url} target="_blank" rel="noreferrer" className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800">Abrir en Drive</a>}</div></div>)}</div>{props.finalDeliveries[0]?.evaluation && <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-emerald-900">Ver corrección final conjunta</summary><pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-emerald-950">{props.finalDeliveries[0].evaluation}</pre></details>}</div>}
  </section>;
}
