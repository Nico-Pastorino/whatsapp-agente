"use client";

import { useEffect, useRef, useState } from "react";

type Turn = { from: "them" | "me"; text: string; t: string };

const SCRIPT: Turn[] = [
  { from: "them", text: "Hola, ¿tienen disponibilidad para mañana?", t: "9:41" },
  { from: "me", text: "¡Hola! Sí 😊 Tenemos turnos disponibles. ¿Preferís por la mañana o por la tarde?", t: "9:41" },
  { from: "them", text: "Por la tarde.", t: "9:42" },
  { from: "me", text: "Perfecto. Tengo 17:00 o 18:30. ¿Cuál te queda mejor?", t: "9:42" },
  { from: "them", text: "18:30 👍", t: "9:43" },
  { from: "me", text: "¡Listo! Te reservé mañana a las 18:30. Te llega un recordatorio una hora antes 😉", t: "9:43" },
];

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Doble tilde de "leído" estilo WhatsApp. */
function ReadTicks() {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" style={{ flexShrink: 0 }}>
      <path d="M1 5.5L4 8.5L9.5 2.5" stroke="#53bdeb" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 8.5L11.5 2.5" stroke="#53bdeb" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HeroPhone() {
  const [visible, setVisible] = useState(1);
  const [typing, setTyping] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll al último mensaje.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible, typing]);

  useEffect(() => {
    if (prefersReduced()) {
      setVisible(SCRIPT.length);
      return;
    }

    let cancelled = false;
    const clearAll = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };

    const run = () => {
      clearAll();
      setVisible(1);
      setTyping(false);
      let delay = 1300;

      for (let i = 1; i < SCRIPT.length; i++) {
        const turn = SCRIPT[i];
        if (turn.from === "me") {
          timers.current.push(setTimeout(() => !cancelled && setTyping(true), delay));
          delay += 1000;
          timers.current.push(
            setTimeout(() => {
              if (cancelled) return;
              setTyping(false);
              setVisible(i + 1);
            }, delay),
          );
          delay += 1800;
        } else {
          timers.current.push(setTimeout(() => !cancelled && setVisible(i + 1), delay));
          delay += 1200;
        }
      }
      timers.current.push(setTimeout(() => !cancelled && run(), delay + 3200));
    };

    run();
    return () => {
      cancelled = true;
      clearAll();
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 320, margin: "0 auto", padding: "4px 14px" }}>
      {/* Badge flotante: ventas */}
      <div
        className="lp-breathe"
        style={{
          position: "absolute",
          top: 22,
          right: 2,
          zIndex: 3,
          background: "var(--surface)",
          border: "1px solid var(--hairline)",
          borderRadius: 14,
          padding: "9px 13px",
          boxShadow: "var(--shadow-3)",
          display: "flex",
          alignItems: "center",
          gap: 9,
        }}
      >
        <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--green-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>
        </span>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--ink)", lineHeight: 1.1 }}>+12 ventas</p>
          <p style={{ margin: 0, fontSize: 10.5, color: "var(--muted)", lineHeight: 1.2 }}>hoy, sin vos</p>
        </div>
      </div>

      {/* Badge flotante: tiempo de respuesta */}
      <div
        style={{
          position: "absolute",
          bottom: 70,
          left: 2,
          zIndex: 3,
          background: "var(--ink)",
          color: "#fff",
          borderRadius: 999,
          padding: "8px 14px",
          boxShadow: "var(--shadow-3)",
          display: "flex",
          alignItems: "center",
          gap: 7,
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        <span className="atd-dot live" style={{ width: 7, height: 7 }} /> responde en 3 s
      </div>

      {/* Marco del teléfono */}
      <div
        style={{
          background: "linear-gradient(160deg, #20232b 0%, #0c0e12 100%)",
          borderRadius: 46,
          padding: 11,
          boxShadow: "0 50px 110px -30px rgba(12,20,16,0.55), 0 0 0 1px rgba(255,255,255,0.05), inset 0 0 0 2px rgba(255,255,255,0.04)",
        }}
      >
        {/* Pantalla */}
        <div style={{ position: "relative", background: "#ece5dc", borderRadius: 38, overflow: "hidden" }}>
          {/* Dynamic island */}
          <div
            style={{
              position: "absolute",
              top: 9,
              left: "50%",
              transform: "translateX(-50%)",
              width: 92,
              height: 26,
              background: "#000",
              borderRadius: 999,
              zIndex: 5,
            }}
          />

          {/* Header WhatsApp */}
          <div style={{ background: "#075e54", padding: "40px 14px 11px", display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="11" height="18" viewBox="0 0 12 20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.9 }}><path d="M10 2L2 10l8 8" /></svg>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #25d366, #128c7e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              A
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#fff", lineHeight: 1.2 }}>Tu negocio</p>
              <p style={{ margin: 0, fontSize: 11.5, color: typing ? "#9ff5c4" : "rgba(255,255,255,0.7)", lineHeight: 1.3, transition: "color .2s" }}>
                {typing ? "escribiendo…" : "en línea"}
              </p>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" opacity="0.85"><path d="M20 15.5c-1.2 0-2.4-.2-3.6-.6a1 1 0 0 0-1 .2l-2.2 2.2a15 15 0 0 1-6.6-6.6l2.2-2.2a1 1 0 0 0 .2-1C8.7 8.4 8.5 7.2 8.5 6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1 17 17 0 0 0 17 17 1 1 0 0 0 1-1v-3.5a1 1 0 0 0-1-1z" /></svg>
          </div>

          {/* Mensajes */}
          <div
            ref={scrollRef}
            style={{
              padding: "14px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 7,
              height: 376,
              overflowY: "hidden",
              backgroundImage:
                "linear-gradient(rgba(236,229,220,0.6), rgba(236,229,220,0.6)), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='4' cy='4' r='1' fill='%23000' opacity='0.03'/%3E%3C/svg%3E\")",
            }}
          >
            {SCRIPT.slice(0, visible).map((m, i) => (
              <HeroBubble key={i} turn={m} />
            ))}
            {typing && (
              <div
                className="lp-bub-enter"
                style={{
                  alignSelf: "flex-end",
                  background: "#dcf8c6",
                  borderRadius: "14px 14px 4px 14px",
                  padding: "11px 14px",
                  boxShadow: "0 1px 1px rgba(0,0,0,0.12)",
                  color: "#075e54",
                }}
              >
                <span className="lp-typing"><i /><i /><i /></span>
              </div>
            )}
          </div>

          {/* Barra de input (decorativa) */}
          <div style={{ background: "#f0f0f0", padding: "9px 10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, background: "#fff", borderRadius: 22, padding: "9px 14px", fontSize: 12.5, color: "#9aa0a6" }}>Escribí un mensaje…</div>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#075e54", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l14-6-6 14-2-6-6-2z" /></svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroBubble({ turn }: { turn: Turn }) {
  const isMe = turn.from === "me";
  return (
    <div
      className="lp-bub-enter"
      style={{
        alignSelf: isMe ? "flex-end" : "flex-start",
        maxWidth: "84%",
        background: isMe ? "#dcf8c6" : "#fff",
        borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
        padding: "7px 10px 5px",
        boxShadow: "0 1px 1px rgba(0,0,0,0.12)",
      }}
    >
      <p style={{ margin: 0, fontSize: 13, color: "#111b21", lineHeight: 1.42 }}>{turn.text}</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3, marginTop: 2 }}>
        <span style={{ fontSize: 10, color: "#667781" }}>{turn.t}</span>
        {isMe && <ReadTicks />}
      </div>
    </div>
  );
}
