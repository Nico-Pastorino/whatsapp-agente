"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowLeft, Dot3, Spark, Send } from "./atende/Icons";
import { Avatar } from "./atende/Icons";
import ModalPortal from "./ModalPortal";

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

// ¿Dos timestamps (en segundos) caen el mismo día calendario?
function sameDay(a: number, b: number): boolean {
  const da = new Date(a * 1000);
  const db = new Date(b * 1000);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
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
  const [loadingMessages, setLoadingMessages] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesBoxRef = useRef<HTMLDivElement>(null);
  // ¿El usuario está cerca del fondo? Si está leyendo historial arriba, NO lo
  // arrastramos al fondo cuando llega un mensaje nuevo o entra el polling.
  const nearBottomRef = useRef(true);
  // Firma del último set de mensajes (cantidad + id del último) para evitar
  // re-render y auto-scroll cuando el polling devuelve lo mismo.
  const lastSigRef = useRef("");
  // En el primer render de una conversación saltamos al fondo sin animación.
  const firstLoadRef = useRef(true);

  function isNearBottom(): boolean {
    const el = messagesBoxRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  function scrollToBottom(behavior: ScrollBehavior) {
    const el = messagesBoxRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }

  useEffect(() => {
    setMode(conversation.mode);
    setSendError(null);
    setMessages([]);
    setLoadingMessages(true);
    lastSigRef.current = "";
    firstLoadRef.current = true;
    nearBottomRef.current = true;
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
    if (messages.length === 0) return;
    if (firstLoadRef.current) {
      // Primera carga de la conversación: al fondo, instantáneo.
      firstLoadRef.current = false;
      scrollToBottom("auto");
    } else if (nearBottomRef.current) {
      // Solo seguimos al fondo si el usuario ya estaba abajo.
      scrollToBottom("smooth");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!res.ok) {
      setLoadingMessages(false);
      return;
    }
    const data: Message[] = await res.json();
    // Antes de actualizar, recordamos si el usuario estaba cerca del fondo.
    nearBottomRef.current = isNearBottom();
    const sig = `${data.length}:${data[data.length - 1]?.id ?? ""}`;
    setLoadingMessages(false);
    // Sin cambios reales: no re-seteamos (evita re-render y el salto de scroll).
    if (sig === lastSigRef.current) return;
    lastSigRef.current = sig;
    setMessages(data);
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
    // Optimistic UI: mostramos el mensaje al toque, sin esperar al servidor.
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      role: "human",
      content: text,
      created_at: Math.floor(Date.now() / 1000),
    };
    nearBottomRef.current = true;
    setMessages((prev) => [...prev, optimistic]);
    const res = await fetch(`/api/messages/${conversation.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: string; message?: string } | null;
      setSendError(payload?.message ?? payload?.error ?? "No se pudo enviar.");
      // Revertimos el optimista y restauramos el texto para reintentar.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
    } else {
      lastSigRef.current = ""; // forzar reconciliación con la verdad del server
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
          <button aria-label="Volver a la lista de chats" onClick={onBack} style={{ width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", cursor: "pointer", background: "none", border: "none", flexShrink: 0 }}>
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
        <button aria-label="Opciones de la conversación" onClick={() => setShowDeleteConfirm(true)} style={{ width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
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
      <div
        ref={messagesBoxRef}
        onScroll={() => { nearBottomRef.current = isNearBottom(); }}
        className="conversation-messages"
        style={{ flex: 1, overflow: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 7 }}
      >
        {messages.length === 0 ? (
          <p className="mono" style={{ textAlign: "center", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", padding: "20px 0" }}>
            {loadingMessages ? "Cargando mensajes…" : "Sin mensajes aún"}
          </p>
        ) : (
          <>
            {messages.map((m, i) => {
              const isOut = m.role === "assistant" || m.role === "human";
              const isHumanOut = m.role === "human";
              // Divisor de fecha cada vez que cambia el día calendario.
              const showDay = i === 0 || !sameDay(messages[i - 1].created_at, m.created_at);
              return (
                <Fragment key={m.id}>
                  {showDay && (
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", margin: "8px 0 4px" }}>· {formatDayLabel(m.created_at)} ·</div>
                  )}
                  <div className={`atd-bub ${isOut ? (isHumanOut ? "human-out" : "out") : "in"}`}>
                    {m.content}
                    <div className="bub-meta">
                      {m.role === "assistant" && <><Spark size={9} /> ia · </>}
                      {m.role === "human" && "vos · "}
                      {formatTime(m.created_at)}
                    </div>
                  </div>
                </Fragment>
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
            <input
              type="text" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Escribí un mensaje..."
              disabled={sending}
              className="atd-input"
              style={{ flex: 1, minHeight: 44, fontSize: 14 }}
            />
            <button
              aria-label="Enviar mensaje"
              aria-busy={sending}
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="liquid-action primary"
              style={{ width: 44, height: 44, minHeight: 44, padding: 0 }}
            >
              {sending ? <span className="atd-spinner" style={{ width: 16, height: 16 }} /> : <Send size={16} />}
            </button>
          </div>
          </>
        )}
        {sendError && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>{sendError}</p>}
      </div>

      {/* Delete modal */}
      {showDeleteConfirm && (
        <ModalPortal>
        <div className="atd-overlay" style={{ zIndex: 140 }}>
          <div className="atd-modal" style={{ padding: 24, maxWidth: 340, width: "100%" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Borrar conversación</h3>
            <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 20 }}>
              Se borrarán todos los mensajes. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowDeleteConfirm(false)} className="atd-btn ghost sm" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button onClick={confirmDelete} className="atd-btn sm" style={{ flex: 1, background: "var(--danger)", color: "#fff", border: "none" }}>
                Borrar
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
