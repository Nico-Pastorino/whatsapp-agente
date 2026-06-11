"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Spark, Send, X } from "./atende/Icons";

interface TestMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Hola, ¿qué horarios tienen?",
  "¿Cuánto sale?",
  "¿Hacen envíos?",
  "Quiero hacer una reserva",
];

export default function AssistantTester({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  function requestClose() {
    if (isClosing) return;
    setIsClosing(true);
    window.setTimeout(onClose, 220);
  }

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || sending) return;
    setError(null);
    const next: TestMessage[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/assistant/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.reply) {
        setError(data?.error ?? "No pudimos generar la respuesta de prueba.");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setSending(false);
    }
  }

  return createPortal(
    <div
      className={`atd-overlay sheet ${isClosing ? "closing" : ""}`}
      style={{ zIndex: 95 }}
      onClick={requestClose}
    >
      <div
        className="atd-modal"
        style={{ width: "100%", maxWidth: 480, height: "min(82svh, 620px)", padding: 0, display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="atd-sheet-grabber md:hidden" />
        {/* Header */}
        <div style={{ padding: "12px 16px 14px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: "var(--green-tint)", color: "var(--green-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Spark size={18} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>Probar asistente</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>prueba · no se envía a nadie</div>
          </div>
          <button onClick={requestClose} aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: 999, border: "1px solid var(--hairline)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} />
          </button>
        </div>

        {/* Mensajes */}
        <div style={{ flex: 1, overflow: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6, background: "var(--bg)" }}>
          {messages.length === 0 && !sending && (
            <div style={{ margin: "auto", textAlign: "center", maxWidth: 280 }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>💬</div>
              <p style={{ fontSize: 13.5, color: "var(--ink-3)", margin: "0 0 14px" }}>
                Escribí como si fueras un cliente. Tu asistente responde con la configuración que guardaste.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="atd-chip" style={{ fontWeight: 500 }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <div key={i} className={`atd-bub ${isUser ? "human-out" : "in"}`}>
                {m.content}
                <div className="bub-meta">
                  {m.role === "assistant" && <><Spark size={9} /> tu asistente</>}
                  {isUser && "vos (cliente)"}
                </div>
              </div>
            );
          })}

          {sending && (
            <div className="atd-bub in" style={{ color: "var(--muted)" }}>
              <span className="lp-typing"><i /><i /><i /></span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <div style={{ padding: "8px 16px", fontSize: 12.5, color: "#c0392b", background: "var(--surface)", borderTop: "1px solid var(--hairline)" }}>
            {error}
          </div>
        )}

        {/* Composer */}
        <div style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--hairline)", background: "var(--surface)", display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Escribí un mensaje de prueba..."
            disabled={sending}
            style={{ flex: 1, minHeight: 38, padding: "9px 14px", borderRadius: 18, background: "var(--surface-2)", border: "1px solid var(--hairline)", fontSize: 13.5, color: "var(--ink)", fontFamily: "var(--font-sans)", outline: "none" }}
          />
          <button
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            style={{ width: 38, height: 38, borderRadius: 999, background: "var(--ink)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "none", cursor: "pointer", opacity: sending || !input.trim() ? 0.4 : 1 }}
            aria-label="Enviar"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
