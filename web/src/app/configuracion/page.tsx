import Link from "next/link";
import { Settings2 } from "lucide-react";
import { AIModelFields } from "@/components/ai-model-fields";
import { LogoSettings } from "@/components/logo-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveGeneralAISettings } from "./actions";
import { DEFAULT_AI_SETTINGS } from "@/lib/ai/settings";

export default async function ConfigurationPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: settings } = await supabase.from("user_ai_settings").select("*").maybeSingle();
  return <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 lg:py-12"><div className="mx-auto max-w-4xl">
    <Link href="/" className="text-sm font-semibold text-blue-700">← Volver a materias</Link>
    <div className="mt-6 flex items-center gap-3"><div className="grid size-12 place-items-center rounded-xl bg-blue-100 text-blue-700"><Settings2 className="size-6" /></div><div><h1 className="font-serif text-4xl font-semibold">Configuración</h1><p className="mt-1 text-slate-500">Definí los valores generales que heredarán las materias y los TP.</p></div></div>
    <form action={saveGeneralAISettings} className="mt-8 space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
      <section><h2 className="font-serif text-2xl font-semibold">Prompts generales</h2><p className="mt-1 text-sm text-slate-500">Podrás reemplazarlos dentro de una materia o de un trabajo específico.</p>
        <div className="mt-5 space-y-5">
          <label className="block"><span className="mb-2 block text-sm font-semibold">Desarrollo con Claude</span><textarea required name="developmentPrompt" defaultValue={settings?.development_prompt ?? ""} rows={7} className="w-full rounded-xl border border-slate-200 p-4 text-sm" placeholder="Indicaciones generales para desarrollar los trabajos…" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold">Corrección con ChatGPT</span><textarea required name="correctionPrompt" defaultValue={settings?.correction_prompt ?? ""} rows={7} className="w-full rounded-xl border border-slate-200 p-4 text-sm" placeholder="Criterios generales de corrección…" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold">Informe técnico de estudio con Claude</span><textarea required name="studyReportPrompt" defaultValue={settings?.study_report_prompt ?? ""} rows={7} className="w-full rounded-xl border border-slate-200 p-4 text-sm" placeholder="Estructura y contenido del informe técnico…" /></label>
        </div>
      </section>
      <section className="border-t border-slate-200 pt-6"><h2 className="font-serif text-2xl font-semibold">Modelos predeterminados</h2><p className="mt-1 text-sm text-slate-500">Olympus comprobará estas selecciones antes de enviar cada mensaje.</p><div className="mt-5 grid gap-4 md:grid-cols-2"><AIModelFields provider="claude" prefix="claude" model={settings?.claude_model || DEFAULT_AI_SETTINGS.claudeModel} effort={settings?.claude_effort || DEFAULT_AI_SETTINGS.claudeEffort} /><AIModelFields provider="chatgpt" prefix="chatgpt" model={settings?.chatgpt_model || DEFAULT_AI_SETTINGS.chatgptModel} effort={settings?.chatgpt_effort || DEFAULT_AI_SETTINGS.chatgptEffort} /></div></section>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      {saved && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Configuración guardada.</p>}
      <div className="flex justify-end"><button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">Guardar configuración</button></div>
    </form>
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9"><LogoSettings logo={settings?.logo_name ? { name: settings.logo_name, url: settings.logo_drive_web_url } : null} /></section>
  </div></main>;
}
