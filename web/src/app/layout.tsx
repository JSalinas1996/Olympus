import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Olympus",
  description: "Materias y trabajos prácticos de Contador Público.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
