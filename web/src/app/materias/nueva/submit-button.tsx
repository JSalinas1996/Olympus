"use client";

import { useFormStatus } from "react-dom";

export function CreateSubjectButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">{pending ? "Creando materia y carpetas…" : "Guardar materia"}</button>;
}
