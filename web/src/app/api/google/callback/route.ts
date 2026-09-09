import { NextRequest, NextResponse } from "next/server";
import { createGoogleOAuthClient, encryptTokens, verifyOAuthState } from "@/lib/drive/oauth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code"); const state = request.nextUrl.searchParams.get("state");
    if (!code || !state) throw new Error("Respuesta OAuth incompleta.");
    const ownerId = verifyOAuthState(state);
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== ownerId) throw new Error("La sesión no coincide con la autorización de Google.");
    const client = createGoogleOAuthClient();
    const { tokens } = await client.getToken(code);
    const { error } = await supabase.rpc("save_oauth_connection", {
      p_encrypted_tokens: encryptTokens(tokens),
      p_scopes: tokens.scope?.split(" ") ?? [],
    });
    if (error) throw error;
    return NextResponse.redirect(new URL("/?drive=connected", request.url));
  } catch {
    return NextResponse.redirect(new URL("/?drive=error", request.url));
  }
}
