"use client";

import DashboardContentShell from "./DashboardContentShell";
import {
  SUPPORT_WHATSAPP_URL,
  SUPPORT_MAILTO,
  HAS_SUPPORT_WHATSAPP,
  HAS_SUPPORT_EMAIL,
} from "@/lib/support";

interface SupportOption {
  emoji: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  available: boolean;
  external: boolean;
  variant: "green" | "primary";
}

export default function SupportScreen() {
  const options: SupportOption[] = [
    {
      emoji: "💬",
      title: "Hablar por WhatsApp",
      description:
        "Ideal si necesitás ayuda rápida para conectar WhatsApp, configurar tu asistente o resolver una duda.",
      cta: "Escribir por WhatsApp",
      href: SUPPORT_WHATSAPP_URL,
      available: HAS_SUPPORT_WHATSAPP,
      external: true,
      variant: "green",
    },
    {
      emoji: "✉️",
      title: "Enviar un correo",
      description:
        "Usalo para consultas más largas, temas de facturación o soporte técnico.",
      cta: "Enviar correo",
      href: SUPPORT_MAILTO,
      available: HAS_SUPPORT_EMAIL,
      external: false,
      variant: "primary",
    },
  ];

  return (
    <DashboardContentShell maxWidth={760}>
      <div className="page-header">
        <div>
          <div className="page-sub">ayuda y soporte</div>
          <h1 className="page-title">Soporte</h1>
          <p style={{ fontSize: 13.5, color: "var(--ink-3)", margin: "6px 0 0" }}>
            Estamos para ayudarte a dejar tu asistente funcionando.
          </p>
        </div>
      </div>

      <div
        style={{
          padding: "8px 20px 0",
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        {options.map((opt) => (
          <section
            key={opt.title}
            className="atd-card"
            style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "var(--surface-2)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
              }}
            >
              {opt.emoji}
            </span>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>
                {opt.title}
              </h2>
              <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0, lineHeight: 1.55 }}>
                {opt.description}
              </p>
            </div>

            {opt.available ? (
              <a
                href={opt.href}
                {...(opt.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className={`atd-btn ${opt.variant}`}
                style={{ textDecoration: "none", width: "100%" }}
              >
                {opt.cta}
              </a>
            ) : (
              <button className={`atd-btn ${opt.variant}`} disabled style={{ width: "100%" }}>
                {opt.cta}
              </button>
            )}
          </section>
        ))}
      </div>

      <p
        style={{
          padding: "14px 20px 0",
          fontSize: 12.5,
          color: "var(--muted)",
          lineHeight: 1.6,
          maxWidth: 520,
        }}
      >
        Respondemos lo antes posible. Si tu consulta es urgente, te recomendamos
        escribirnos por WhatsApp.
      </p>
    </DashboardContentShell>
  );
}
