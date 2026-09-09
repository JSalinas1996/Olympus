"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function login(formData: FormData) {
  const result = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!result.success) redirect("/login?error=Ingresá credenciales válidas");
  const allowedEmail = process.env.OLYMPUS_ALLOWED_EMAIL?.toLocaleLowerCase();
  if (allowedEmail && result.data.email.toLocaleLowerCase() !== allowedEmail) redirect("/login?error=Esta cuenta no está autorizada");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);
  if (error) redirect("/login?error=Correo o contraseña incorrectos");
  redirect("/");
}
