"use client";

import { useRouter } from "next/navigation";
import { Users, QR, ArrowLeft, Calendar, BarChart, LifeBuoy, Moon, Logout } from "./atende/Icons";
import ThemeToggle from "./ThemeToggle";
import { canAccessView, type DashboardRole, type DashboardView } from "@/lib/role-access";

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  sub: string;
  href: string;
  view: DashboardView;
}

function RowIcon({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 36, height: 36, borderRadius: 12, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-2)", flexShrink: 0 }}>
      {children}
    </div>
  );
}

export default function MoreScreen({ role = "owner" }: { role?: DashboardRole }) {
  const router = useRouter();

  // Mismo criterio que la sidebar: cada item declara su vista y se filtra por rol.
  const allItems: MenuItem[] = [
    { icon: <QR size={18} />,   label: "WhatsApp", sub: "Vincular número",        href: "/app/connect", view: "connect" },
    { icon: <Calendar size={18} />, label: "Turnos", sub: "Reservas pendientes",    href: "/app/agenda", view: "agenda" },
    { icon: <Users size={18} />, label: "Equipo",            sub: "Personas y permisos",        href: "/app/team", view: "team" },
    { icon: <BarChart size={18} />, label: "Métricas",      sub: "Resultados del asistente",    href: "/app/stats", view: "stats" },
    { icon: <LifeBuoy size={18} />, label: "Soporte", sub: "Ayuda por WhatsApp o correo", href: "/app/support", view: "support" },
  ];
  const items = allItems.filter((item) => canAccessView(role, item.view));

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <div style={{ padding: "14px 20px 110px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="page-header">
          <div>
            <div className="page-sub">ajustes</div>
            <h1 className="page-title">Más opciones</h1>
          </div>
        </div>

        {/* Accesos */}
        <section className="atd-card" style={{ background: "var(--surface)", overflow: "hidden" }}>
          {items.map((item, index) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              style={{
                padding: "13px 14px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                background: "transparent",
                border: 0,
                borderTop: index ? "1px solid var(--hairline)" : "none",
              }}
            >
              <RowIcon>{item.icon}</RowIcon>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 650, color: "var(--ink)" }}>{item.label}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.sub}</div>
              </div>
              <ArrowLeft size={16} style={{ color: "var(--muted)", transform: "rotate(180deg)", flexShrink: 0 }} />
            </button>
          ))}

          {/* Apariencia — fila discreta con control compacto, sin sección propia */}
          <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, borderTop: "1px solid var(--hairline)" }}>
            <RowIcon><Moon size={17} /></RowIcon>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 650, color: "var(--ink)" }}>Apariencia</div>
            </div>
            <ThemeToggle />
          </div>
        </section>

        {/* Cerrar sesión — única vía de logout en mobile (el sidebar es desktop-only) */}
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
            router.push("/login");
            router.refresh();
          }}
          className="atd-card"
          style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", cursor: "pointer", background: "var(--surface)" }}
        >
          <RowIcon><Logout size={17} /></RowIcon>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 650, color: "var(--ink-2)" }}>Cerrar sesión</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Salir de tu cuenta en este dispositivo</div>
          </div>
        </button>
      </div>
    </div>
  );
}
