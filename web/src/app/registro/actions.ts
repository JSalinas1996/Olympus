"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const registrationSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(10).max(128),
  confirmation: z.string(),
}).refine((data) => data.password === data.confirmation, {
  message: "Las contraseñas no coinciden",
});

export async function register(formData: FormData) {
  const parsed = registrationSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) redirect("/registro?error=Revisá el correo y las contraseñas");

  const allowedEmail = process.env.OLYMPUS_ALLOWED_EMAIL?.trim().toLowerCase();
  if (!allowedEmail) redirect("/registro?error=Falta configurar el correo autorizado");
  if (parsed.data.email.toLowerCase() !== allowedEmail) redirect("/registro?error=Este correo no está autorizado");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) redirect(`/registro?error=${encodeURIComponent(error.message)}`);
  if (data.session) redirect("/");
  redirect("/login?message=Revisá tu correo para confirmar el acceso y luego ingresá");
}
