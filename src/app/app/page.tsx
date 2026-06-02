import { redirect } from "next/navigation";

export default function AppIndexPage() {
  // Entrada por defecto al dashboard: el Centro de control (Inicio),
  // no el inbox vacío. Guía al negocio recién creado hacia la activación.
  redirect("/app/home");
}
