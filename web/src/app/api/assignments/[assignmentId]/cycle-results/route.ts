import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params; const body = await request.json();
  if (typeof body.draft !== "string" || typeof body.evaluation !== "string" || !body.draft.trim() || !body.evaluation.trim()) return NextResponse.json({ error: "Resultado incompleto" }, { status: 400 });
  const supabase = await createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const { data: assignment } = await supabase.from("assignments").select("id").eq("id", assignmentId).single();
  if (!assignment) return NextResponse.json({ error: "Trabajo inexistente" }, { status: 404 });
  const scoreMatches = [...body.evaluation.matchAll(/calificaci[oó]n\s*:\s*(10|[0-9](?:[.,][0-9]+)?)\s*(?:\/|sobre)\s*10/ig)]; const scoreMatch = scoreMatches.at(-1);
  const score = scoreMatch ? Number(scoreMatch[1].replace(",", ".")) : null; const completed = score === 10;
  const { data: run, error: runError } = await supabase.from("ai_runs").insert({ assignment_id: assignmentId, status: completed ? "completed" : "blocked", current_round: Number(body.rounds) || 1, current_step: "evaluated", idempotency_key: crypto.randomUUID() }).select("id").single();
  if (runError) return NextResponse.json({ error: runError.message }, { status: 500 });
  const { data: latest } = await supabase.from("versions").select("version_number").eq("assignment_id", assignmentId).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const { data: version, error: versionError } = await supabase.from("versions").insert({ assignment_id: assignmentId, run_id: run.id, version_number: (latest?.version_number ?? 0) + 1, author: "claude", content: { text: body.draft } }).select("id").single();
  if (versionError) return NextResponse.json({ error: versionError.message }, { status: 500 });
  const { error: evaluationError } = await supabase.from("evaluations").insert({ assignment_id: assignmentId, version_id: version.id, estimated_score: score, feedback: body.evaluation });
  if (evaluationError) return NextResponse.json({ error: evaluationError.message }, { status: 500 });
  await supabase.from("assignments").update({ status: completed ? "completed" : "blocked", updated_at: new Date().toISOString() }).eq("id", assignmentId);
  return NextResponse.json({ saved: true, versionId: version.id, score });
}
