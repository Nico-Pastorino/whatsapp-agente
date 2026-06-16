"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Arrow } from "./atende/Icons";
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
        { key: "products", label: "Cargá tus productos o servicios", done: productCount > 0, href: "/app/catalog" },
        { key: "train", label: "Completá los datos de tu negocio", done: assistantPct >= 100, href: "/app/business" },
        { key: "test", label: "Probá cómo responde", done: conversations.length > 0, href: "/app/business#probar-asistente" },
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
      <div className="liquid-scroll">
        <div className="liquid-container" style={{ display: "grid", gap: 14 }}>
          {[80, 180, 150].map((h, i) => (
            <div key={i} className="liquid-card" style={{ height: h, animation: "pulse 1.5s ease-in-out infinite" }} />
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

  return (
    <div className="liquid-scroll">
      <div className="liquid-container liquid-enter" style={{ display: "grid", gap: 16 }}>
        <header className="page-header">
          <div>
            <div className="page-sub">tu negocio</div>
            <h1 className="page-title">{data.businessName}</h1>
          </div>
          <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
            <button
              onClick={() => router.push("/app/conversations")}
              className="liquid-icon"
              style={{ position: "relative", cursor: "pointer", border: "1px solid var(--glass-border)" }}
              aria-label="Conversaciones"
            >
              <Bell size={17} />
              {data.needsAttention > 0 && (
                <span className="atd-badge" style={{ position: "absolute", top: -5, right: -5 }}>
                  {data.needsAttention}
                </span>
              )}
            </button>
            <Avatar
              initials={data.businessName.slice(0, 2).toUpperCase()}
              size={42}
              bg="linear-gradient(135deg, var(--green), var(--accent))"
              fg="var(--on-green)"
            />
          </div>
        </header>

        <div className="home-overview-grid">
          <section className="liquid-card" style={{ padding: 26, minHeight: 250, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: data.waConnected ? "var(--green)" : "var(--accent)", marginBottom: 16 }}>
              <span className={`atd-dot ${data.waConnected ? "live" : ""}`} style={data.waConnected ? undefined : { background: "currentColor" }} />
              {data.waConnected ? "WhatsApp conectado" : "Próxima acción"}
            </div>
            <div style={{ display: "grid", gap: 22, alignItems: "end" }}>
              <div>
                <h2 style={{ fontSize: "clamp(34px, 4.4vw, 68px)", lineHeight: 0.95, fontWeight: 760, letterSpacing: 0, margin: 0, color: "var(--ink)", maxWidth: 760 }}>
                  {data.waConnected ? "Tu asistente está atendiendo." : "Conectá WhatsApp para empezar."}
                </h2>
                <p style={{ fontSize: 15, lineHeight: 1.6, margin: "16px 0 0", color: "var(--ink-3)", maxWidth: 680 }}>
                  {data.waConnected
                    ? data.needsAttention > 0
                      ? "Hay conversaciones esperando una respuesta humana. Entrá al inbox y tomá las importantes."
                      : `${data.todayConversations} ${data.todayConversations === 1 ? "conversación nueva" : "conversaciones nuevas"} hoy. Todo sigue simple desde un solo lugar.`
                    : "Vinculá el número del negocio y dejá Atendé listo para responder, tomar datos y derivarte chats cuando haga falta."}
                </p>
              </div>
              <button
                onClick={() => router.push(data.waConnected ? "/app/conversations" : "/app/connect")}
                className={`liquid-action ${data.waConnected ? "primary" : "accent"}`}
                style={{ width: "fit-content" }}
              >
                {data.waConnected ? "Abrir inbox" : "Conectar ahora"}
              </button>
            </div>
          </section>

          <section className="liquid-card" style={{ padding: 20, minHeight: 250, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 720, color: "var(--ink)" }}>Dejá Atendé listo</h3>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "3px 0 0" }}>
                  {allDone ? "Configuración completa" : `${doneCount} de ${totalSteps} pasos completados`}
                </p>
              </div>
              <strong className="mono" style={{ fontSize: 20, color: "var(--green)" }}>{pct}%</strong>
            </div>
            <div style={{ height: 9, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden", border: "1px solid var(--glass-border)" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, var(--green), var(--green-soft))", transition: "width .35s var(--ease-ios)" }} />
            </div>
            {!allDone && nextStep && (
              <button
                onClick={() => router.push(nextStep.href)}
                className="liquid-panel"
                style={{ marginTop: 14, width: "100%", padding: 13, border: "1px solid var(--glass-border)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", color: "var(--ink)" }}
              >
                <span style={{ width: 22, height: 22, borderRadius: 999, border: "1.5px solid var(--green)", flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 650 }}>{nextStep.label}</span>
                <Arrow size={16} style={{ color: "var(--muted)" }} />
              </button>
            )}
          </section>
        </div>

        <div className="liquid-grid cols-3">
          {[
            { label: "Conversaciones", value: data.totalConversations, meta: `${data.todayConversations} hoy`, href: "/app/conversations" },
            { label: "Catálogo", value: data.productCount, meta: data.plan?.product_limit ? `de ${data.plan.product_limit}` : "productos", href: "/app/catalog" },
            { label: "Equipo", value: data.teamCount, meta: data.teamCount > 1 ? "miembros" : "solo vos", href: "/app/team" },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className="liquid-card"
              style={{ padding: 17, textAlign: "left", cursor: "pointer", color: "var(--ink)", border: "1px solid var(--glass-border)" }}
            >
              <div className="page-sub" style={{ marginBottom: 8 }}>{item.label}</div>
              <div className="serif" style={{ fontSize: 36, lineHeight: 0.95 }}>{item.value}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 8 }}>{item.meta}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
