import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider, THEME_NO_FLASH_SCRIPT } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Atendé — Asistente comercial por WhatsApp",
  description: "Automatizá WhatsApp con IA. Respondé consultas, recomendá productos y vendé más sin estar pegado al teléfono.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f3f0ea",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        {/* Fija el tema antes del primer pintado para evitar parpadeo. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_NO_FLASH_SCRIPT }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
