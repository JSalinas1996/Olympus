"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EFFORT_LABELS, isEffort } from "@/lib/ai/model-options";
import { buildStudyReportPrompt } from "@/lib/study-report";

type FileSummary = { id: string; name: string; url: string | null };
type NativeFile = { fileName: string; mimeType: string; fileBase64: string };
type NativeProgress = { status?: string; stage?: string; fileName?: string };

type Props = {
  assignmentId: string;
  reportPrompt: string;
  reportPromptOrigin: string;
  reviewContext: string;
  claudeModel: { model: string; effort: string; origin: string };
  logo: { name: string; url: string | null } | null;
  finalDeliveries: FileSummary[];
  reports: FileSummary[];
};

function nativeSend(action: string, extra: Record<string, unknown> = {}) {
  const bridge = (window as unknown as { webkit?: { messageHandlers?: { olympus?: { postMessage: (value: unknown) => void } } } }).webkit;
  bridge?.messageHandlers?.olympus?.postMessage({ action, ...extra });
}

function nativeAvailable() {
  const value = window as unknown as { __OLYMPUS_NATIVE__?: boolean; webkit?: { messageHandlers?: { olympus?: unknown } } };
  return Boolean(value.__OLYMPUS_NATIVE__ && value.webkit?.messageHandlers?.olympus);
}

function effortLabel(value: string) {
  return isEffort(value) ? EFFORT_LABELS[value] : value;
}

function fileFromBase64(file: NativeFile) {
  const binary = window.atob(file.fileBase64); const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], file.fileName, { type: file.mimeType });
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onerror = () => reject(reader.error); reader.onload = () => resolve(String(reader.result).split(",")[1] || ""); reader.readAsDataURL(blob);
  });
}

export function StudyReport(props: Props) {
  const router = useRouter(); const [native, setNative] = useState(false); const [running, setRunning] = useState(false);
  const [status, setStatus] = useState(""); const [stage, setStage] = useState(""); const [pending, setPending] = useState<NativeFile | null>(null);

  const publish = useCallback(async (file: NativeFile) => {
    setPending(file); setStage("publicando"); setStatus("Guardando el informe técnico en Google Drive…");
    try {
      const body = new FormData(); body.set("file", fileFromBase64(file)); body.set("configurationSnapshot", JSON.stringify({ claude: props.claudeModel, reportPromptOrigin: props.reportPromptOrigin }));
      const response = await fetch(`/api/assignments/${props.assignmentId}/study-report`, { method: "POST", body });
      const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || "No se pudo guardar el informe.");
      setPending(null); setStage("completado"); setStatus(result.warning || "Informe técnico guardado en Google Drive."); nativeSend("study-report-persisted"); router.refresh();
    } catch (error) { setStage("guardado pendiente"); setStatus(`${error instanceof Error ? error.message : "No se pudo guardar el informe."} Podés reintentar sin volver a generarlo.`); }
    finally { setRunning(false); }
  }, [props.assignmentId, props.claudeModel, props.reportPromptOrigin, router]);

  useEffect(() => {
    const detect = () => setNative(nativeAvailable());
    const progress = (event: Event) => { const detail = (event as CustomEvent<NativeProgress>).detail; if (detail.status) setStatus(detail.status); if (detail.stage) setStage(detail.stage); };
    const failed = (event: Event) => { progress(event); setRunning(false); };
    const complete = (event: Event) => { const detail = (event as CustomEvent<{ file: NativeFile }>).detail; void publish(detail.file); };
    detect(); window.addEventListener("olympus-native-ready", detect); window.addEventListener("olympus-study-report-progress", progress); window.addEventListener("olympus-study-report-failed", failed); window.addEventListener("olympus-study-report-complete", complete);
    return () => { window.removeEventListener("olympus-native-ready", detect); window.removeEventListener("olympus-study-report-progress", progress); window.removeEventListener("olympus-study-report-failed", failed); window.removeEventListener("olympus-study-report-complete", complete); };
  }, [publish]);

  const blockers = [
    !props.finalDeliveries.length && "Primero necesitás una entrega final.", !props.reportPrompt.trim() && "Falta configurar el prompt del informe.",
    !props.claudeModel.model && "Falta seleccionar el modelo de Claude.", !props.logo && "Falta cargar el logo general en Configuración.",
  ].filter(Boolean) as string[];

  const start = async () => {
    setRunning(true); setStage("preparando"); setStatus("Preparando la entrega final y el logo…");
    try {
      const [contextResponse, logoResponse] = await Promise.all([fetch(`/api/assignments/${props.assignmentId}/study-report/context`), fetch("/api/settings/logo/download")]);
      const context = await contextResponse.json().catch(() => ({})); if (!contextResponse.ok) throw new Error(context.error || "No se pudo preparar la entrega final.");
      if (!logoResponse.ok) { const result = await logoResponse.json().catch(() => ({})); throw new Error(result.error || "No se pudo preparar el logo."); }
      const logoBlob = await logoResponse.blob(); const logoBase64 = await blobToBase64(logoBlob);
      const prompt = buildStudyReportPrompt({ reportPrompt: props.reportPrompt, reviewContext: props.reviewContext, finalSections: context.finalSections });
      nativeSend("start-study-report", { prompt, claudeModel: { provider: "claude", model: props.claudeModel.model, effort: props.claudeModel.effort }, logo: { fileName: props.logo!.name, mimeType: logoBlob.type, fileBase64: logoBase64 } });
      setStatus("Comprobando el modelo de Claude…");
    } catch (error) { setStatus(error instanceof Error ? error.message : "No se pudo preparar el informe."); setStage("fallido"); setRunning(false); }
  };

  return <section className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-serif text-2xl font-semibold">Informe técnico de estudio</h2><p className="mt-1 text-sm text-slate-600">Claude lo genera como Word editable cuando vos decidís que la entrega está lista.</p></div>{props.logo?.url && <a href={props.logo.url} target="_blank" rel="noreferrer" className="rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-semibold">Ver logo</a>}</div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-white p-3"><p className="text-xs font-bold uppercase text-slate-400">Entrega final</p><p className="mt-1 text-sm font-semibold">{props.finalDeliveries.length ? props.finalDeliveries.map(file => file.name).join(", ") : "Pendiente"}</p></div><div className="rounded-xl bg-white p-3"><p className="text-xs font-bold uppercase text-slate-400">Prompt · {props.reportPromptOrigin}</p><p className="mt-1 text-sm font-semibold">{props.reportPrompt ? "Configurado" : "Sin configurar"}</p></div><div className="rounded-xl bg-white p-3"><p className="text-xs font-bold uppercase text-slate-400">Claude · {props.claudeModel.origin}</p><p className="mt-1 text-sm font-semibold">{props.claudeModel.model || "Sin configurar"} · {effortLabel(props.claudeModel.effort)}</p></div></div>
    {!native && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Abrí este TP desde Olympus Campus para generar el informe.</p>}
    {blockers.length > 0 && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{blockers.join(" ")}</p>}
    <div className="mt-4 flex gap-3"><button type="button" disabled={!native || running || blockers.length > 0} onClick={() => void start()} className="flex-1 rounded-xl bg-violet-700 px-5 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{running ? "Generando informe…" : "Generar informe técnico"}</button>{running && <button type="button" onClick={() => nativeSend("cancel-study-report")} className="rounded-xl border border-red-300 bg-white px-4 text-sm font-semibold text-red-700">Cancelar</button>}</div>
    {status && <p role="status" className="mt-4 rounded-xl bg-white p-4 text-sm font-semibold text-violet-950">{status}{stage && <span className="ml-3 font-normal capitalize">Etapa: {stage}</span>}</p>}
    {pending && <button type="button" onClick={() => void publish(pending)} className="mt-4 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Reintentar guardado en Drive</button>}
    {props.reports.length > 0 && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Informe vigente</p>{props.reports.map(report => <div key={report.id} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3"><strong className="text-sm">{report.name}</strong><div className="flex gap-2"><a href={`/api/documents/${report.id}/download`} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Descargar</a>{report.url && <a href={report.url} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold">Abrir en Drive</a>}</div></div>)}</div>}
  </section>;
}
