import "server-only";
import { google, drive_v3 } from "googleapis";
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

export async function createSubjectDriveStructure(subjectId: string, subjectName: string) {
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

  for (let number = 1; number <= 4; number += 1) {
    const practicalFolderId = await findOrCreateFolder(drive, `TP${number}`, subjectFolderId);
    for (const section of sections) await findOrCreateFolder(drive, section, practicalFolderId);
  }

  const { error: updateError } = await supabase.from("subjects").update({ drive_folder_id: subjectFolderId }).eq("id", subjectId);
  if (updateError) throw updateError;
  return { rootId, subjectFolderId };
}
