"use client";

import { useState } from "react";
import { Search, Spark } from "./atende/Icons";
import { Avatar } from "./atende/Icons";
import { deriveLeadSignal } from "@/lib/conversation-insights";

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
  last_message_at: number | null;
  last_message_preview: string | null;
}

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function displayName(conv: Conversation): string {
  if (conv.name) return conv.name;
  return conv.phone.split("@")[0].split(":")[0];
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((s) => s[0] ?? "").join("").toUpperCase() || "?";
}

function relativeTime(ts: number | null): string {
  if (!ts) return "";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

type Filter = "all" | "ia" | "human";

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((c) => {
    if (filter === "ia" && c.mode !== "AI") return false;
    if (filter === "human" && c.mode !== "HUMAN") return false;
    if (search) {
      const q = search.toLowerCase();
      const name = displayName(c).toLowerCase();
      return name.includes(q) || (c.last_message_preview ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const iaCount = conversations.filter((c) => c.mode === "AI").length;
  const humanCount = conversations.filter((c) => c.mode === "HUMAN").length;
  const attentionCount = conversations.filter((c) => c.needs_attention).length;

  return (
    <div className="conversation-list" style={{ display: "flex", flexDirection: "column", height: "100%", background: "transparent" }}>
      {/* Header */}
      <div className="page-header" style={{ padding: "16px 18px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div>
            <div className="page-sub">
              chats
            </div>
            <h1 className="page-title">Conversaciones</h1>
          </div>
          {attentionCount > 0 && (
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              minWidth: 22, height: 22, borderRadius: 999, padding: "0 6px",
              background: "var(--human)", color: "#fff",
              fontSize: 11, fontWeight: 700, lineHeight: 1,
            }}>
              {attentionCount}
            </span>
          )}
        </div>
        <button
          className="atd-btn ghost sm"
          style={{ width: 38, padding: 0, borderRadius: 12 }}
          onClick={() => document.getElementById("conv-search")?.focus()}
        >
          <Search size={18} />
        </button>
      </div>

      {attentionCount > 0 && (
        <button
          onClick={() => setFilter("human")}
          style={{
            margin: "0 16px 10px",
            padding: 14,
            borderRadius: 18,
            border: "1px solid color-mix(in oklab, var(--human) 30%, transparent)",
            background: "var(--human-tint)",
            color: "var(--human)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span>
            <strong style={{ display: "block", fontSize: 14 }}>{attentionCount} para atender</strong>
            <span style={{ display: "block", fontSize: 12.5, opacity: 0.82, marginTop: 2 }}>
              Clientes esperando respuesta humana.
            </span>
          </span>
          <span style={{ fontSize: 18 }}>→</span>
        </button>
      )}

      {/* Search */}
      <div style={{ padding: "0 16px 10px" }}>
        <div className="liquid-panel" style={{ height: 42, display: "flex", alignItems: "center", padding: "0 13px", gap: 8 }}>
          <Search size={16} style={{ color: "var(--muted)", flexShrink: 0 }} />
          <input
            id="conv-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversación..."
            style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--ink)", fontFamily: "var(--font-sans)" }}
          />
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ padding: "0 16px 12px", display: "flex", gap: 6, overflowX: "auto" }}>
        {([
          ["all",   `Todas ${conversations.length}`],
          ["ia",    `IA ${iaCount}`],
          ["human", `Humano ${humanCount}`],
        ] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="atd-pill"
            style={{
              background: filter === key ? "var(--ink)" : "var(--glass)",
              color: filter === key ? "var(--bg)" : "var(--ink-2)",
              borderColor: filter === key ? "transparent" : "var(--hairline-2)",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 10px 12px" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
            {search.trim() || filter !== "all"
              ? "No encontramos conversaciones con ese filtro."
              : "Cuando un cliente escriba a tu WhatsApp, la conversación va a aparecer acá."}
          </div>
        ) : (
          filtered.map((conv) => {
            const name = displayName(conv);
            const isIA = conv.mode === "AI";
            const isSelected = selectedId === conv.id;
            const needsAttention = conv.needs_attention && !isIA;
            const signal = deriveLeadSignal(conv);
            const showSignalChip = signal && signal.key !== "attention";

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "12px",
                  display: "flex", alignItems: "center", gap: 12,
                  border: "1px solid var(--glass-border)",
                  borderRadius: 20,
                  marginBottom: 8,
                  background: isSelected
                    ? "var(--glass-strong)"
                    : needsAttention
                    ? "rgba(212,154,58,0.06)"
                    : "var(--glass-soft)",
                  boxShadow: isSelected ? "var(--shadow-1)" : "none",
                  cursor: "pointer",
                  transition: "background .15s, transform .15s var(--ease-ios)",
                }}
              >
                {/* Avatar with mode badge */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <Avatar
                    initials={initials(name)}
                    size={42}
                    bg={isIA ? "var(--green-tint)" : needsAttention ? "rgba(212,154,58,0.18)" : "var(--human-tint)"}
                    fg={isIA ? "var(--green-ink)" : "var(--human)"}
                  />
                  {isIA && (
                    <span style={{
                      position: "absolute", bottom: -2, right: -2,
                      width: 16, height: 16, borderRadius: 999,
                      background: "var(--accent)", color: "var(--on-accent)",
                      border: "2px solid var(--bg)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Spark size={8} />
                    </span>
                  )}
                  {needsAttention && (
                    <span style={{
                      position: "absolute", bottom: -2, right: -2,
                      width: 16, height: 16, borderRadius: 999,
                      background: "var(--human)", color: "#fff",
                      border: "2px solid var(--bg)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 700,
                    }}>!</span>
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 14.5, fontWeight: needsAttention ? 600 : 500, color: "var(--ink)" }}>{name}</span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>
                      {relativeTime(conv.last_message_at)}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                    <span style={{ fontSize: 13, color: needsAttention ? "var(--human)" : "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {needsAttention ? "⚡ Necesita atención" : (conv.last_message_preview ?? "Sin mensajes")}
                    </span>
                    {!isIA && !needsAttention && (
                      <span style={{ marginLeft: 8, width: 8, height: 8, borderRadius: 999, background: "var(--human)", flexShrink: 0 }} />
                    )}
                  </div>
                  {showSignalChip && (
                    <div style={{ marginTop: 5 }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        height: 19, padding: "0 8px", borderRadius: 999,
                        fontSize: 10.5, fontWeight: 600, lineHeight: 1,
                        background: signal!.bg, color: signal!.fg,
                      }}>
                        {signal!.label}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
