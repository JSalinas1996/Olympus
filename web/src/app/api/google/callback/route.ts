import { NextRequest, NextResponse } from "next/server";
import { createGoogleOAuthClient, encryptTokens, verifyOAuthState } from "@/lib/drive/oauth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code"); const state = request.nextUrl.searchParams.get("state");
    if (!code || !state) throw new Error("Respuesta OAuth incompleta.");
    const ownerId = verifyOAuthState(state); const client = createGoogleOAuthClient(); const { tokens } = await client.getToken(code);
    const { error } = await createSupabaseAdminClient().from("oauth_connections").upsert({ owner_id: ownerId, provider: "google_drive", encrypted_tokens: encryptTokens(tokens), scopes: tokens.scope?.split(" ") ?? [] }, { onConflict: "owner_id,provider" });
    if (error) throw error;
    return NextResponse.redirect(new URL("/?drive=connected", request.url));
  } catch {
    return NextResponse.redirect(new URL("/?drive=error", request.url));
  }
}
