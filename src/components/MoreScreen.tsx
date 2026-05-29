"use client";

import { useRouter } from "next/navigation";
import { Users, QR, Cog, ArrowLeft, Calendar, BarChart } from "./atende/Icons";

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  sub: string;
  href: string;
}

export default function MoreScreen() {
  const router = useRouter();

  const items: MenuItem[] = [
    { icon: <Calendar size={18} />, label: "Turnos",        sub: "Agenda y reservas de tus clientes",       href: "/app/agenda" },
    { icon: <Users size={18} />, label: "Equipo",            sub: "Miembros, roles e invitaciones",        href: "/app/team" },
    { icon: <BarChart size={18} />, label: "Métricas",      sub: "Cómo viene respondiendo tu asistente",    href: "/app/stats" },
    { icon: <QR size={18} />,   label: "Conectar WhatsApp", sub: "Vincular o reconectar el número",        href: "/app/connect" },
    { icon: <Cog size={18} />,  label: "Mi Negocio",        sub: "Datos, descripción e instrucciones",     href: "/app/business" },
  ];

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <div className="page-header">
        <div>
          <div className="page-sub">Más opciones</div>
          <h1 className="page-title">Más</h1>
        </div>
      </div>

      <div style={{ padding: "8px 20px 100px", display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className="atd-card"
            style={{ padding: "16px", display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", cursor: "pointer", background: "var(--surface)" }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-2)", flexShrink: 0 }}>
              {item.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{item.label}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{item.sub}</div>
            </div>
            <ArrowLeft size={16} style={{ color: "var(--muted)", transform: "rotate(180deg)" }} />
          </button>
        ))}
      </div>
    </div>
  );
}
