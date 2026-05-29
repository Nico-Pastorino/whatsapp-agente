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
    const interval = setInterval(loadMessages, 2000);
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg)" }}>
      {/* Header */}
      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--hairline)", background: "var(--surface)" }}>
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
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--hairline)" }}>
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
        <div style={{ margin: "8px 14px 0", padding: "10px 14px", borderRadius: 12, background: "var(--human-tint)", border: "1px solid rgba(212,154,58,0.3)", fontSize: 12.5, color: "var(--human)", fontWeight: 500 }}>
          👋 La IA derivó esta conversación. Respondé para retomar el contacto.
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
        {messages.length === 0 ? (
          <p className="mono" style={{ textAlign: "center", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", padding: "20px 0" }}>Sin mensajes aún</p>
        ) : (
          <>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", margin: "4px 0 8px" }}>· hoy ·</div>
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
      <div style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--hairline)", background: "var(--surface)" }}>
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
            <div style={{ width: 36, height: 36, borderRadius: 999, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Plus size={16} style={{ color: "var(--muted)" }} />
            </div>
            <input
              type="text" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Escribí un mensaje..."
              disabled={sending}
              style={{ flex: 1, minHeight: 36, padding: "9px 14px", borderRadius: 18, background: "var(--surface-2)", border: "1px solid var(--hairline)", fontSize: 13, color: "var(--ink)", fontFamily: "var(--font-sans)", outline: "none" }}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              style={{ width: 36, height: 36, borderRadius: 999, background: "var(--ink)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "none", cursor: "pointer", opacity: sending || !input.trim() ? 0.4 : 1 }}
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div className="atd-card" style={{ padding: 24, maxWidth: 340, width: "100%" }}>
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
