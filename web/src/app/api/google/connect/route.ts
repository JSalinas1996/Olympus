import { NextResponse } from "next/server";
import { createGoogleOAuthClient, signOAuthState } from "@/lib/drive/oauth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  const url = createGoogleOAuthClient().generateAuthUrl({ access_type: "offline", prompt: "consent", scope: ["https://www.googleapis.com/auth/drive.file"], state: signOAuthState(user.id) });
  return NextResponse.redirect(url);
}
