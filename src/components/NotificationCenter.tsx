"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  emoji: string;
  title: string;
  desc?: string;
  href: string;
  /** Si suma al badge rojo (las informativas, como "chats nuevos hoy", no). */
  counts: boolean;
}

const KIND_COLOR: Record<NotifKind, string> = {
  danger: "var(--danger)",
  warning: "var(--accent)",
  info: "var(--green)",
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export default function NotificationCenter({ align = "right" }: { align?: "left" | "right" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Posiciona el panel (portal, fixed) respecto a la campana — así no lo recorta
  // ningún contenedor con overflow/transform. En mobile usa ancho completo
  // (sheet) para que nunca quede cortado; en desktop ancla bajo la campana.
  function openMenu() {
    const r = bellRef.current?.getBoundingClientRect();
    if (!r) {
      setOpen(true);
      return;
    }
    const vw = window.innerWidth;
    const top = r.bottom + 8;
    if (vw < 640) {
      setCoords({ top, left: 12, right: 12 });
    } else {
      const width = 360;
      if (align === "left") {
        setCoords({ top, left: Math.min(Math.max(12, r.left), vw - width - 12) });
      } else {
        setCoords({ top, right: Math.min(Math.max(12, vw - r.right), vw - width - 12) });
      }
    }
    setOpen(true);
  }

  async function load() {
    const [conn, convs, appts] = await Promise.all([
      fetchJson<{ status?: string }>("/api/connection/status"),
      fetchJson<Array<{ id: string; name?: string; mode?: string; needs_attention?: boolean; hot_lead?: boolean; last_message_preview?: string; last_message_at?: number }>>("/api/conversations"),
      fetchJson<{ appointments?: Array<{ id: string; status?: string; customer_name?: string }> }>("/api/appointments"),
    ]);

    const list: NotifItem[] = [];
    const all = Array.isArray(convs) ? convs : [];

    // 1) WhatsApp desconectado (lo más urgente: el bot no responde).
    if (conn && conn.status && conn.status !== "connected") {
      list.push({
        id: "wa-disconnected", kind: "danger", emoji: "⚠️", counts: true,
        title: "WhatsApp desconectado",
        desc: "El asistente no está respondiendo. Reconectá ahora.",
        href: "/app/connect",
      });
    }

    // 1.5) Leads calientes: la IA detectó intención clara de compra/reserva.
    const hotLeads = all
      .filter((c) => c.hot_lead)
      .sort((a, b) => (b.last_message_at ?? 0) - (a.last_message_at ?? 0));
    for (const c of hotLeads.slice(0, 5)) {
      list.push({
        id: `hot-${c.id}`, kind: "danger", emoji: "🔥", counts: true,
        title: `${(c.name ?? "").trim() || "Un cliente"} está por comprar`,
        desc: (c.last_message_preview ?? "").trim().slice(0, 70) || "Mostró interés de compra. Cerralo vos.",
        href: `/app/conversations?c=${c.id}`,
      });
    }

    // 2) Reservas / turnos por confirmar.
    const appointments = Array.isArray(appts?.appointments) ? appts!.appointments : [];
    const pending = appointments.filter((a) => a.status === "pending");
    if (pending.length > 0) {
      list.push({
        id: "appointments-pending", kind: "warning", emoji: "📅", counts: true,
        title: `${pending.length} ${pending.length === 1 ? "reserva por confirmar" : "reservas por confirmar"}`,
        desc: "Revisá y confirmá los turnos pendientes.",
        href: "/app/agenda",
      });
    }

    // 3) Chats derivados a una persona (modo HUMAN): necesitan que respondas vos.
    const handoff = all
      .filter((c) => c.needs_attention && c.mode === "HUMAN")
      .sort((a, b) => (b.last_message_at ?? 0) - (a.last_message_at ?? 0));
    for (const c of handoff.slice(0, 5)) {
      list.push({
        id: `handoff-${c.id}`, kind: "danger", emoji: "🙋", counts: true,
        title: `${(c.name ?? "").trim() || "Un cliente"} necesita atención humana`,
        desc: (c.last_message_preview ?? "").trim().slice(0, 70) || "Tomá el chat desde el inbox.",
        href: `/app/conversations?c=${c.id}`,
      });
    }

    // 4) Consultas que el asistente dejó pendientes (sigue en modo AI pero quedó
    //    debiendo un dato — "dame un momento y lo consulto"). Cargá la info.
    const consult = all
      .filter((c) => c.needs_attention && c.mode === "AI")
      .sort((a, b) => (b.last_message_at ?? 0) - (a.last_message_at ?? 0));
    for (const c of consult.slice(0, 5)) {
      list.push({
        id: `consult-${c.id}`, kind: "warning", emoji: "🤔", counts: true,
        title: `${(c.name ?? "").trim() || "Un cliente"}: el asistente quedó debiendo info`,
        desc: (c.last_message_preview ?? "").trim().slice(0, 70) || "Cargá el dato o respondé desde el panel.",
        href: `/app/conversations?c=${c.id}`,
      });
    }

    // 5) Resumen informativo: chats nuevos hoy (no suma al badge rojo).
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTs = Math.floor(todayStart.getTime() / 1000);
    const newToday = all.filter((c) => (c.last_message_at ?? 0) >= todayTs).length;
    if (newToday > 0) {
      list.push({
        id: "new-today", kind: "info", emoji: "🆕", counts: false,
        title: `${newToday} ${newToday === 1 ? "chat con actividad hoy" : "chats con actividad hoy"}`,
        desc: "Mirá cómo viene el día en el inbox.",
        href: "/app/conversations",
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

  // Cerrar al hacer click afuera (campana o panel), con Escape, o al scrollear.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      const inBell = ref.current?.contains(t);
      const inPanel = panelRef.current?.contains(t);
      if (!inBell && !inPanel) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScroll() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const count = items.length;
  const badgeCount = items.filter((i) => i.counts).length;

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        ref={bellRef}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="liquid-icon"
        style={{ position: "relative", cursor: "pointer", border: "1px solid var(--glass-border)" }}
        aria-label="Notificaciones"
        aria-expanded={open}
      >
        <Bell size={17} />
        {badgeCount > 0 && (
          <span className="atd-badge" style={{ position: "absolute", top: -5, right: -5 }}>
            {badgeCount}
          </span>
        )}
      </button>

      {open && coords && createPortal(
        <>
          {/* Scrim: oscurece el fondo para que el panel destaque (mobile y desktop). */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.35)" }}
          />
        <div
          ref={panelRef}
          role="menu"
          style={{
            position: "fixed",
            top: coords.top,
            right: coords.right,
            left: coords.left,
            width: coords.left != null && coords.right != null ? "auto" : "min(360px, calc(100vw - 24px))",
            maxHeight: "min(72vh, 540px)",
            overflowY: "auto",
            zIndex: 1000,
            borderRadius: 18,
            border: "1px solid var(--glass-border)",
            background: "var(--bg-elev)",
            boxShadow: "0 24px 60px -16px rgba(0,0,0,0.6)",
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
                    {item.emoji}
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
        </>,
        document.body
      )}
    </div>
  );
}
