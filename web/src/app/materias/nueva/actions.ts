"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSubjectDriveStructure } from "@/lib/drive/storage";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { effortFromForm, modelFromForm } from "@/lib/ai/form-values";

const schema = z.object({ name: z.string().trim().min(2).max(120), code: z.string().trim().max(30), period: z.string().trim().max(80), studentPrompt: z.string().trim().max(30000), professorPrompt: z.string().trim().max(30000), studyReportPrompt: z.string().trim().max(30000) });

export async function createSubject(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/materias/nueva?error=Configurá Supabase para guardar materias");
  const parsed = schema.safeParse({ name: formData.get("name"), code: formData.get("code") ?? "", period: formData.get("period") ?? "", studentPrompt: formData.get("studentPrompt") ?? "", professorPrompt: formData.get("professorPrompt") ?? "", studyReportPrompt: formData.get("studyReportPrompt") ?? "" });
  if (!parsed.success) redirect("/materias/nueva?error=Revisá los datos ingresados");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  let models; try { models = { claudeModel: modelFromForm(formData, "claude", false), claudeEffort: effortFromForm(formData, "claude", "claude", false), chatgptModel: modelFromForm(formData, "chatgpt", false), chatgptEffort: effortFromForm(formData, "chatgpt", "chatgpt", false) }; } catch { redirect("/materias/nueva?error=Revisá los modelos seleccionados"); }
  const { data: subject, error } = await supabase.from("subjects").insert({ owner_id: user.id, name: parsed.data.name, code: parsed.data.code || null, period: parsed.data.period || null, student_prompt: parsed.data.studentPrompt, professor_prompt: parsed.data.professorPrompt, study_report_prompt: parsed.data.studyReportPrompt, claude_model: models.claudeModel, claude_effort: models.claudeEffort, chatgpt_model: models.chatgptModel, chatgpt_effort: models.chatgptEffort }).select("id,name").single();
  if (error) redirect("/materias/nueva?error=No pudimos guardar la materia");
  const { data: assignments, error: assignmentsError } = await supabase.from("assignments").insert(
    [1, 2, 3, 4].map((number) => ({ owner_id: user.id, subject_id: subject.id, title: `TP${number}` }))
  ).select("id,title");
  if (assignmentsError) redirect("/materias/nueva?error=No pudimos crear los trabajos prácticos");
  try {
    await createSubjectDriveStructure(subject.id, subject.name, assignments);
  } catch {
    redirect("/?drive=structure-error");
  }
  redirect("/");
}
