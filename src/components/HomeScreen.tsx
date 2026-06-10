"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Spark, Arrow, Chat, Bolt, QR, Layers } from "./atende/Icons";
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
    let mounted = true;
    async function readJson(url: string) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 4500);
      try {
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        return res.ok ? await res.json() : null;
      } catch {
        return null;
      } finally {
        window.clearTimeout(timer);
      }
    }

    Promise.all([
      readJson("/api/plan"),
      readJson("/api/business"),
      readJson("/api/connection/status"),
      readJson("/api/business/items"),
      readJson("/api/conversations"),
      readJson("/api/team"),
    ]).then(([plan, biz, conn, items, convs, team]) => {
      if (!mounted) return;
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
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
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
    { key: "chats", label: "Chats", Icon: Chat, href: "/app/conversations" },
    { key: "catalog", label: "Catálogo", Icon: Bolt, href: "/app/catalog" },
  ];

  return (
    <div className="flex-1 overflow-y-auto pb-4" style={{ background: "var(--bg)" }}>
      {/* Top bar */}
      <div style={{ padding: "12px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="mono" style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>inicio</div>
          <div style={{ fontSize: 20, lineHeight: 1.15, fontWeight: 650, color: "var(--ink)" }}>
            {data.businessName}
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
      <section style={{ margin: "0 20px 12px", padding: 18, borderRadius: 20, background: data.waConnected ? "var(--green-tint)" : "var(--accent-soft)", color: data.waConnected ? "var(--green-ink)" : "var(--accent-ink)", border: "1px solid transparent" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
          <span className={`atd-dot ${data.waConnected ? "live" : ""}`} style={data.waConnected ? undefined : { background: "currentColor" }} />
          {data.waConnected ? "WhatsApp conectado" : "WhatsApp sin conectar"}
        </div>
        <div style={{ fontSize: 25, lineHeight: 1.08, fontWeight: 700, letterSpacing: 0, marginBottom: 6 }}>
          {data.waConnected ? "Tu asistente está atendiendo." : "Conectá WhatsApp para empezar."}
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.45, margin: "0 0 16px", opacity: 0.78 }}>
          {data.waConnected
            ? data.needsAttention > 0
              ? "Hay conversaciones esperando una respuesta humana."
              : `${data.todayConversations} ${data.todayConversations === 1 ? "conversación nueva" : "conversaciones nuevas"} hoy.`
            : "Vinculá el número del negocio y el asistente queda listo para responder."}
        </p>
        <button
          onClick={() => router.push(data.waConnected ? "/app/conversations" : "/app/connect")}
          className="atd-btn primary"
          style={{ height: 42, background: data.waConnected ? "var(--green-ink)" : "var(--accent-ink)", color: "var(--bg)" }}
        >
          {data.waConnected ? "Ver chats" : "Conectar ahora"}
        </button>
      </section>

      {/* Próxima acción recomendada */}
      <button
        onClick={() => router.push(recommended.href)}
        style={{
          margin: "0 20px 12px", padding: 14, borderRadius: 18, width: "calc(100% - 40px)",
          textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
          background: "var(--surface)", border: "1px solid var(--hairline)",
        }}
      >
        <span style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: data.needsAttention > 0 ? "var(--human-tint)" : "var(--surface-2)",
          color: data.needsAttention > 0 ? "var(--human)" : "var(--ink-2)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          {data.needsAttention > 0 ? <Chat size={18} /> : <Spark size={18} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 650, color: "var(--ink)" }}>{recommended.title}</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>{recommended.desc}</div>
        </div>
        <Arrow size={18} style={{ color: "var(--muted)", flexShrink: 0 }} />
      </button>

      {/* Progreso simple */}
      <section style={{ margin: "0 20px 12px", padding: 16, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--hairline)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 650, color: "var(--ink)" }}>Configuración</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
              {allDone ? "Todo listo" : `${doneCount} de ${totalSteps} pasos completos`}
            </div>
          </div>
          <strong style={{ fontSize: 18, color: "var(--green)" }}>{pct}%</strong>
        </div>
        <div style={{ height: 7, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "var(--green)" }} />
        </div>
        {!allDone && nextStep && (
          <button
            onClick={() => router.push(nextStep.href)}
            style={{ marginTop: 12, width: "100%", padding: "11px 0 0", border: 0, borderTop: "1px dashed var(--hairline-2)", background: "transparent", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}
          >
            <span style={{ width: 20, height: 20, borderRadius: 999, border: "1.5px solid var(--hairline-3)", flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink-2)" }}>{nextStep.label}</span>
            <Arrow size={16} style={{ color: "var(--muted)" }} />
          </button>
        )}
      </section>

      {/* Accesos rápidos */}
      <div style={{ padding: "0 20px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {quickActions.map(({ key, label, Icon, href }) => (
            <button
              key={key}
              onClick={() => router.push(href)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                padding: "11px 4px", borderRadius: 14, cursor: "pointer",
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

      <button
        onClick={() => router.push("/app/plan")}
        style={{ margin: "12px 20px 0", width: "calc(100% - 40px)", padding: "12px 14px", borderRadius: 16, background: "transparent", border: "1px solid var(--hairline)", color: "var(--ink-3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <Layers size={15} /> Plan {data.plan?.plan_name ?? ""}
        </span>
        <Arrow size={15} />
      </button>
    </div>
  );
}
