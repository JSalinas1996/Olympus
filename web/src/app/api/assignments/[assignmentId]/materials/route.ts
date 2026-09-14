import { NextRequest, NextResponse } from "next/server";
import { uploadAssignmentDocument } from "@/lib/drive/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { documentKindByCategory, isMaterialCategory, validateMaterialFile } from "@/lib/materials";

export async function POST(request: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const { assignmentId } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

    const data = await request.formData();
    const category = String(data.get("category") || "");
    const file = data.get("file");
    if (!isMaterialCategory(category)) return NextResponse.json({ error: "La categoría del material no es válida." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
    validateMaterialFile(file.name, file.size);

    const { data: assignment } = await supabase.from("assignments")
      .select("id,subject_id,drive_folder_id")
      .eq("id", assignmentId)
      .single();
    if (!assignment?.drive_folder_id) return NextResponse.json({ error: "El TP no tiene una carpeta de Drive disponible." }, { status: 404 });

    const document = await uploadAssignmentDocument({
      subjectId: assignment.subject_id,
      assignmentId,
      folderId: assignment.drive_folder_id,
      kind: documentKindByCategory[category],
      file,
    });
    return NextResponse.json({
      documentId: document.id,
      name: document.name,
      processingStatus: document.processing_status,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo subir el archivo." }, { status: 400 });
  }
}
