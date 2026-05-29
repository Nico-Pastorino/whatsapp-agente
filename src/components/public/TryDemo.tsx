"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type Msg = { id: number; from: "me" | "them"; text: string };

const SUGGESTIONS = [
  "¿Tienen disponibilidad hoy?",
  "¿Cuánto cuesta el servicio?",
  "Quiero reservar un turno",
  "¿Aceptan Mercado Pago?",
];

const MAX_LEN = 200;
const MAX_MESSAGES = 8;

/**
 * Generador de respuestas simulado (100% en el navegador).
 * No conecta WhatsApp, no usa IA real ni guarda datos.
 * Solo busca palabras clave para mostrar una respuesta de ejemplo.
 */
function demoReply(raw: string): string {
  const t = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // sin acentos

  const has = (...words: string[]) => words.some((w) => t.includes(w));

  if (has("mercado pago", "mercadopago", "tarjeta", "transferencia", "efectivo", "cuota", "financ", "pagar", "abonar")) {
    return "¡Sí! Aceptamos Mercado Pago, tarjetas y transferencia. Si querés, te paso el link de pago así lo dejás reservado al toque 🔗";
  }
  if (has("turno", "reserv", "cita", "agend", "sacar")) {
    return "¡Genial! Para reservarte un turno necesito tu nombre y qué día te queda cómodo. Tengo lugares mañana a las 11:00, 16:30 y 18:15 😊";
  }
  if (has("disponib", "hoy", "manana", "mañana", "horario", "abren", "abierto", "atienden")) {
    return "¡Hola! Hoy tenemos disponibilidad por la tarde. ¿Preferís cerca de las 17:00 o más tarde, sobre las 19:00?";
  }
  if (has("precio", "cuesta", "cuanto", "vale", "tarifa", "sale")) {
    return "El servicio arranca en $12.000 y depende de lo que necesites. ¿Querés que te pase las opciones según tu caso?";
  }
  if (has("envio", "envío", "delivery", "llega", "despacho", "domicilio", "mandan")) {
    return "Hacemos envíos a todo el país 🚚. A tu zona suele llegar en 24/48 hs. ¿A qué localidad sería?";
  }
  if (has("stock", "tienen", "hay", "queda", "modelo", "color", "talle")) {
    return "Sí, tenemos stock 🙌 Decime el modelo o color que buscás y te confirmo al instante si está disponible.";
  }
  if (has("direccion", "ubic", "donde", "local", "sucursal", "llegar")) {
    return "Estamos en pleno centro y abrimos de 9 a 19 hs. Te paso la ubicación por acá: 📍 ¿Venís hoy?";
  }
  if (has("hola", "buenas", "buen dia", "buenas tardes", "que tal", "consulta")) {
    return "¡Hola! 👋 Soy el asistente del negocio y estoy para ayudarte. ¿Querés ver precios, disponibilidad o reservar?";
  }
  if (has("gracias", "buenisimo", "perfecto", "genial", "dale")) {
    return "¡Gracias a vos! Cualquier cosa me escribís y te respondo al toque 😊";
  }
  return "¡Buenísimo! Lo veo enseguida. Contame un poco más así te doy la info exacta de precios, disponibilidad o reservas 😊";
}

let _id = 0;
const nextId = () => ++_id;

export default function TryDemo() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: nextId(),
      from: "them",
      text: "¡Hola! 👋 Probá escribir una consulta como lo haría un cliente. Te respondo como tu asistente.",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const limitReached = sentCount >= MAX_MESSAGES;

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const send = (rawText: string) => {
    const text = rawText.trim().slice(0, MAX_LEN);
    if (!text || typing || limitReached) return;

    setMessages((m) => [...m, { id: nextId(), from: "me", text }]);
    setInput("");
    setSentCount((c) => c + 1);
    setTyping(true);
    scrollToBottom();

    const reply = demoReply(text);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { id: nextId(), from: "them", text: reply }]);
      scrollToBottom();
    }, 900 + Math.min(reply.length * 12, 900));
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: 22,
        boxShadow: "var(--shadow-2)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        maxWidth: 480,
        width: "100%",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "13px 16px",
          borderBottom: "1px solid var(--hairline)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "var(--surface-2)",
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "var(--green)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 15,
            flexShrink: 0,
          }}
        >
          A
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--ink)", lineHeight: 1.2 }}>
            Tu asistente
          </p>
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
            <span className="atd-dot live" style={{ width: 7, height: 7 }} /> en línea · demo
          </p>
        </div>
        <span
          style={{
            fontSize: 10.5,
            fontFamily: "var(--font-mono)",
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          sin registro
        </span>
      </div>

      {/* Mensajes */}
      <div
        ref={scrollRef}
        style={{
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          height: 300,
          overflowY: "auto",
          background: "var(--bg)",
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`atd-bub ${m.from === "me" ? "out" : "in"} lp-bub-enter`}
          >
            {m.text}
          </div>
        ))}
        {typing && (
          <div className="atd-bub in lp-bub-enter" style={{ color: "var(--green-ink)" }}>
            <span className="lp-typing"><i /><i /><i /></span>
          </div>
        )}
      </div>

      {/* Sugerencias */}
      {!limitReached && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "12px 16px 0" }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="lp-chip"
              onClick={() => send(s)}
              disabled={typing}
              style={{
                border: "1px solid var(--hairline-2)",
                background: "var(--surface)",
                color: "var(--ink-2)",
                borderRadius: 999,
                padding: "7px 13px",
                fontSize: 12.5,
                fontFamily: "var(--font-sans)",
                cursor: typing ? "default" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input o CTA de límite */}
      <div style={{ padding: 16 }}>
        {limitReached ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
              Esto es solo una demo. Tu asistente real responde con la info de <strong>tu negocio</strong>.
            </p>
            <Link
              href="/signup"
              className="lp-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "12px 22px",
                background: "var(--green)",
                color: "#fff",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Probar gratis 14 días <span className="arrow">→</span>
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            <input
              className="atd-input"
              value={input}
              maxLength={MAX_LEN}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribí una consulta…"
              aria-label="Escribí una consulta de prueba"
              style={{ flex: 1, borderRadius: 999 }}
            />
            <button
              type="submit"
              className="lp-btn"
              disabled={!input.trim() || typing}
              aria-label="Enviar"
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "none",
                background: input.trim() && !typing ? "var(--green)" : "var(--hairline-2)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                cursor: input.trim() && !typing ? "pointer" : "default",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10l14-6-6 14-2-6-6-2z" />
              </svg>
            </button>
          </form>
        )}
        <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
          Respuestas de ejemplo · no se conecta WhatsApp ni se guardan tus datos.
        </p>
      </div>
    </div>
  );
}
