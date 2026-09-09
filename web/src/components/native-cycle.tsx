"use client";

import { useEffect, useMemo, useState } from "react";
import { Document, Packer, Paragraph, TextRun } from "docx";

declare global {
  interface Window {
    __OLYMPUS_NATIVE__?: boolean;
    webkit?: { messageHandlers?: { olympus?: { postMessage: (value: unknown) => void } } };
  }
}

type Props = {
  subject: string;
  assignment: string;
  studentPrompt: string;
  professorPrompt: string;
  projectInformation: string;
  problemStatement: string;
  objective: string;
  instructions: string;
  documents: { name: string; kind: string; url: string | null }[];
};

export function NativeCycle(props: Props) {
  const [native, setNative] = useState(false);
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState("");
  const [evaluation, setEvaluation] = useState("");
  const [userFeedback, setUserFeedback] = useState("");
  useEffect(() => {
    const detect = () => setNative(Boolean(window.__OLYMPUS_NATIVE__ && window.webkit?.messageHandlers?.olympus));
    const receive = (event: Event) => { const detail = (event as CustomEvent<{status: string; draft: string; evaluation: string}>).detail; setStatus(detail.status); setDraft(detail.draft); setEvaluation(detail.evaluation); };
    detect(); window.addEventListener("olympus-native-ready", detect); window.addEventListener("olympus-cycle-result", receive);
    return () => { window.removeEventListener("olympus-native-ready", detect); window.removeEventListener("olympus-cycle-result", receive); };
  }, []);
  const prompt = useMemo(() => `${props.studentPrompt}\n\nActuá como alumno de la carrera de Contador Público y desarrollá el trabajo con rigor académico. Usá exclusivamente la información provista o fuentes web verificables y citadas; si falta evidencia, indicalo y no inventes.\n\nMATERIA: ${props.subject}\nTRABAJO: ${props.assignment}\nINFORMACIÓN DEL PROYECTO:\n${props.projectInformation}\n\nSITUACIÓN PROBLEMÁTICA:\n${props.problemStatement}\n\nOBJETIVO:\n${props.objective}\n\nCONSIGNAS:\n${props.instructions}\n\nARCHIVOS DE RESPALDO EN DRIVE:\n${props.documents.map(d => `- ${d.name} (${d.kind})${d.url ? `: ${d.url}` : ""}`).join("\n")}\n\nPROMPT DEL CATEDRÁTICO QUE LUEGO EVALUARÁ EL RESULTADO:\n${props.professorPrompt}\n\nEntregá una primera versión completa, con citas y bibliografía comprobables.`, [props]);
  const send = (action: string, extra: Record<string, unknown> = {}) => window.webkit?.messageHandlers?.olympus?.postMessage({ action, ...extra });
  const downloadWord = async () => {
    const paragraphs = draft.split(/\n+/).map(line => new Paragraph({ children: [new TextRun(line)] }));
    const document = new Document({ sections: [{ children: [new Paragraph({ children: [new TextRun({ text: props.assignment, bold: true, size: 32 })] }), ...paragraphs] }] });
    const blob = await Packer.toBlob(document); const url = URL.createObjectURL(blob); const anchor = window.document.createElement("a");
    anchor.href = url; anchor.download = `${props.subject} - ${props.assignment}.docx`; anchor.click(); URL.revokeObjectURL(url);
  };
  if (!native) return <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Abrí este trabajo desde la aplicación <strong>Olympus Campus</strong> para usar tus sesiones nativas de Claude y ChatGPT.</div>;
  return <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-serif text-2xl font-semibold">Ciclo con aplicaciones nativas</h2><p className="mt-1 text-sm text-slate-600">Olympus prepara el expediente y lo envía a Claude usando tu sesión abierta.</p></div><button type="button" onClick={() => send("open-ai-apps")} className="rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-semibold">Abrir las IA</button></div>
    <button type="button" onClick={() => { setStatus("Claude está desarrollando el trabajo. Olympus esperará su respuesta y luego la enviará a ChatGPT…"); setDraft(""); setEvaluation(""); send("start-cycle", { prompt, professorPrompt: props.professorPrompt }); }} className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-4 font-semibold text-white hover:bg-blue-700">Iniciar Claude → ChatGPT</button>
    {status && <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-medium text-blue-900">{status}</p>}
    {draft && <details className="mt-4 rounded-xl bg-white p-4"><summary className="cursor-pointer font-semibold">Versión de Claude</summary><pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-slate-700">{draft}</pre><button type="button" onClick={downloadWord} className="mt-4 rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-800">Descargar como Word</button></details>}
    {evaluation && <details open className="mt-4 rounded-xl bg-white p-4"><summary className="cursor-pointer font-semibold">Corrección de ChatGPT</summary><pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-slate-700">{evaluation}</pre></details>}
    {draft && <div className="mt-4 rounded-xl bg-white p-4"><label className="block text-sm font-semibold">Mi devolución y cambios solicitados</label><textarea value={userFeedback} onChange={event => setUserFeedback(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm" placeholder="Ej. Reescribí la introducción con un tono más natural y agregá un cuadro comparativo…"/><button type="button" disabled={!userFeedback.trim()} onClick={() => { const revisionPrompt = `${prompt}\n\nVERSIÓN ANTERIOR:\n${draft}\n\nCORRECCIÓN DE CHATGPT:\n${evaluation}\n\nDEVOLUCIÓN DEL USUARIO:\n${userFeedback}\n\nRevisá el trabajo completo aplicando estas correcciones.`; setStatus("Claude está revisando el trabajo con tu devolución…"); setDraft(""); setEvaluation(""); send("start-cycle", { prompt: revisionPrompt, professorPrompt: props.professorPrompt }); }} className="mt-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Aplicar cambios y volver a corregir</button></div>}
  </section>;
}
