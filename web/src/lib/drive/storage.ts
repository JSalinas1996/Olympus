import "server-only";
import { google, drive_v3 } from "googleapis";
import { Readable } from "node:stream";
import { createGoogleOAuthClient, decryptTokens } from "@/lib/drive/oauth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractDocument } from "@/lib/documents/extract";
import { validateLogoFile } from "@/lib/logo";

const folderMimeType = "application/vnd.google-apps.folder";
const documentFolderByKind = {
  source: "02 - Módulos teóricos",
  assignment: "01 - Enunciado, consignas y rúbrica",
  rubric: "01 - Enunciado, consignas y rúbrica",
  precedent_work: "03 - Modelos anteriores",
  precedent_correction: "03 - Modelos anteriores",
} as const;

async function processDocumentRecord(documentId: string, file: File) {
  const supabase = await createSupabaseServerClient();
  await supabase.from("document_chunks").delete().eq("document_id", documentId);
  const pages = await extractDocument(file); let position = 0;
  const chunks = pages.flatMap(page => {
    const text = page.text.replace(/\u0000/g, "").trim(); const results = [];
    for (let offset = 0; offset < text.length; offset += 8000) results.push({ document_id: documentId, page_number: page.page, position: position++, content: text.slice(offset, offset + 8000) });
    return results;
  });
  if (!chunks.length) throw new Error("No se pudo reconocer texto en el documento.");
  for (let offset = 0; offset < chunks.length; offset += 100) {
    const { error } = await supabase.from("document_chunks").insert(chunks.slice(offset, offset + 100)); if (error) throw error;
  }
  const { error } = await supabase.from("documents").update({ processing_status: "ready", processing_error: null, page_count: pages.length }).eq("id", documentId); if (error) throw error;
}

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
    "01 - Enunciado, consignas y rúbrica",
    "02 - Módulos teóricos",
    "03 - Modelos anteriores",
    "Entrega final",
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
  const sectionFolderId = await findOrCreateFolder(drive, documentFolderByKind[input.kind], input.folderId);
  const response = await drive.files.create({
    requestBody: { name: input.file.name, parents: [sectionFolderId] },
    media: { mimeType: input.file.type || "application/octet-stream", body: Readable.from(bytes) },
    fields: "id,webViewLink",
  });
  if (!response.data.id) throw new Error("Drive no devolvió el archivo creado.");
  const { data: document, error: insertError } = await supabase.from("documents").insert({
    subject_id: input.subjectId, assignment_id: input.assignmentId, kind: input.kind,
    name: input.file.name, mime_type: input.file.type || "application/octet-stream", size_bytes: input.file.size,
    drive_file_id: response.data.id, drive_web_url: response.data.webViewLink, processing_status: "processing",
  }).select("id").single();
  if (insertError) {
    await drive.files.delete({ fileId: response.data.id }).catch(() => undefined);
    throw insertError;
  }
  try {
    await processDocumentRecord(document.id, input.file);
  } catch (processingError) {
    const message = processingError instanceof Error ? processingError.message : "No se pudo procesar el archivo.";
    await supabase.from("documents").update({ processing_status: "failed", processing_error: message.slice(0, 1000) }).eq("id", document.id);
  }
  const { data: processed, error: processedError } = await supabase.from("documents")
    .select("id,name,processing_status")
    .eq("id", document.id)
    .single();
  if (processedError) throw processedError;
  return processed;
}

export async function reprocessDriveDocument(documentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: document, error: documentError } = await supabase.from("documents").select("id,name,mime_type,drive_file_id").eq("id", documentId).single();
  if (documentError || !document?.drive_file_id) throw documentError ?? new Error("El documento no tiene archivo en Drive.");
  const { data: encryptedTokens, error } = await supabase.rpc("get_my_google_drive_tokens"); if (error) throw error;
  const auth = createGoogleOAuthClient(); auth.setCredentials(decryptTokens(encryptedTokens)); const drive = google.drive({ version: "v3", auth });
  await supabase.from("documents").update({ processing_status: "processing", processing_error: null }).eq("id", documentId);
  try {
    const response = await drive.files.get({ fileId: document.drive_file_id, alt: "media" }, { responseType: "arraybuffer" });
    const file = new File([Buffer.from(response.data as ArrayBuffer)], document.name, { type: document.mime_type });
    await processDocumentRecord(documentId, file);
  } catch (processingError) {
    const message = processingError instanceof Error ? processingError.message : "No se pudo procesar el archivo.";
    await supabase.from("documents").update({ processing_status: "failed", processing_error: message.slice(0, 1000) }).eq("id", documentId);
  }
}

export async function deleteDriveDocument(documentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: document, error: documentError } = await supabase.from("documents").select("drive_file_id").eq("id", documentId).single();
  if (documentError) throw documentError;
  if (document?.drive_file_id) {
    const { data: encryptedTokens, error } = await supabase.rpc("get_my_google_drive_tokens"); if (error) throw error;
    const auth = createGoogleOAuthClient(); auth.setCredentials(decryptTokens(encryptedTokens));
    try { await google.drive({ version: "v3", auth }).files.delete({ fileId: document.drive_file_id }); }
    catch (error) { if (!(error instanceof Error) || !error.message.includes("File not found")) throw error; }
  }
  const { error } = await supabase.from("documents").delete().eq("id", documentId); if (error) throw error;
}

export async function downloadDriveDocument(documentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: document, error: documentError } = await supabase.from("documents").select("name,mime_type,drive_file_id").eq("id", documentId).in("kind", ["generated", "study_report"]).single();
  if (documentError || !document?.drive_file_id) throw documentError ?? new Error("La entrega final no está disponible.");
  const { data: encryptedTokens, error } = await supabase.rpc("get_my_google_drive_tokens");
  if (error) throw error;
  if (!encryptedTokens) throw new Error("Google Drive no está conectado.");
  const auth = createGoogleOAuthClient(); auth.setCredentials(decryptTokens(encryptedTokens));
  const response = await google.drive({ version: "v3", auth }).files.get({ fileId: document.drive_file_id, alt: "media" }, { responseType: "arraybuffer" });
  return { name: document.name, mimeType: document.mime_type || "application/octet-stream", bytes: Buffer.from(response.data as ArrayBuffer) };
}

export async function extractFinalDeliveryText(documentId: string) {
  const file = await downloadDriveDocument(documentId);
  const pages = await extractDocument(new File([file.bytes], file.name, { type: file.mimeType }));
  const text = pages.map(page => `[Sección ${page.page}]\n${page.text.trim()}`).filter(value => value.trim()).join("\n\n").trim();
  if (!text) throw new Error(`No se pudo extraer contenido de ${file.name}.`);
  return { name: file.name, text };
}

export async function uploadFinalDeliveries(input: { subjectId: string; assignmentId: string; folderId: string; files: File[] }) {
  const supabase = await createSupabaseServerClient();
  const { data: encryptedTokens, error } = await supabase.rpc("get_my_google_drive_tokens");
  if (error) throw error;
  if (!encryptedTokens) throw new Error("Google Drive no está conectado.");
  const auth = createGoogleOAuthClient(); auth.setCredentials(decryptTokens(encryptedTokens));
  const drive = google.drive({ version: "v3", auth });
  const finalFolderId = await findOrCreateFolder(drive, "Entrega final", input.folderId);
  const { data: previous } = await supabase.from("documents").select("id,drive_file_id").eq("assignment_id", input.assignmentId).eq("kind", "generated");
  const staged: Array<{ file: File; driveId: string; driveUrl: string | null | undefined }> = [];
  try {
    for (const file of input.files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const response = await drive.files.create({
        requestBody: { name: file.name, parents: [finalFolderId] },
        media: { mimeType: file.type || "application/octet-stream", body: Readable.from(bytes) },
        fields: "id,webViewLink",
      });
      if (!response.data.id) throw new Error(`Drive no devolvió el archivo final ${file.name}.`);
      staged.push({ file, driveId: response.data.id, driveUrl: response.data.webViewLink });
    }
  } catch (uploadError) {
    for (const item of staged) await drive.files.delete({ fileId: item.driveId }).catch(() => undefined);
    throw uploadError;
  }
  const rows = staged.map(item => ({
    subject_id: input.subjectId, assignment_id: input.assignmentId, kind: "generated", name: item.file.name,
    mime_type: item.file.type || "application/octet-stream", size_bytes: item.file.size, drive_file_id: item.driveId,
    drive_web_url: item.driveUrl, processing_status: "ready",
  }));
  const { data: documents, error: insertError } = await supabase.from("documents").insert(rows).select("id,name,mime_type,size_bytes,drive_file_id,drive_web_url");
  if (insertError) {
    for (const item of staged) await drive.files.delete({ fileId: item.driveId }).catch(() => undefined);
    throw insertError;
  }
  if (!documents || documents.length !== staged.length) {
    if (documents?.length) await supabase.from("documents").delete().in("id", documents.map(item => item.id));
    for (const item of staged) await drive.files.delete({ fileId: item.driveId }).catch(() => undefined);
    throw new Error("No se registraron todos los archivos finales.");
  }
  const previousIds = (previous ?? []).map(item => item.id);
  if (previousIds.length) {
    const { error: deleteError } = await supabase.from("documents").delete().in("id", previousIds);
    if (deleteError) {
      await supabase.from("documents").delete().in("id", documents.map(item => item.id));
      for (const item of staged) await drive.files.delete({ fileId: item.driveId }).catch(() => undefined);
      throw deleteError;
    }
    for (const item of previous ?? []) if (item.drive_file_id) await drive.files.delete({ fileId: item.drive_file_id }).catch(() => undefined);
  }
  return documents;
}

export async function uploadGeneralLogo(file: File) {
  validateLogoFile(file.name, file.size, file.type);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión requerida.");
  const { data: encryptedTokens, error } = await supabase.rpc("get_my_google_drive_tokens");
  if (error) throw error;
  if (!encryptedTokens) throw new Error("Google Drive no está conectado.");
  const auth = createGoogleOAuthClient(); auth.setCredentials(decryptTokens(encryptedTokens));
  const drive = google.drive({ version: "v3", auth });
  const rootId = await findOrCreateFolder(drive, "Olympus");
  const settingsFolderId = await findOrCreateFolder(drive, "Configuración", rootId);
  const logoFolderId = await findOrCreateFolder(drive, "Logo", settingsFolderId);
  const { data: previous } = await supabase.from("user_ai_settings").select("logo_drive_file_id").maybeSingle();
  const bytes = Buffer.from(await file.arrayBuffer());
  const response = await drive.files.create({
    requestBody: { name: file.name, parents: [logoFolderId] },
    media: { mimeType: file.type, body: Readable.from(bytes) },
    fields: "id,webViewLink",
  });
  if (!response.data.id) throw new Error("Drive no devolvió el identificador del logo.");
  const { error: settingsError } = await supabase.from("user_ai_settings").upsert({
    owner_id: user.id,
    logo_name: file.name,
    logo_mime_type: file.type,
    logo_size_bytes: file.size,
    logo_drive_file_id: response.data.id,
    logo_drive_web_url: response.data.webViewLink,
    updated_at: new Date().toISOString(),
  }, { onConflict: "owner_id" });
  if (settingsError) {
    await drive.files.delete({ fileId: response.data.id }).catch(() => undefined);
    throw settingsError;
  }
  if (previous?.logo_drive_file_id && previous.logo_drive_file_id !== response.data.id) {
    await drive.files.delete({ fileId: previous.logo_drive_file_id }).catch(() => undefined);
  }
  return { name: file.name, mimeType: file.type, size: file.size, driveFileId: response.data.id, driveUrl: response.data.webViewLink };
}

export async function downloadGeneralLogo() {
  const supabase = await createSupabaseServerClient();
  const { data: settings, error: settingsError } = await supabase.from("user_ai_settings").select("logo_name,logo_mime_type,logo_drive_file_id").maybeSingle();
  if (settingsError) throw settingsError;
  if (!settings?.logo_drive_file_id || !settings.logo_name) throw new Error("No hay un logo configurado.");
  const { data: encryptedTokens, error } = await supabase.rpc("get_my_google_drive_tokens");
  if (error) throw error;
  if (!encryptedTokens) throw new Error("Google Drive no está conectado.");
  const auth = createGoogleOAuthClient(); auth.setCredentials(decryptTokens(encryptedTokens));
  const response = await google.drive({ version: "v3", auth }).files.get({ fileId: settings.logo_drive_file_id, alt: "media" }, { responseType: "arraybuffer" });
  return { name: settings.logo_name, mimeType: settings.logo_mime_type || "application/octet-stream", bytes: Buffer.from(response.data as ArrayBuffer) };
}

export async function deleteGeneralLogo() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión requerida.");
  const { data: settings, error: settingsError } = await supabase.from("user_ai_settings").select("logo_drive_file_id").maybeSingle();
  if (settingsError) throw settingsError;
  const { error: updateError } = await supabase.from("user_ai_settings").update({
    logo_name: null, logo_mime_type: null, logo_size_bytes: null, logo_drive_file_id: null, logo_drive_web_url: null,
    updated_at: new Date().toISOString(),
  }).eq("owner_id", user.id);
  if (updateError) throw updateError;
  if (!settings?.logo_drive_file_id) return;
  const { data: encryptedTokens, error } = await supabase.rpc("get_my_google_drive_tokens");
  if (error || !encryptedTokens) return;
  const auth = createGoogleOAuthClient(); auth.setCredentials(decryptTokens(encryptedTokens));
  await google.drive({ version: "v3", auth }).files.delete({ fileId: settings.logo_drive_file_id }).catch(() => undefined);
}

export async function uploadStudyReport(input: { subjectId: string; assignmentId: string; folderId: string; file: File }) {
  const supabase = await createSupabaseServerClient();
  const { data: encryptedTokens, error } = await supabase.rpc("get_my_google_drive_tokens");
  if (error) throw error;
  if (!encryptedTokens) throw new Error("Google Drive no está conectado.");
  const auth = createGoogleOAuthClient(); auth.setCredentials(decryptTokens(encryptedTokens));
  const drive = google.drive({ version: "v3", auth });
  const reportFolderId = await findOrCreateFolder(drive, "Informe técnico de estudio", input.folderId);
  const { data: previous } = await supabase.from("documents").select("id,drive_file_id").eq("assignment_id", input.assignmentId).eq("kind", "study_report");
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const response = await drive.files.create({
    requestBody: { name: input.file.name, parents: [reportFolderId] },
    media: { mimeType: input.file.type, body: Readable.from(bytes) },
    fields: "id,webViewLink",
  });
  if (!response.data.id) throw new Error("Drive no devolvió el identificador del informe.");
  const { data: document, error: insertError } = await supabase.from("documents").insert({
    subject_id: input.subjectId, assignment_id: input.assignmentId, kind: "study_report", name: input.file.name,
    mime_type: input.file.type, size_bytes: input.file.size, drive_file_id: response.data.id,
    drive_web_url: response.data.webViewLink, processing_status: "ready",
  }).select("id,name,mime_type,size_bytes,drive_file_id,drive_web_url").single();
  if (insertError) { await drive.files.delete({ fileId: response.data.id }).catch(() => undefined); throw insertError; }
  const previousIds = (previous ?? []).map(item => item.id);
  if (previousIds.length) {
    const { error: deleteError } = await supabase.from("documents").delete().in("id", previousIds);
    if (deleteError) {
      await supabase.from("documents").delete().eq("id", document.id);
      await drive.files.delete({ fileId: response.data.id }).catch(() => undefined);
      throw deleteError;
    }
    for (const item of previous ?? []) if (item.drive_file_id) await drive.files.delete({ fileId: item.drive_file_id }).catch(() => undefined);
  }
  return document;
}
