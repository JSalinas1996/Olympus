"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { effortFromForm, modelFromForm } from "@/lib/ai/form-values";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const promptsSchema = z.object({
  developmentPrompt: z.string().trim().min(1).max(30000),
  correctionPrompt: z.string().trim().min(1).max(30000),
  studyReportPrompt: z.string().trim().min(1).max(30000),
});

export async function saveGeneralAISettings(formData: FormData) {
  let models: { claudeModel: string; claudeEffort: string; chatgptModel: string; chatgptEffort: string };
  try {
    models = {
      claudeModel: modelFromForm(formData, "claude", true),
      claudeEffort: effortFromForm(formData, "claude", "claude", true),
      chatgptModel: modelFromForm(formData, "chatgpt", true),
      chatgptEffort: effortFromForm(formData, "chatgpt", "chatgpt", true),
    };
  } catch (error) {
    redirect(`/configuracion?error=${encodeURIComponent(error instanceof Error ? error.message : "Revisá los modelos seleccionados.")}`);
  }
  const prompts = promptsSchema.safeParse({
    developmentPrompt: formData.get("developmentPrompt"),
    correctionPrompt: formData.get("correctionPrompt"),
    studyReportPrompt: formData.get("studyReportPrompt"),
  });
  if (!prompts.success) redirect("/configuracion?error=Completá%20los%20tres%20prompts%20generales");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("user_ai_settings").upsert({
    owner_id: user.id,
    development_prompt: prompts.data.developmentPrompt,
    correction_prompt: prompts.data.correctionPrompt,
    study_report_prompt: prompts.data.studyReportPrompt,
    claude_model: models.claudeModel,
    claude_effort: models.claudeEffort,
    chatgpt_model: models.chatgptModel,
    chatgpt_effort: models.chatgptEffort,
    updated_at: new Date().toISOString(),
  }, { onConflict: "owner_id" });
  if (error) redirect(`/configuracion?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/configuracion");
  revalidatePath("/");
  redirect("/configuracion?saved=1");
}
