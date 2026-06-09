"use client";

import { useRouter } from "next/navigation";
import { Users, QR, ArrowLeft, Calendar, BarChart, LifeBuoy } from "./atende/Icons";
import ThemeToggle from "./ThemeToggle";

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  sub: string;
  href: string;
}

export default function MoreScreen() {
  const router = useRouter();

  const items: MenuItem[] = [
    { icon: <QR size={18} />,   label: "Conectar WhatsApp", sub: "Vincular o reconectar el número",        href: "/app/connect" },
    { icon: <Calendar size={18} />, label: "Reservas / Turnos", sub: "Solicitudes de reservas y turnos",    href: "/app/agenda" },
    { icon: <Users size={18} />, label: "Equipo",            sub: "Miembros, roles e invitaciones",        href: "/app/team" },
    { icon: <BarChart size={18} />, label: "Métricas",      sub: "Cómo viene respondiendo tu asistente",    href: "/app/stats" },
    { icon: <LifeBuoy size={18} />, label: "Ayuda y soporte", sub: "Hablá con nosotros por WhatsApp o correo", href: "/app/support" },
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
        {/* Apariencia */}
        <div className="atd-card" style={{ padding: 16, background: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>🎨</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>Apariencia</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>Elegí cómo se ve la app</div>
            </div>
          </div>
          <ThemeToggle />
        </div>

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
