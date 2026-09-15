import { NextResponse } from "next/server";
import { downloadGeneralLogo } from "@/lib/drive/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
    const file = await downloadGeneralLogo(); const safeName = file.name.replace(/["\\\r\n]/g, "_");
    return new NextResponse(file.bytes, { headers: {
      "content-type": file.mimeType, "content-length": String(file.bytes.length),
      "content-disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "cache-control": "private, no-store",
    } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo descargar el logo." }, { status: 404 });
  }
}
