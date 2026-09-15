import { NextResponse } from "next/server";
import { deleteGeneralLogo, uploadGeneralLogo } from "@/lib/drive/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function authenticated() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return Boolean(user);
}

export async function POST(request: Request) {
  try {
    if (!await authenticated()) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
    const body = await request.formData(); const logo = body.get("logo");
    if (!(logo instanceof File)) return NextResponse.json({ error: "Seleccioná un logo." }, { status: 400 });
    return NextResponse.json({ saved: true, logo: await uploadGeneralLogo(logo) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar el logo." }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    if (!await authenticated()) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
    await deleteGeneralLogo();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el logo." }, { status: 400 });
  }
}
