"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spark, Chat, Shop, Bolt, Layers, Users, QR, BarChart, Calendar, LifeBuoy, Logout } from "./atende/Icons";
import ThemeToggle from "./ThemeToggle";
import { canAccessView, type DashboardRole } from "@/lib/role-access";

type DashboardView =
  | "conversations"
  | "business"
  | "catalog"
  | "agenda"
  | "home"
  | "more"
  | "plan"
  | "team"
  | "connect"
  | "stats"
  | "support";

interface Props {
  activeView: DashboardView;
  phone: string | null;
  role?: DashboardRole;
  onDisconnect: () => void;
}

function AtendeWordmark() {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline" }}>
      <span style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em", lineHeight: 1 }}>
        atendé
      </span>
      <span style={{
        display: "inline-block", width: 6.5, height: 6.5, borderRadius: "50%",
        background: "var(--accent)", marginLeft: 2,
        position: "relative", bottom: 7, flexShrink: 0,
      }} />
    </span>
  );
}

const NAV_ITEMS: Array<{ key: DashboardView; label: string; Icon: React.ComponentType<{ size?: number }>; href: string }> = [
  { key: "home",          label: "Inicio",          Icon: Spark,  href: "/app/home" },
  { key: "conversations", label: "Conversaciones",  Icon: Chat,   href: "/app/conversations" },
  { key: "business",      label: "Mi negocio",       Icon: Shop,   href: "/app/business" },
  { key: "catalog",       label: "Productos y servicios", Icon: Bolt, href: "/app/catalog" },
  { key: "agenda",        label: "Reservas / Turnos", Icon: Calendar, href: "/app/agenda" },
  { key: "plan",          label: "Mi plan",          Icon: Layers, href: "/app/plan" },
  { key: "team",          label: "Equipo",           Icon: Users,  href: "/app/team" },
  { key: "stats",         label: "Métricas",         Icon: BarChart, href: "/app/stats" },
  { key: "connect",       label: "Conectar",         Icon: QR,     href: "/app/connect" },
  { key: "support",       label: "Ayuda y soporte",  Icon: LifeBuoy, href: "/app/support" },
];

export default function DashboardSidebar({ activeView, phone, role = "owner", onDisconnect }: Props) {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<
    Array<{ business_id: string; business_name: string; role: string }>
  >([]);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/businesses", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setBusinesses(data.businesses ?? []);
        setActiveBusinessId(data.active_business_id ?? null);
      })
      .catch(() => undefined);
  }, []);

  async function handleBusinessChange(nextId: string) {
    if (!nextId || nextId === activeBusinessId) return;
    const res = await fetch("/api/business/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: nextId }),
    });
    if (res.ok) {
      setActiveBusinessId(nextId);
      router.refresh();
    } else {
      alert("No se pudo cambiar de negocio.");
    }
  }

  async function handleDisconnectWA() {
    if (!confirm("¿Desconectar el número? Tendrás que escanear el QR de nuevo.")) return;
    const res = await fetch("/api/connection/disconnect", { method: "POST" });
    if (!res.ok) { alert("No se pudo desconectar."); return; }
    const startedAt = Date.now();
    while (Date.now() - startedAt < 15000) {
      try {
        const s = await fetch("/api/connection/status", { cache: "no-store" });
        if (s.ok) {
          const status = await s.json() as { status?: string };
          if (status.status === "disconnected" || status.status === "qr") {
            onDisconnect();
            return;
          }
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }
    alert("La desconexión sigue en proceso.");
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside style={{
      width: 252,
      height: "100%",
      background: "var(--glass-strong)",
      backdropFilter: "blur(30px) saturate(1.75)",
      WebkitBackdropFilter: "blur(30px) saturate(1.75)",
      borderRight: "1px solid var(--glass-border)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      boxShadow: "inset -1px 0 0 rgba(255,255,255,0.04)",
    }}>
      {/* Logo + business switcher */}
      <div style={{ padding: "24px 18px 16px" }}>
        <AtendeWordmark />
        {businesses.length > 1 && (
          <select
            value={activeBusinessId ?? ""}
            onChange={(e) => handleBusinessChange(e.target.value)}
            style={{
              marginTop: 14, width: "100%", fontSize: 12,
              padding: "10px 12px", borderRadius: 16,
              border: "1px solid var(--glass-border)",
              background: "var(--glass)", color: "var(--ink-2)",
              outline: "none",
            }}
          >
            {businesses.map((b) => (
              <option key={b.business_id} value={b.business_id}>
                {b.business_name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--glass-border)", margin: "0 14px 10px" }} />

      {/* Nav items */}
      <nav style={{ flex: 1, padding: "0 12px", display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
        {NAV_ITEMS.filter(({ key }) => canAccessView(role, key)).map(({ key, label, Icon, href }) => {
          const active = activeView === key;
          return (
            <button
              key={key}
              onClick={() => router.push(href)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "11px 12px", borderRadius: 16,
                border: active ? "1px solid var(--glass-border)" : "1px solid transparent",
                cursor: "pointer", width: "100%", textAlign: "left",
                background: active ? "var(--glass-strong)" : "transparent",
                color: active ? "var(--ink)" : "var(--ink-3)",
                fontSize: 14, fontWeight: active ? 600 : 400,
                transition: "background .16s var(--ease-ios), color .16s var(--ease-ios), transform .16s var(--ease-ios)",
                boxShadow: active ? "inset 0 1px 0 var(--glass-glow), var(--shadow-1)" : "none",
              }}
            >
              <span className="liquid-icon" style={{ width: 30, height: 30, borderRadius: 12, background: active ? "var(--green-tint)" : "var(--surface-2)", color: active ? "var(--green)" : "currentColor" }}>
                <Icon size={15} />
              </span>
              {label}
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--glass-border)", margin: "10px 14px 0" }} />

      {/* Bottom: appearance + WhatsApp status + logout */}
      <div style={{ padding: "14px 14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Apariencia — fila discreta: label + control compacto */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "2px 6px 4px" }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Apariencia</span>
          <ThemeToggle />
        </div>

        {/* WA status */}
        <div className="liquid-panel" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px" }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
            background: phone ? "var(--green)" : "var(--muted)",
          }} />
          <span style={{ flex: 1, fontSize: 12, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {phone ?? "Sin número"}
          </span>
          {phone && role === "owner" && (
            <button
              onClick={handleDisconnectWA}
              title="Desconectar WhatsApp"
            style={{ fontSize: 14, lineHeight: 1, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}
            >
              ×
            </button>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: "10px 11px", borderRadius: 15,
            border: "1px solid transparent", cursor: "pointer", width: "100%", textAlign: "left",
            background: "transparent", color: "var(--muted)", fontSize: 13,
          }}
        >
          <Logout size={14} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
