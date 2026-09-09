import Link from "next/link";
import { BookOpen, LockKeyhole } from "lucide-react";
import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { error, message } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-[#0c1830] px-5 py-12">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl shadow-black/25">
        <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-blue-600 text-white"><BookOpen className="size-5" /></div><div><h1 className="font-serif text-2xl font-semibold">Olympus</h1><p className="text-sm text-slate-500">Acceso privado</p></div></div>
        <div className="my-7 border-t border-slate-100" />
        <form action={login} className="space-y-5">
          <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Correo electrónico</span><input name="email" type="email" required autoComplete="email" className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Contraseña</span><input name="password" type="password" required minLength={8} autoComplete="current-password" className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50" /></label>
          {message && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</p>}
          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
          <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700"><LockKeyhole className="size-4" />Ingresar</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">Primera vez en Olympus: <Link href="/registro" className="font-semibold text-blue-600 hover:text-blue-700">crear acceso</Link></p>
      </section>
    </main>
  );
}
