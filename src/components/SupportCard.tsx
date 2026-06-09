"use client";

import {
  SUPPORT_WHATSAPP_URL,
  SUPPORT_MAILTO,
  HAS_SUPPORT_WHATSAPP,
  HAS_SUPPORT_EMAIL,
  HAS_ANY_SUPPORT,
} from "@/lib/support";

/**
 * Card compacta de soporte, pensada para "Mi Plan" / "Ajustes".
 * Si una vía no está configurada, el botón queda deshabilitado (no rompe nada).
 */
export default function SupportCard() {
  return (
    <section className="atd-card" style={{ margin: "12px 20px 0", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            flexShrink: 0,
            background: "var(--green-tint)",
            color: "var(--green-ink)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
          }}
        >
          💬
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>
            ¿Necesitás ayuda?
          </h3>
          <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0, lineHeight: 1.5 }}>
            Te ayudamos a configurar tu asistente, conectar WhatsApp o resolver dudas sobre tu plan.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        {HAS_SUPPORT_WHATSAPP ? (
          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="atd-btn green sm"
            style={{ flex: "1 1 160px", textDecoration: "none" }}
          >
            Escribir por WhatsApp
          </a>
        ) : (
          <button className="atd-btn green sm" disabled style={{ flex: "1 1 160px" }}>
            Escribir por WhatsApp
          </button>
        )}

        {HAS_SUPPORT_EMAIL ? (
          <a
            href={SUPPORT_MAILTO}
            className="atd-btn ghost sm"
            style={{ flex: "1 1 140px", textDecoration: "none" }}
          >
            Enviar correo
          </a>
        ) : (
          <button className="atd-btn ghost sm" disabled style={{ flex: "1 1 140px" }}>
            Enviar correo
          </button>
        )}
      </div>

      {!HAS_ANY_SUPPORT && (
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "10px 0 0" }}>
          Pronto vas a poder contactarnos por acá.
        </p>
      )}
    </section>
  );
}
