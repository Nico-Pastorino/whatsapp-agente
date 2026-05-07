"use client";

import { useEffect, useState } from "react";
import { Bell, Spark, Arrow } from "./atende/Icons";
import { Avatar } from "./atende/Icons";

interface PlanSummary {
  plan_code: string;
  plan_name: string;
  status: string;
  inbound_messages_count: number;
  ai_replies_count: number;
  product_limit: number | null;
}

interface HomeData {
  plan: PlanSummary | null;
  businessName: string;
  userName: string;
  waConnected: boolean;
  waPhone: string | null;
  productCount: number;
  pendingConversations: number;
  todayConversations: number;
}

const ONBOARDING = [
  { key: "connect",   label: "Conectá WhatsApp" },
  { key: "template",  label: "Elegí una plantilla" },
  { key: "products",  label: "Cargá productos" },
  { key: "test",      label: "Probá una conversación" },
  { key: "team",      label: "Invitá a tu equipo" },
];

export default function HomeScreen() {
  const [data, setData] = useState<HomeData>({
    plan: null,
    businessName: "",
    userName: "",
    waConnected: false,
    waPhone: null,
    productCount: 0,
    pendingConversations: 0,
    todayConversations: 0,
  });
  const [loading, setLoading] = useState(true);
  const [completedSteps] = useState<string[]>(["connect", "template", "products"]);

  useEffect(() => {
    Promise.all([
      fetch("/api/plan").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/business").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/connection/status").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/business/items").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/conversations").then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([plan, biz, conn, items, convs]) => {
      const conversations: Array<{ last_message_at?: number }> = Array.isArray(convs) ? convs : [];
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayTs = todayStart.getTime() / 1000;
      const todayConvs = conversations.filter(c => (c.last_message_at ?? 0) >= todayTs).length;

      setData({
        plan: plan ?? null,
        businessName: biz?.name ?? "Tu negocio",
        userName: "Vos",
        waConnected: conn?.status === "connected",
        waPhone: conn?.phone ?? null,
        productCount: items?.count ?? 0,
        pendingConversations: 0,
        todayConversations: todayConvs,
      });
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
        <div className="p-5 space-y-3">
          {[80, 180, 140].map((h, i) => (
            <div key={i} className="atd-card" style={{ height: h, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  const doneCount = completedSteps.length;
  const totalSteps = ONBOARDING.length;
  const pct = Math.round((doneCount / totalSteps) * 100);
  const circumference = 2 * Math.PI * 15;

  return (
    <div className="flex-1 overflow-y-auto pb-4" style={{ background: "var(--bg)" }}>
      {/* Top bar */}
      <div style={{ padding: "14px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>buen día,</div>
          <div className="serif" style={{ fontSize: 22, lineHeight: 1 }}>
            {data.businessName} 👋
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="atd-av" style={{ width: 36, height: 36 }}>
            <Bell size={16} />
          </div>
          <Avatar
            initials={data.businessName.slice(0, 2).toUpperCase()}
            size={36}
            bg="var(--green)"
            fg="var(--on-green)"
          />
        </div>
      </div>

      {/* Hero status card */}
      <div style={{ margin: "0 20px 14px", padding: 18, borderRadius: 22, background: "var(--ink)", color: "var(--bg)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "var(--accent)", opacity: 0.18, filter: "blur(20px)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
          <span className={`atd-dot ${data.waConnected ? "live" : ""}`} style={data.waConnected ? undefined : { background: "rgba(255,255,255,0.3)" }} />
          {data.waConnected ? `WhatsApp conectado · ${data.waPhone ?? ""}` : "WhatsApp desconectado"}
        </div>
        <div className="serif" style={{ fontSize: 28, lineHeight: 1.1, marginBottom: 4 }}>
          Tu asistente{" "}
          <span className="italic" style={{ color: "var(--accent)" }}>
            {data.waConnected ? "está activo." : "esperando."}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 16 }}>
          {data.todayConversations} chats hoy
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {[
            ["IA", data.waConnected ? "activa" : "inactiva"],
            ["Plan", data.plan?.plan_name ?? "—"],
            ["Productos", String(data.productCount)],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.07)" }}>
              <div className="mono" style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", textTransform: "uppercase" }}>{k}</div>
              <div style={{ fontSize: 13, fontWeight: 500, marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Onboarding checklist */}
      <div style={{ margin: "0 20px 14px", padding: 16, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--hairline)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Configurá tu negocio</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
              {doneCount} de {totalSteps} listo
            </div>
          </div>
          <div style={{ position: "relative", width: 40, height: 40 }}>
            <svg viewBox="0 0 36 36" width="40" height="40" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--hairline-2)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke="var(--accent)" strokeWidth="3"
                strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="mono" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>
              {pct}%
            </span>
          </div>
        </div>
        {ONBOARDING.map(({ key, label }, i) => {
          const done = completedSteps.includes(key);
          return (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i ? "1px dashed var(--hairline-2)" : "none" }}>
              <span style={{
                width: 18, height: 18, borderRadius: 999, flexShrink: 0,
                background: done ? "var(--green)" : "transparent",
                border: done ? "none" : "1.5px solid var(--hairline-3)",
                color: "var(--on-green)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>
                {done && (
                  <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M4 10.5L8 14l8-8" />
                  </svg>
                )}
              </span>
              <span style={{ fontSize: 13.5, flex: 1, color: done ? "var(--muted)" : "var(--ink)", textDecoration: done ? "line-through" : "none" }}>
                {label}
              </span>
              {!done && <Arrow size={16} style={{ color: "var(--muted)" }} />}
            </div>
          );
        })}
      </div>

      {/* Quick stats */}
      <div style={{ padding: "0 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          {
            k: "Productos",
            v: data.productCount > 0 ? `${data.productCount} / ${data.plan?.product_limit ?? "∞"}` : "0",
            s: data.plan ? `Plan ${data.plan.plan_name}` : "Sin plan",
            accent: false,
          },
          {
            k: "Mensajes IA",
            v: String(data.plan?.ai_replies_count ?? 0),
            s: "Este mes",
            accent: true,
          },
        ].map((stat) => (
          <div
            key={stat.k}
            style={{
              padding: 14, borderRadius: 16,
              background: stat.accent ? "var(--accent)" : "var(--surface)",
              color: stat.accent ? "var(--on-accent)" : "var(--ink)",
              border: "1px solid var(--hairline)",
            }}
          >
            <div className="mono" style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase" }}>{stat.k}</div>
            <div className="serif" style={{ fontSize: 28, lineHeight: 1, marginTop: 6 }}>{stat.v}</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{stat.s}</div>
          </div>
        ))}
      </div>

      {/* IA status promo if disconnected */}
      {!data.waConnected && (
        <div style={{ margin: "14px 20px 0", padding: 16, borderRadius: 18, background: "var(--accent-soft)", border: "1px solid transparent" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: 10, background: "var(--accent)", color: "var(--on-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Spark size={16} />
            </span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--accent-ink)" }}>Conectá WhatsApp</div>
              <div style={{ fontSize: 12, color: "var(--accent-ink)", opacity: 0.8, marginTop: 2 }}>
                Tu asistente está listo — solo falta vincular el número del negocio.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
