import { NextResponse } from "next/server";
import { extractFinalDeliveryText } from "@/lib/drive/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const { assignmentId } = await params; const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
    const { data: documents, error } = await supabase.from("documents").select("id").eq("assignment_id", assignmentId).eq("kind", "generated").order("name");
    if (error) throw error;
    if (!documents?.length) return NextResponse.json({ error: "El TP todavía no tiene una entrega final." }, { status: 409 });
    const finalSections = [];
    for (const document of documents) finalSections.push(await extractFinalDeliveryText(document.id));
    return NextResponse.json({ finalSections });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo preparar la entrega final." }, { status: 400 });
  }
}
