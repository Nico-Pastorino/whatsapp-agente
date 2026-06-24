"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "./atende/Icons";

// Centro de notificaciones desplegable. Junta alertas accionables a partir de
// datos que ya existen (sin cambios de backend):
//  - WhatsApp desconectado (el asistente no responde)
//  - Reservas / turnos por confirmar
//  - Chats que necesitan atención humana
// Se refresca solo cada 30s y al abrir.

type NotifKind = "danger" | "warning" | "info";

interface NotifItem {
  id: string;
  kind: NotifKind;
  title: string;
  desc?: string;
  href: string;
}

const KIND_COLOR: Record<NotifKind, string> = {
  danger: "var(--danger)",
  warning: "var(--accent)",
  info: "var(--green)",
};

const KIND_EMOJI: Record<NotifKind, string> = {
  danger: "⚠️",
  warning: "📅",
  info: "💬",
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export default function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const [conn, convs, appts] = await Promise.all([
      fetchJson<{ status?: string }>("/api/connection/status"),
      fetchJson<Array<{ id: string; name?: string; mode?: string; needs_attention?: boolean; last_message_preview?: string; last_message_at?: number }>>("/api/conversations"),
      fetchJson<{ appointments?: Array<{ id: string; status?: string; customer_name?: string }> }>("/api/appointments"),
    ]);

    const list: NotifItem[] = [];

    if (conn && conn.status && conn.status !== "connected") {
      list.push({
        id: "wa-disconnected",
        kind: "danger",
        title: "WhatsApp desconectado",
        desc: "El asistente no está respondiendo. Reconectá ahora.",
        href: "/app/connect",
      });
    }

    const appointments = Array.isArray(appts?.appointments) ? appts!.appointments : [];
    const pending = appointments.filter((a) => a.status === "pending");
    if (pending.length > 0) {
      list.push({
        id: "appointments-pending",
        kind: "warning",
        title: `${pending.length} ${pending.length === 1 ? "reserva por confirmar" : "reservas por confirmar"}`,
        desc: "Revisá y confirmá los turnos pendientes.",
        href: "/app/agenda",
      });
    }

    const attention = (Array.isArray(convs) ? convs : [])
      .filter((c) => c.needs_attention && c.mode !== "AI")
      .sort((a, b) => (b.last_message_at ?? 0) - (a.last_message_at ?? 0));
    for (const c of attention.slice(0, 6)) {
      list.push({
        id: `chat-${c.id}`,
        kind: "info",
        title: `${(c.name ?? "").trim() || "Un cliente"} necesita atención`,
        desc: (c.last_message_preview ?? "").trim().slice(0, 70),
        href: `/app/conversations?c=${c.id}`,
      });
    }

    setItems(list);
    setLoaded(true);
  }

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (!document.hidden) load();
    }, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cerrar al hacer click afuera o con Escape.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const count = items.length;

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="liquid-icon"
        style={{ position: "relative", cursor: "pointer", border: "1px solid var(--glass-border)" }}
        aria-label="Notificaciones"
        aria-expanded={open}
      >
        <Bell size={17} />
        {count > 0 && (
          <span className="atd-badge" style={{ position: "absolute", top: -5, right: -5 }}>
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: "min(360px, 88vw)",
            maxHeight: "min(70vh, 520px)",
            overflowY: "auto",
            zIndex: 200,
            borderRadius: 18,
            border: "1px solid var(--glass-border)",
            background: "var(--bg-elev, var(--surface))",
            backdropFilter: "blur(30px) saturate(1.6)",
            WebkitBackdropFilter: "blur(30px) saturate(1.6)",
            boxShadow: "0 24px 60px -20px rgba(0,0,0,0.55)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--hairline)" }}>
            <span style={{ fontSize: 14.5, fontWeight: 720, color: "var(--ink)" }}>Notificaciones</span>
            {count > 0 && <span className="atd-badge">{count}</span>}
          </div>

          {!loaded ? (
            <div style={{ padding: "26px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Cargando…</div>
          ) : count === 0 ? (
            <div style={{ padding: "30px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
              <p style={{ fontSize: 14, fontWeight: 650, color: "var(--ink)", margin: "0 0 4px" }}>Estás al día</p>
              <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: 0 }}>No hay nada pendiente por ahora.</p>
            </div>
          ) : (
            <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((item) => (
                <button
                  key={item.id}
                  role="menuitem"
                  onClick={() => go(item.href)}
                  style={{
                    width: "100%", padding: "11px 12px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                    border: "1px solid var(--glass-border)", background: "var(--surface-2)", color: "var(--ink)",
                    display: "flex", alignItems: "flex-start", gap: 11,
                  }}
                >
                  <span
                    style={{
                      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                      display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 17,
                      background: `color-mix(in oklab, ${KIND_COLOR[item.kind]} 18%, transparent)`,
                    }}
                  >
                    {KIND_EMOJI[item.kind]}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 650, color: "var(--ink)" }}>{item.title}</span>
                    {item.desc && (
                      <span style={{ display: "block", fontSize: 12, color: "var(--ink-3)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.desc}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
