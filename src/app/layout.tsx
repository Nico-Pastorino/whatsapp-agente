import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider, THEME_NO_FLASH_SCRIPT } from "@/components/ThemeProvider";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Atendé — Tu vendedor automático por WhatsApp",
  description: "Respondé consultas, captá clientes y vendé más sin estar todo el día pendiente del celular. IA + modo humano en tu mismo WhatsApp.",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
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
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
