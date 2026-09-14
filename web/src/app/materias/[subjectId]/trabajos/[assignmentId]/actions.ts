"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteDriveDocument, reprocessDriveDocument } from "@/lib/drive/storage";

const assignmentSettingsSchema = z.object({
  subjectId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  manualNotes: z.string().max(100000),
  studentPromptOverride: z.string().max(30000),
  professorPromptOverride: z.string().max(30000),
});

const modelFeedbackSchema = z.object({
  subjectId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  documentId: z.string().uuid(),
  teacherFeedback: z.string().max(100000),
});

export async function saveAssignmentSettings(formData: FormData) {
  const parsed = assignmentSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/?error=invalid-assignment-settings");
  const { subjectId, assignmentId, manualNotes, studentPromptOverride, professorPromptOverride } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("assignments").update({
    manual_notes: manualNotes,
    student_prompt_override: studentPromptOverride || null,
    professor_prompt_override: professorPromptOverride || null,
    updated_at: new Date().toISOString(),
  }).eq("id", assignmentId).eq("subject_id", subjectId);
  if (error) redirect("/?error=save-assignment-settings");
  revalidatePath(`/materias/${subjectId}/trabajos/${assignmentId}`);
}

export async function saveModelFeedback(formData: FormData) {
  const parsed = modelFeedbackSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/?error=invalid-model-feedback");
  const { subjectId, assignmentId, documentId, teacherFeedback } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("documents").update({ teacher_feedback: teacherFeedback })
    .eq("id", documentId)
    .eq("assignment_id", assignmentId)
    .in("kind", ["precedent_work", "precedent_correction"]);
  if (error) redirect("/?error=save-model-feedback");
  revalidatePath(`/materias/${subjectId}/trabajos/${assignmentId}`);
}

export async function reprocessDocument(formData: FormData) {
  const subjectId = String(formData.get("subjectId") || ""); const assignmentId = String(formData.get("assignmentId") || ""); const documentId = String(formData.get("documentId") || "");
  await reprocessDriveDocument(documentId); revalidatePath(`/materias/${subjectId}/trabajos/${assignmentId}`);
}

export async function deleteDocument(formData: FormData) {
  const subjectId = String(formData.get("subjectId") || ""); const assignmentId = String(formData.get("assignmentId") || ""); const documentId = String(formData.get("documentId") || "");
  await deleteDriveDocument(documentId); revalidatePath(`/materias/${subjectId}/trabajos/${assignmentId}`);
}
