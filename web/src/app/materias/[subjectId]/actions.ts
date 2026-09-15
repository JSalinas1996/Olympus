"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { effortFromForm, modelFromForm } from "@/lib/ai/form-values";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  subjectId: z.string().uuid(),
  developmentPrompt: z.string().trim().max(30000),
  correctionPrompt: z.string().trim().max(30000),
  studyReportPrompt: z.string().trim().max(30000),
});

export async function saveSubjectAISettings(formData: FormData) {
  const parsed = schema.safeParse({
    subjectId: formData.get("subjectId"), developmentPrompt: formData.get("developmentPrompt") ?? "",
    correctionPrompt: formData.get("correctionPrompt") ?? "", studyReportPrompt: formData.get("studyReportPrompt") ?? "",
  });
  if (!parsed.success) redirect("/?error=invalid-subject-ai-settings");
  let models;
  try {
    models = {
      claudeModel: modelFromForm(formData, "claude", false), claudeEffort: effortFromForm(formData, "claude", "claude", false),
      chatgptModel: modelFromForm(formData, "chatgpt", false), chatgptEffort: effortFromForm(formData, "chatgpt", "chatgpt", false),
    };
  } catch { redirect(`/materias/${parsed.data.subjectId}?error=modelos`); }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("subjects").update({
    student_prompt: parsed.data.developmentPrompt,
    professor_prompt: parsed.data.correctionPrompt,
    study_report_prompt: parsed.data.studyReportPrompt,
    claude_model: models.claudeModel,
    claude_effort: models.claudeEffort,
    chatgpt_model: models.chatgptModel,
    chatgpt_effort: models.chatgptEffort,
    updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.subjectId);
  if (error) redirect(`/materias/${parsed.data.subjectId}?error=guardado`);
  revalidatePath(`/materias/${parsed.data.subjectId}`);
  redirect(`/materias/${parsed.data.subjectId}?saved=1`);
}
