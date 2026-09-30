"use client";

import { useState } from "react";
import { EFFORT_LABELS, effortOptionsFor, modelOptionsFor, parseModelPreference, type AIProvider } from "@/lib/ai/model-options";

type Props = {
  provider: AIProvider;
  prefix: string;
  model?: string | null;
  effort?: string | null;
  allowInherit?: boolean;
  inheritedLabel?: string;
};

export function AIModelFields({ provider, prefix, model = "", effort = "", allowInherit = false, inheritedLabel = "configuración superior" }: Props) {
  const options = modelOptionsFor(provider);
  const preference = parseModelPreference(provider, model);
  const known = preference.mode === "family";
  const [choice, setChoice] = useState(model ? (known ? preference.storedValue : "__custom__") : "");
  const efforts = effortOptionsFor(provider);
  const providerLabel = provider === "claude" ? "Claude" : "ChatGPT";

  return <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <legend className="px-1 text-sm font-bold text-slate-800">{providerLabel}</legend>
    <div className="mt-2 grid gap-4 sm:grid-cols-2">
      <label>
        <span className="mb-2 block text-sm font-semibold">Modelo</span>
        <select name={`${prefix}ModelChoice`} value={choice} onChange={event => setChoice(event.target.value)} required={!allowInherit} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
          {allowInherit && <option value="">Usar {inheritedLabel}</option>}
          {!allowInherit && <option value="" disabled>Seleccioná un modelo</option>}
          {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          <option value="__custom__">Otro modelo…</option>
        </select>
        {choice === "__custom__" && <input name={`${prefix}CustomModel`} defaultValue={known ? "" : model ?? ""} required className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" placeholder="Nombre exacto que muestra la aplicación" />}
      </label>
      <label>
        <span className="mb-2 block text-sm font-semibold">Nivel de esfuerzo</span>
        <select name={`${prefix}Effort`} defaultValue={effort || (allowInherit ? "" : "automatic")} required={!allowInherit} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
          {allowInherit && <option value="">Usar {inheritedLabel}</option>}
          {efforts.map(value => <option key={value} value={value}>{EFFORT_LABELS[value]}</option>)}
        </select>
      </label>
    </div>
  </fieldset>;
}
