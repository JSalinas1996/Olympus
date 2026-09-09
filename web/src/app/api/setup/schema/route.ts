import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const schemaPath = path.join(process.cwd(), "supabase", "migrations", "202609080001_initial_schema.sql");
  return new Response(await readFile(schemaPath, "utf8"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
