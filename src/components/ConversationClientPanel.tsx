"use client";

import { Avatar } from "./atende/Icons";
import { deriveLeadSignal } from "@/lib/conversation-insights";

interface Conversation {
  id: string;
  phone: string;
  phone_number: string | null;
  name: string | null;
  mode: "AI" | "HUMAN";
  needs_attention: boolean;
  last_message_at: number | null;
  last_message_preview: string | null;
}

function displayName(conv: Conversation): string {
  if (conv.name) return conv.name;
  return conv.phone.split("@")[0].split(":")[0];
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((s) => s[0] ?? "").join("").toUpperCase() || "?";
}

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("es-AR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="atd-kv">
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--ink)", textAlign: "right", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
    </div>
  );
}

export default function ConversationClientPanel({ conversation }: { conversation: Conversation }) {
  const name = displayName(conversation);
  const isIA = conversation.mode === "AI";
  const signal = deriveLeadSignal(conversation);

  return (
    <aside style={{ width: 300, flexShrink: 0, borderLeft: "1px solid var(--hairline)", background: "var(--surface)", height: "100%", overflowY: "auto", padding: 18 }}>
      {/* Encabezado del cliente */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingBottom: 16, borderBottom: "1px solid var(--hairline)" }}>
        <Avatar
          initials={initials(name)}
          size={64}
          bg={isIA ? "var(--green-tint)" : "var(--human-tint)"}
          fg={isIA ? "var(--green-ink)" : "var(--human)"}
        />
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginTop: 10 }}>{name}</div>
        {conversation.phone_number ? (
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>+{conversation.phone_number}</div>
        ) : (
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>número no disponible</div>
        )}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <span className={`atd-pill ${isIA ? "green" : "human"}`}>
            {isIA ? "Respondiendo con IA" : "Modo humano"}
          </span>
          {signal && (
            <span style={{ display: "inline-flex", alignItems: "center", height: 24, padding: "0 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: signal.bg, color: signal.fg }}>
              {signal.label}
            </span>
          )}
        </div>
      </div>

      {/* Datos */}
      <div style={{ padding: "14px 0", borderBottom: "1px solid var(--hairline)" }}>
        <div className="page-sub" style={{ marginBottom: 4 }}>datos del cliente</div>
        <Row label="Estado" value={isIA ? "Atendido por IA" : "Atendido por persona"} />
        <Row label="Necesita atención" value={conversation.needs_attention ? "Sí" : "No"} />
        <Row label="Último mensaje" value={formatDate(conversation.last_message_at)} />
      </div>

      {/* Sugerencia */}
      <div style={{ paddingTop: 14 }}>
        <div className="page-sub" style={{ marginBottom: 8 }}>sugerencia</div>
        <p style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5, margin: 0 }}>
          {signal?.key === "booking"
            ? "Este cliente quiere reservar. Confirmá disponibilidad y cerralo rápido."
            : signal?.key === "price"
            ? "Preguntó por precio. Respondé con el dato y una propuesta clara para avanzar."
            : signal?.key === "interested" || signal?.key === "attention"
            ? "Hay intención de compra. Tomá el control en modo humano si querés cerrar la venta."
            : isIA
            ? "Tu asistente está respondiendo. Pasá a modo humano cuando quieras intervenir."
            : "Estás respondiendo vos. Volvé a modo IA cuando termines para que siga solo."}
        </p>
      </div>
    </aside>
  );
}
