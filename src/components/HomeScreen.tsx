"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Spark, Arrow, Chat, Shop, Bolt, QR, Layers } from "./atende/Icons";
import { Avatar } from "./atende/Icons";
import {
  buildAssistantChecklist,
  assistantProgress,
  type AssistantProfileLike,
} from "@/lib/onboarding";

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
  waConnected: boolean;
  waPhone: string | null;
  productCount: number;
  assistantPct: number;
  needsAttention: number;
  todayConversations: number;
  totalConversations: number;
  teamCount: number;
}

interface ActivationStep {
  key: string;
  label: string;
  done: boolean;
  href: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const [data, setData] = useState<HomeData>({
    plan: null,
    businessName: "",
    waConnected: false,
    waPhone: null,
    productCount: 0,
    assistantPct: 0,
    needsAttention: 0,
    todayConversations: 0,
    totalConversations: 0,
    teamCount: 1,
  });
  const [steps, setSteps] = useState<ActivationStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/plan").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/business").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/connection/status").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/business/items").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/conversations").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/team").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([plan, biz, conn, items, convs, team]) => {
      const conversations: Array<{ last_message_at?: number; needs_attention?: boolean; mode?: string }> =
        Array.isArray(convs) ? convs : [];

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayTs = todayStart.getTime() / 1000;
      const todayConvs = conversations.filter((c) => (c.last_message_at ?? 0) >= todayTs).length;
      const needsAttention = conversations.filter(
        (c) => c.needs_attention && c.mode !== "AI"
      ).length;

      const isConnected = conn?.status === "connected";
      const productCount = items?.count ?? items?.items?.length ?? 0;

      // Checklist de entrenamiento unificado (misma fuente que "Mi negocio").
      const profileLike: AssistantProfileLike = {
        name: biz?.name,
        description: biz?.description,
        extra: biz?.extra,
        knowledge_base: biz?.knowledge_base,
        response_tone: biz?.response_tone,
        notify_enabled: biz?.notify_enabled,
        notify_phone: biz?.notify_phone,
      };
      const assistantChecklist = buildAssistantChecklist(profileLike, productCount);
      const assistantPct = assistantProgress(assistantChecklist);

      // Conteo de equipo (defensivo ante distintos formatos de respuesta).
      const teamArray = Array.isArray(team)
        ? team
        : Array.isArray(team?.members)
        ? team.members
        : Array.isArray(team?.team)
        ? team.team
        : [];
      const teamCount = Math.max(1, teamArray.length);

      // Pasos de activación de alto nivel (Centro de control).
      const activation: ActivationStep[] = [
        { key: "connect", label: "Conectá tu WhatsApp", done: isConnected, href: "/app/connect" },
        { key: "train", label: "Entrená tu asistente", done: assistantPct >= 100, href: "/app/business" },
        { key: "products", label: "Cargá tus productos o servicios", done: productCount > 0, href: "/app/catalog" },
        { key: "test", label: "Probá cómo responde", done: conversations.length > 0, href: "/app/business#probar-asistente" },
        { key: "team", label: "Invitá a tu equipo", done: teamCount > 1, href: "/app/team" },
      ];
      setSteps(activation);

      setData({
        plan: plan ?? null,
        businessName: biz?.name?.trim() || "Tu negocio",
        waConnected: isConnected,
        waPhone: conn?.phone ?? null,
        productCount,
        assistantPct,
        needsAttention,
        todayConversations: todayConvs,
        totalConversations: conversations.length,
        teamCount,
      });
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
        <div className="p-5 space-y-3">
          {[80, 180, 150].map((h, i) => (
            <div key={i} className="atd-card" style={{ height: h, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  const doneCount = steps.filter((s) => s.done).length;
  const totalSteps = steps.length;
  const pct = totalSteps ? Math.round((doneCount / totalSteps) * 100) : 0;
  const circumference = 2 * Math.PI * 15;
  const nextStep = steps.find((s) => !s.done) ?? null;
  const allDone = doneCount === totalSteps;

  // Próxima acción recomendada: priorizar conversaciones que esperan respuesta.
  const recommended =
    data.needsAttention > 0
      ? {
          title: `${data.needsAttention} ${data.needsAttention === 1 ? "conversación necesita" : "conversaciones necesitan"} atención`,
          desc: "Un cliente quedó esperando respuesta de una persona.",
          cta: "Ver conversaciones",
          href: "/app/conversations",
        }
      : nextStep
      ? {
          title: nextStep.label,
          desc: "Es el próximo paso para dejar tu asistente listo para vender.",
          cta: "Continuar",
          href: nextStep.href,
        }
      : {
          title: "Tu asistente está listo",
          desc: "Revisá tus conversaciones y ajustá el entrenamiento cuando quieras.",
          cta: "Ver conversaciones",
          href: "/app/conversations",
        };

  const quickActions: Array<{ key: string; label: string; Icon: React.ComponentType<{ size?: number }>; href: string }> = [
    { key: "connect", label: data.waConnected ? "WhatsApp" : "Conectar", Icon: QR, href: "/app/connect" },
    { key: "train", label: "Entrenar", Icon: Spark, href: "/app/business" },
    { key: "catalog", label: "Productos", Icon: Bolt, href: "/app/catalog" },
    { key: "chats", label: "Chats", Icon: Chat, href: "/app/conversations" },
    { key: "plan", label: "Mejorar plan", Icon: Layers, href: "/app/plan" },
  ];

  return (
    <div className="flex-1 overflow-y-auto pb-4" style={{ background: "var(--bg)" }}>
      {/* Top bar */}
      <div style={{ padding: "14px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>centro de control</div>
          <div className="serif" style={{ fontSize: 22, lineHeight: 1 }}>
            {data.businessName} 👋
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => router.push("/app/conversations")}
            className="atd-av"
            style={{ width: 36, height: 36, position: "relative", cursor: "pointer", border: "1px solid var(--hairline)" }}
            aria-label="Conversaciones"
          >
            <Bell size={16} />
            {data.needsAttention > 0 && (
              <span style={{ position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: "var(--human)", color: "#fff", fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                {data.needsAttention}
              </span>
            )}
          </button>
          <Avatar
            initials={data.businessName.slice(0, 2).toUpperCase()}
            size={36}
            bg="var(--green)"
            fg="var(--on-green)"
          />
        </div>
      </div>

      {/* Hero status card */}
      <div style={{ margin: "0 20px 14px", padding: 18, borderRadius: 22, background: "var(--feature-bg)", color: "var(--feature-fg)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "var(--accent)", opacity: 0.18, filter: "blur(20px)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--feature-fg-dim)", marginBottom: 8 }}>
          <span className={`atd-dot ${data.waConnected ? "live" : ""}`} style={data.waConnected ? undefined : { background: "var(--feature-fg-dim)" }} />
          {data.waConnected ? `WhatsApp conectado · ${data.waPhone ?? ""}` : "WhatsApp sin conectar"}
        </div>
        <div className="serif" style={{ fontSize: 28, lineHeight: 1.1, marginBottom: 4 }}>
          Tu asistente{" "}
          <span className="italic" style={{ color: "var(--accent)" }}>
            {data.waConnected ? "está activo." : "esperando."}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "var(--feature-fg-dim)", marginBottom: 16 }}>
          {data.waConnected
            ? `${data.todayConversations} ${data.todayConversations === 1 ? "conversación hoy" : "conversaciones hoy"}`
            : "Conectá WhatsApp para que empiece a responder."}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {[
            ["IA", data.waConnected ? "activa" : "en pausa"],
            ["Plan", data.plan?.plan_name ?? "—"],
            ["Entrenado", `${data.assistantPct}%`],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: 10, borderRadius: 12, background: "var(--feature-bg-soft)" }}>
              <div className="mono" style={{ fontSize: 9, color: "var(--feature-fg-dim)", textTransform: "uppercase" }}>{k}</div>
              <div style={{ fontSize: 13, fontWeight: 500, marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Próxima acción recomendada */}
      <button
        onClick={() => router.push(recommended.href)}
        style={{
          margin: "0 20px 14px", padding: 16, borderRadius: 18, width: "calc(100% - 40px)",
          textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
          background: data.needsAttention > 0 ? "var(--human-tint)" : "var(--accent-soft)",
          border: "1px solid transparent",
        }}
      >
        <span style={{
          width: 38, height: 38, borderRadius: 12, flexShrink: 0,
          background: data.needsAttention > 0 ? "var(--human)" : "var(--accent)",
          color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          {data.needsAttention > 0 ? <Chat size={18} /> : <Spark size={18} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", marginBottom: 2 }}>
            próxima acción
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>{recommended.title}</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{recommended.desc}</div>
        </div>
        <Arrow size={18} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
      </button>

      {/* Accesos rápidos */}
      <div style={{ padding: "0 20px 14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {quickActions.map(({ key, label, Icon, href }) => (
            <button
              key={key}
              onClick={() => router.push(href)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                padding: "12px 4px", borderRadius: 14, cursor: "pointer",
                background: "var(--surface)", border: "1px solid var(--hairline)",
              }}
            >
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "var(--surface-2)", color: "var(--ink-2)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={16} />
              </span>
              <span style={{ fontSize: 10.5, color: "var(--ink-2)", textAlign: "center", lineHeight: 1.2 }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Checklist de activación */}
      <div style={{ margin: "0 20px 14px", padding: 16, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--hairline)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Dejá tu asistente listo</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
              {allDone ? "todo listo 🎉" : `${doneCount} de ${totalSteps} completados`}
            </div>
          </div>
          <div style={{ position: "relative", width: 40, height: 40 }}>
            <svg viewBox="0 0 36 36" width="40" height="40" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--hairline-2)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke="var(--green)" strokeWidth="3"
                strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="mono" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>
              {pct}%
            </span>
          </div>
        </div>
        {steps.map((step, i) => (
          <button
            key={step.key}
            onClick={() => router.push(step.href)}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 0", width: "100%",
              textAlign: "left", background: "none", border: "none", cursor: "pointer",
              borderTop: i ? "1px dashed var(--hairline-2)" : "none",
            }}
          >
            <span style={{
              width: 18, height: 18, borderRadius: 999, flexShrink: 0,
              background: step.done ? "var(--green)" : "transparent",
              border: step.done ? "none" : "1.5px solid var(--hairline-3)",
              color: "var(--on-green)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              {step.done && (
                <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M4 10.5L8 14l8-8" />
                </svg>
              )}
            </span>
            <span style={{ fontSize: 13.5, flex: 1, color: step.done ? "var(--muted)" : "var(--ink)", textDecoration: step.done ? "line-through" : "none" }}>
              {step.label}
            </span>
            {!step.done && <Arrow size={16} style={{ color: "var(--muted)" }} />}
          </button>
        ))}
      </div>

      {/* Resumen de actividad */}
      <div style={{ padding: "0 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button
          onClick={() => router.push("/app/conversations")}
          style={{ padding: 14, borderRadius: 16, textAlign: "left", cursor: "pointer", background: "var(--surface)", border: "1px solid var(--hairline)" }}
        >
          <div className="mono" style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase" }}>Conversaciones</div>
          <div className="serif" style={{ fontSize: 28, lineHeight: 1, marginTop: 6 }}>{data.totalConversations}</div>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
            {data.todayConversations} hoy
          </div>
        </button>
        <button
          onClick={() => router.push("/app/catalog")}
          style={{ padding: 14, borderRadius: 16, textAlign: "left", cursor: "pointer", background: "var(--surface)", border: "1px solid var(--hairline)" }}
        >
          <div className="mono" style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase" }}>Productos</div>
          <div className="serif" style={{ fontSize: 28, lineHeight: 1, marginTop: 6 }}>
            {data.productCount > 0 ? data.productCount : "0"}
            {data.plan?.product_limit ? <span style={{ fontSize: 14, color: "var(--muted)" }}> / {data.plan.product_limit}</span> : null}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
            {data.productCount > 0 ? "en tu catálogo" : "Agregá los primeros"}
          </div>
        </button>
      </div>

      {/* Promo conectar si está desconectado */}
      {!data.waConnected && (
        <button
          onClick={() => router.push("/app/connect")}
          style={{ margin: "14px 20px 0", padding: 16, borderRadius: 18, width: "calc(100% - 40px)", textAlign: "left", cursor: "pointer", background: "var(--green-tint)", border: "1px solid transparent", display: "flex", alignItems: "flex-start", gap: 10 }}
        >
          <span style={{ width: 32, height: 32, borderRadius: 10, background: "var(--green)", color: "var(--on-green)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Shop size={16} />
          </span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--green-ink)" }}>Conectá WhatsApp</div>
            <div style={{ fontSize: 12, color: "var(--green-ink)", opacity: 0.8, marginTop: 2 }}>
              Tu asistente está listo — solo falta vincular el número del negocio.
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
