import { subjects as demoSubjects, type Subject } from "@/lib/demo-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SubjectRow = {
  id: string; name: string; code: string | null; period: string | null;
  status: "active" | "completed"; progress: number;
};

export async function getSubjects(): Promise<Subject[]> {
  if (!isSupabaseConfigured()) return demoSubjects;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("id,name,code,period,status,progress,documents(count),precedents(count)")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`No se pudieron cargar las materias: ${error.message}`);

  return (data as unknown as (SubjectRow & { documents: { count: number }[]; precedents: { count: number }[] })[]).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code ?? "Sin código",
    period: row.period ?? "Sin período",
    status: row.status === "completed" ? "Finalizada" : "En curso",
    sources: row.documents?.[0]?.count ?? 0,
    precedents: row.precedents?.[0]?.count ?? 0,
    update: "Sin actividad reciente",
    updateTone: "neutral",
    progress: row.progress,
  }));
}
