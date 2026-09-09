import "server-only";
import { google, drive_v3 } from "googleapis";
import { Readable } from "node:stream";
import { createGoogleOAuthClient, decryptTokens } from "@/lib/drive/oauth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const folderMimeType = "application/vnd.google-apps.folder";

async function createFolder(drive: drive_v3.Drive, name: string, parentId?: string) {
  const response = await drive.files.create({
    requestBody: { name, mimeType: folderMimeType, parents: parentId ? [parentId] : undefined },
    fields: "id,name,webViewLink",
  });
  if (!response.data.id) throw new Error(`Drive no devolvió el identificador de la carpeta ${name}.`);
  return response.data.id;
}

async function findFolder(drive: drive_v3.Drive, name: string, parentId?: string) {
  const escapedName = name.replaceAll("'", "\\'");
  const parents = parentId ? ` and '${parentId}' in parents` : "";
  const response = await drive.files.list({
    q: `name = '${escapedName}' and mimeType = '${folderMimeType}' and trashed = false${parents}`,
    fields: "files(id,name)", pageSize: 10,
  });
  return response.data.files?.[0]?.id ?? null;
}

async function findOrCreateFolder(drive: drive_v3.Drive, name: string, parentId?: string) {
  return (await findFolder(drive, name, parentId)) ?? createFolder(drive, name, parentId);
}

export async function createSubjectDriveStructure(subjectId: string, subjectName: string, assignments: { id: string; title: string }[]) {
  const supabase = await createSupabaseServerClient();
  const { data: encryptedTokens, error } = await supabase.rpc("get_my_google_drive_tokens");
  if (error) throw error;
  if (!encryptedTokens) throw new Error("Google Drive no está conectado.");

  const auth = createGoogleOAuthClient();
  auth.setCredentials(decryptTokens(encryptedTokens));
  const drive = google.drive({ version: "v3", auth });
  const rootId = await findOrCreateFolder(drive, "Olympus");
  const subjectFolderId = await findOrCreateFolder(drive, subjectName, rootId);
  const sections = [
    "01 - Información y fuentes",
    "02 - Enunciado y situación problemática",
    "03 - Objetivo del trabajo",
    "04 - Rúbrica de evaluación",
    "05 - Consignas",
    "06 - Modelos y correcciones anteriores",
    "07 - Devoluciones del alumno",
    "08 - Versiones y entrega final",
  ];

  for (const assignment of assignments) {
    const practicalFolderId = await findOrCreateFolder(drive, assignment.title, subjectFolderId);
    for (const section of sections) await findOrCreateFolder(drive, section, practicalFolderId);
    const { error: assignmentError } = await supabase.from("assignments").update({ drive_folder_id: practicalFolderId }).eq("id", assignment.id);
    if (assignmentError) throw assignmentError;
  }

  const { error: updateError } = await supabase.from("subjects").update({ drive_folder_id: subjectFolderId }).eq("id", subjectId);
  if (updateError) throw updateError;
  return { rootId, subjectFolderId };
}

export async function uploadAssignmentDocument(input: {
  subjectId: string; assignmentId: string; folderId: string; kind: "source" | "assignment" | "rubric" | "precedent_work" | "precedent_correction";
  file: File;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: encryptedTokens, error } = await supabase.rpc("get_my_google_drive_tokens");
  if (error) throw error;
  if (!encryptedTokens) throw new Error("Google Drive no está conectado.");
  const auth = createGoogleOAuthClient();
  auth.setCredentials(decryptTokens(encryptedTokens));
  const drive = google.drive({ version: "v3", auth });
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const response = await drive.files.create({
    requestBody: { name: input.file.name, parents: [input.folderId] },
    media: { mimeType: input.file.type || "application/octet-stream", body: Readable.from(bytes) },
    fields: "id,webViewLink",
  });
  if (!response.data.id) throw new Error("Drive no devolvió el archivo creado.");
  const { error: insertError } = await supabase.from("documents").insert({
    subject_id: input.subjectId, assignment_id: input.assignmentId, kind: input.kind,
    name: input.file.name, mime_type: input.file.type || "application/octet-stream", size_bytes: input.file.size,
    drive_file_id: response.data.id, drive_web_url: response.data.webViewLink, processing_status: "stored",
  });
  if (insertError) throw insertError;
}
