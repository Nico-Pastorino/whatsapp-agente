import type { MetadataRoute } from "next";

// Manifest PWA: hace la app instalable en la pantalla de inicio (Android/iOS).
// start_url apunta al dashboard: quien instala la app ya es usuario.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atendé — Tu vendedor automático por WhatsApp",
    short_name: "Atendé",
    description:
      "Respondé consultas, captá clientes y vendé más por WhatsApp con tu asistente con IA.",
    start_url: "/app/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f1411",
    theme_color: "#0f1411",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
