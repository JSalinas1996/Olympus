"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    __OLYMPUS_NATIVE__?: boolean;
    webkit?: { messageHandlers?: { olympus?: { postMessage: (value: unknown) => void } } };
  }
}

type FinalDelivery = {
  id: string;
  name: string;
  mimeType: string;
  url: string | null;
  evaluation: string;
} | null;

type Props = {
  assignmentId: string;
  subject: string;
  assignment: string;
  studentPrompt: string;
  professorPrompt: string;
  projectInformation: string;
  problemStatement: string;
  objective: string;
  rubric: string;
  instructions: string;
  documents: { name: string; kind: string; url: string | null; status: string; text: string }[];
  finalDelivery: FinalDelivery;
};

type NativeProgress = {
  status?: string;
  stage?: string;
  round?: number;
  fileName?: string;
  evaluation?: string;
  score?: number | null;
};

type NativeComplete = NativeProgress & {
  fileName: string;
  mimeType: string;
  fileBase64: string;
  evaluation: string;
  rounds: number;
};

function fileFromBase64(detail: NativeComplete) {
  const binary = window.atob(detail.fileBase64);
  const chunks: ArrayBuffer[] = [];
  for (let offset = 0; offset < binary.length; offset += 1024 * 1024) {
    const slice = binary.slice(offset, offset + 1024 * 1024);
    const buffer = new ArrayBuffer(slice.length);
    const bytes = new Uint8Array(buffer);
    for (let index = 0; index < slice.length; index++) bytes[index] = slice.charCodeAt(index);
    chunks.push(buffer);
  }
  return new File(chunks, detail.fileName, { type: detail.mimeType });
}

export function NativeCycle(props: Props) {
  const router = useRouter();
  const [native, setNative] = useState(false);
  const [format, setFormat] = useState<"docx" | "xlsx">("docx");
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
      body.set("file", fileFromBase64(detail));
      body.set("evaluation", detail.evaluation);
      body.set("rounds", String(detail.rounds));
      const response = await fetch(`/api/assignments/${props.assignmentId}/final-delivery`, { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No se pudo guardar la entrega final.");
      setStatus("Entrega final aprobada y guardada en Google Drive.");
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
      setFileName(detail.fileName);
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

  const readyDocuments = useMemo(() => props.documents.filter(document => document.status === "ready" && document.text.trim()), [props.documents]);
  const hasWrittenMaterial = [props.projectInformation, props.problemStatement, props.objective, props.rubric, props.instructions].some(value => value.trim());
  const blockers = [
    !props.studentPrompt.trim() && "Falta el prompt de Claude.",
    !props.professorPrompt.trim() && "Falta el prompt de ChatGPT.",
    readyDocuments.length === 0 && !hasWrittenMaterial && "Subí un material o completá el expediente escrito antes de iniciar.",
  ].filter(Boolean) as string[];

  const reviewContext = useMemo(() => `MATERIA: ${props.subject}\nTRABAJO: ${props.assignment}\n\nINFORMACIÓN DEL PROYECTO:\n${props.projectInformation}\n\nSITUACIÓN PROBLEMÁTICA:\n${props.problemStatement}\n\nOBJETIVO:\n${props.objective}\n\nRÚBRICA DE EVALUACIÓN:\n${props.rubric}\n\nCONSIGNAS:\n${props.instructions}\n\nMATERIALES PROCESADOS POR OLYMPUS:\n${readyDocuments.map(document => `\n--- ${document.name} (${document.kind}) ---\n${document.text}\nFuente en Drive: ${document.url ?? "sin enlace"}`).join("\n")}`, [props.subject, props.assignment, props.projectInformation, props.problemStatement, props.objective, props.rubric, props.instructions, readyDocuments]);

  const prompt = useMemo(() => `${props.studentPrompt}\n\nActuá como alumno de la carrera de Contador Público y desarrollá el trabajo con rigor académico. Usá la información provista y, cuando corresponda, fuentes web verificables y citadas. Si falta evidencia, indicalo: no inventes datos, normas, citas ni resultados.\n\n${reviewContext}${userFeedback.trim() ? `\n\nINDICACIONES ADICIONALES DEL ALUMNO:\n${userFeedback.trim()}` : ""}`, [props.studentPrompt, reviewContext, userFeedback]);

  const start = () => {
    setRunning(true);
    setStatus("Preparando una conversación nueva y aislada en Claude…");
    setStage("preparando");
    setRound(1);
    setFileName("");
    setEvaluation("");
    setScore(null);
    setPendingFinal(null);
    send("start-file-cycle", { prompt, professorPrompt: props.professorPrompt, reviewContext, format, maxRounds: 3 });
  };

  if (!native) return <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Abrí este trabajo desde la aplicación <strong>Olympus Campus</strong> para usar tus sesiones nativas de Claude y ChatGPT.</div>;

  return <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="font-serif text-2xl font-semibold">Desarrollo y corrección con IA</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">Claude crea el archivo, ChatGPT lo corrige y Olympus pide nuevas versiones hasta obtener 10/10. Sólo se guarda la entrega final aprobada.</p></div>
      <button type="button" onClick={() => send("open-ai-apps")} className="rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-semibold">Abrir Claude y ChatGPT</button>
    </div>

    <div className="mt-5 grid gap-4 md:grid-cols-[220px_1fr]">
      <label className="text-sm font-semibold">Formato de la entrega<select value={format} onChange={event => setFormat(event.target.value as "docx" | "xlsx")} disabled={running} className="mt-2 block w-full rounded-xl border border-blue-200 bg-white px-3 py-3"><option value="docx">Word (.docx)</option><option value="xlsx">Excel (.xlsx)</option></select></label>
      <label className="text-sm font-semibold">Indicaciones adicionales del alumno<textarea value={userFeedback} onChange={event => setUserFeedback(event.target.value)} disabled={running} rows={3} className="mt-2 w-full rounded-xl border border-blue-200 bg-white p-3 text-sm" placeholder="Ej. Usá un tono más natural, agregá un cuadro comparativo o respetá este criterio de diseño…"/></label>
    </div>

    {blockers.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{blockers.join(" ")}</div>}
    <div className="mt-5 flex gap-3">
      <button type="button" disabled={running || blockers.length > 0} onClick={start} className="flex-1 rounded-xl bg-blue-600 px-5 py-4 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">{running ? "Ciclo en curso…" : "Iniciar Claude → ChatGPT → Claude"}</button>
      {running && <button type="button" onClick={() => { send("cancel-file-cycle"); setStatus("Cancelando el ciclo…"); }} className="rounded-xl border border-red-300 bg-white px-5 py-3 text-sm font-semibold text-red-700">Cancelar</button>}
    </div>

    {status && <div className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-blue-950"><div className="flex flex-wrap gap-x-5 gap-y-1"><strong>{status}</strong>{round > 0 && <span>Ronda {round}/3</span>}{stage && <span className="capitalize">Etapa: {stage}</span>}{fileName && <span>Archivo: {fileName}</span>}{score !== null && <span>Calificación: {score}/10</span>}</div></div>}
    {evaluation && <details open className="mt-4 rounded-xl bg-white p-4"><summary className="cursor-pointer font-semibold">Última corrección de ChatGPT</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap font-sans text-sm text-slate-700">{evaluation}</pre></details>}
    {pendingFinal && <button type="button" onClick={() => void publish(pendingFinal)} className="mt-4 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Reintentar guardado en Drive</button>}

    {props.finalDelivery && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Entrega final · 10/10</p><p className="mt-1 font-semibold text-emerald-950">{props.finalDelivery.name}</p></div><div className="flex flex-wrap gap-2"><a href={`/api/documents/${props.finalDelivery.id}/download`} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Descargar archivo final</a>{props.finalDelivery.url && <a href={props.finalDelivery.url} target="_blank" rel="noreferrer" className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800">Abrir en Drive</a>}</div></div>{props.finalDelivery.evaluation && <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-emerald-900">Ver corrección final</summary><pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-emerald-950">{props.finalDelivery.evaluation}</pre></details>}</div>}
  </section>;
}
