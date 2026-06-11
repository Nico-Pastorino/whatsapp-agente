"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Dot3, Spark, Send, Plus } from "./atende/Icons";
import { Avatar } from "./atende/Icons";

interface Message {
  id: string;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

interface Conversation {
  id: string;
  contact_id: string;
  phone: string;
  phone_number: string | null;
  primary_jid: string | null;
  name: string | null;
  mode: "AI" | "HUMAN";
  outgoing_jid: string | null;
  safe_outgoing_jid: string | null;
  has_safe_outgoing_jid: boolean;
  needs_phone_mapping: boolean;
  needs_attention: boolean;
}

interface Props {
  conversation: Conversation;
  onModeChange: (mode: "AI" | "HUMAN") => void;
  onConversationUpdate: (conversation: {
    id: string;
    phone: string;
    phone_number: string | null;
    primary_jid: string | null;
    outgoing_jid: string | null;
    safe_outgoing_jid: string | null;
    has_safe_outgoing_jid: boolean;
    needs_phone_mapping: boolean;
    needs_attention: boolean;
  }) => void;
  onDelete: () => void;
  onBack?: () => void;
}

function displayName(conv: Conversation): string {
  if (conv.name) return conv.name;
  return conv.phone.split("@")[0].split(":")[0];
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((s) => s[0] ?? "").join("").toUpperCase() || "?";
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

// Etiqueta del divisor superior del historial: "hoy", "ayer" o la fecha.
function formatDayLabel(ts: number): string {
  const date = new Date(ts * 1000);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  if (date >= today) return "hoy";
  if (date >= yesterday) return "ayer";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export default function ConversationPanel({
  conversation,
  onModeChange,
  onConversationUpdate,
  onDelete,
  onBack,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<"AI" | "HUMAN">(conversation.mode);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(conversation.mode);
    setSendError(null);
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  // Load quick replies once on mount
  useEffect(() => {
    fetch("/api/business")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (Array.isArray(data?.quick_replies)) setQuickReplies(data.quick_replies);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Polling más espaciado y pausado si la pestaña no está visible (ahorra egress).
    const tick = () => { if (!document.hidden) loadMessages(); };
    const interval = setInterval(tick, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  async function loadMessages() {
    const res = await fetch(`/api/messages/${conversation.id}`);
    if (res.ok) setMessages(await res.json());
  }

  async function handleModeChange(next: "AI" | "HUMAN") {
    if (next === mode) return;
    setMode(next);
    onModeChange(next);
    try {
      await fetch(`/api/mode/${conversation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
    } catch {
      // best-effort; local state already updated
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    setInput("");
    const res = await fetch(`/api/messages/${conversation.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: string; message?: string } | null;
      setSendError(payload?.message ?? payload?.error ?? "No se pudo enviar.");
      setInput(text);
    } else {
      await loadMessages();
    }
    setSending(false);
  }

  async function confirmDelete() {
    await fetch(`/api/conversations/${conversation.id}`, { method: "DELETE" });
    setShowDeleteConfirm(false);
    onDelete();
  }

  const name = displayName(conversation);
  const isIA = mode === "AI";

  return (
    <div className="conversation-panel" style={{ display: "flex", flexDirection: "column", height: "100%", background: "transparent" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--glass-border)", background: "var(--glass)", backdropFilter: "blur(18px) saturate(1.5)", WebkitBackdropFilter: "blur(18px) saturate(1.5)" }}>
        {onBack && (
          <button onClick={onBack} style={{ width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", cursor: "pointer", background: "none", border: "none", flexShrink: 0 }}>
            <ArrowLeft size={20} />
          </button>
        )}
        <Avatar initials={initials(name)} size={38} bg={isIA ? "var(--green-tint)" : "var(--human-tint)"} fg={isIA ? "var(--green-ink)" : "var(--human)"} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{name}</div>
          <div className="mono" style={{ fontSize: 11, color: isIA ? "var(--green-soft)" : "var(--human)" }}>
            {isIA ? "respondiendo con IA" : "modo humano"}
          </div>
        </div>
        <button onClick={() => setShowDeleteConfirm(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
          <Dot3 size={18} />
        </button>
      </div>

      {/* Mode toggle */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--glass-border)" }}>
        <div className="atd-seg" style={{ width: "100%" }}>
          <button className={isIA ? "on" : ""} onClick={() => handleModeChange("AI")} style={{ flex: 1, justifyContent: "center" }}>
            <Spark size={14} /> IA
          </button>
          <button className={!isIA ? "on" : ""} onClick={() => handleModeChange("HUMAN")} style={{ flex: 1, justifyContent: "center" }}>
            Humano
          </button>
        </div>
      </div>

      {/* Needs attention banner */}
      {conversation.needs_attention && !isIA && (
        <div className="liquid-panel" style={{ margin: "10px 14px 0", padding: "10px 14px", fontSize: 12.5, color: "var(--human)", fontWeight: 500 }}>
          La IA derivó esta conversación. Respondé para retomar el contacto.
        </div>
      )}

      {/* Messages */}
      <div className="conversation-messages" style={{ flex: 1, overflow: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 7 }}>
        {messages.length === 0 ? (
          <p className="mono" style={{ textAlign: "center", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", padding: "20px 0" }}>Sin mensajes aún</p>
        ) : (
          <>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", margin: "4px 0 8px" }}>· {formatDayLabel(messages[0].created_at)} ·</div>
            {messages.map((m) => {
              const isOut = m.role === "assistant" || m.role === "human";
              const isHumanOut = m.role === "human";
              return (
                <div
                  key={m.id}
                  className={`atd-bub ${isOut ? (isHumanOut ? "human-out" : "out") : "in"}`}
                >
                  {m.content}
                  <div className="bub-meta">
                    {m.role === "assistant" && <><Spark size={9} /> ia · </>}
                    {m.role === "human" && "vos · "}
                    {formatTime(m.created_at)}
                  </div>
                </div>
              );
            })}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="conversation-composer" style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--glass-border)", background: "var(--glass)", backdropFilter: "blur(18px) saturate(1.45)", WebkitBackdropFilter: "blur(18px) saturate(1.45)" }}>
        {isIA ? (
          <p className="mono" style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", textTransform: "uppercase" }}>
            El asistente responde automáticamente
          </p>
        ) : (
          <>
          {/* Quick reply chips */}
          {quickReplies.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid var(--hairline)" }}>
              {quickReplies.map((reply, i) => (
                <button
                  key={i}
                  onClick={() => setInput(reply)}
                  style={{
                    padding: "4px 12px", borderRadius: 16,
                    background: input === reply ? "var(--ink)" : "var(--surface-2)",
                    color: input === reply ? "var(--bg)" : "var(--ink-2)",
                    border: "1px solid var(--hairline)",
                    fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
                    maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis",
                    transition: "background .15s, color .15s",
                  }}
                  title={reply}
                >
                  {reply}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div className="liquid-icon" style={{ width: 38, height: 38, borderRadius: 999 }}>
              <Plus size={16} style={{ color: "var(--muted)" }} />
            </div>
            <input
              type="text" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Escribí un mensaje..."
              disabled={sending}
              className="atd-input"
              style={{ flex: 1, minHeight: 40, fontSize: 13 }}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="liquid-action primary"
              style={{ width: 40, height: 40, minHeight: 40, padding: 0 }}
            >
              {sending ? "·" : <Send size={16} />}
            </button>
          </div>
          </>
        )}
        {sendError && <p style={{ fontSize: 12, color: "#c0392b", marginTop: 6 }}>{sendError}</p>}
      </div>

      {/* Delete modal */}
      {showDeleteConfirm && (
        <div className="atd-overlay" style={{ zIndex: 50 }}>
          <div className="atd-modal" style={{ padding: 24, maxWidth: 340, width: "100%" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Borrar conversación</h3>
            <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 20 }}>
              Se borrarán todos los mensajes. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowDeleteConfirm(false)} className="atd-btn ghost sm" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button onClick={confirmDelete} className="atd-btn sm" style={{ flex: 1, background: "#c0392b", color: "#fff", border: "none" }}>
                Borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
