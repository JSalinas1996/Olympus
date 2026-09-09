"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reprocessDriveDocument, uploadAssignmentDocument } from "@/lib/drive/storage";

const textSchema = z.object({ subjectId: z.string().uuid(), assignmentId: z.string().uuid(), projectInformation: z.string().max(100000), problemStatement: z.string().max(100000), objective: z.string().max(50000), instructions: z.string().max(100000), studentPromptOverride: z.string().max(30000), professorPromptOverride: z.string().max(30000) });

export async function saveAssignment(formData: FormData) {
  const parsed = textSchema.safeParse(Object.fromEntries(formData)); if (!parsed.success) redirect("/?error=invalid-assignment");
  const { subjectId, assignmentId, ...values } = parsed.data; const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("assignments").update({ project_information: values.projectInformation, problem_statement: values.problemStatement, objective: values.objective, instructions: values.instructions, student_prompt_override: values.studentPromptOverride || null, professor_prompt_override: values.professorPromptOverride || null }).eq("id", assignmentId).eq("subject_id", subjectId);
  if (error) redirect("/?error=save-assignment"); revalidatePath(`/materias/${subjectId}/trabajos/${assignmentId}`);
}

export async function uploadDocument(formData: FormData) {
  const subjectId = String(formData.get("subjectId") || ""); const assignmentId = String(formData.get("assignmentId") || ""); const kind = String(formData.get("kind") || "source"); const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 40 * 1024 * 1024) redirect("/?error=invalid-file");
  if (!["source", "assignment", "rubric", "precedent_work", "precedent_correction"].includes(kind)) redirect("/?error=invalid-kind");
  const supabase = await createSupabaseServerClient(); const { data: assignment } = await supabase.from("assignments").select("drive_folder_id").eq("id", assignmentId).eq("subject_id", subjectId).single();
  if (!assignment?.drive_folder_id) redirect("/?error=drive-folder-missing");
  await uploadAssignmentDocument({ subjectId, assignmentId, folderId: assignment.drive_folder_id, kind: kind as "source" | "assignment" | "rubric" | "precedent_work" | "precedent_correction", file });
  revalidatePath(`/materias/${subjectId}/trabajos/${assignmentId}`);
}

export async function reprocessDocument(formData: FormData) {
  const subjectId = String(formData.get("subjectId") || ""); const assignmentId = String(formData.get("assignmentId") || ""); const documentId = String(formData.get("documentId") || "");
  await reprocessDriveDocument(documentId); revalidatePath(`/materias/${subjectId}/trabajos/${assignmentId}`);
}
