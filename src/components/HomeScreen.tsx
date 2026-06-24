"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Arrow } from "./atende/Icons";
import { Avatar } from "./atende/Icons";
import OnboardingWizard from "./OnboardingWizard";
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

// Valor generado por el asistente (datos reales de /api/stats). Sólo owner/admin
// reciben respuesta; si viene null (operador o sin acceso) no se muestra la tarjeta.
interface ValueData {
  aiRepliesMonth: number;
  weekConversations: number;
  weeklyTrendPct: number | null;
  avgResponseSec: number | null;
}

// Chats que requieren intervención humana (preview accionable en Inicio).
interface PendingChat {
  id: string;
  name: string;
  preview: string;
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
  const [value, setValue] = useState<ValueData | null>(null);
  const [pendingChats, setPendingChats] = useState<PendingChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

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
      readJson("/api/stats"),
    ]).then(([plan, biz, conn, items, convs, team, stats]) => {
      if (!mounted) return;
      const conversations: Array<{ id?: string; name?: string; last_message_at?: number; needs_attention?: boolean; mode?: string; last_message_preview?: string }> =
        Array.isArray(convs) ? convs : [];

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayTs = todayStart.getTime() / 1000;
      const todayConvs = conversations.filter((c) => (c.last_message_at ?? 0) >= todayTs).length;
      const attentionConvs = conversations
        .filter((c) => c.needs_attention && c.mode !== "AI")
        .sort((a, b) => (b.last_message_at ?? 0) - (a.last_message_at ?? 0));
      const needsAttention = attentionConvs.length;
      setPendingChats(
        attentionConvs.slice(0, 3).map((c) => ({
          id: c.id ?? "",
          name: (c.name ?? "").trim() || "Cliente sin nombre",
          preview: (c.last_message_preview ?? "").trim(),
        }))
      );

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

      // Tarjeta de valor: sólo si /api/stats respondió (owner/admin con acceso)
      // y hay algo de actividad real que mostrar. Datos 100% reales, sin inventar.
      if (stats && typeof stats === "object") {
        const aiReplies = Number(stats.ai_replies_this_month ?? 0);
        const weekConvs = Number(stats.this_week_conversations ?? 0);
        if (aiReplies > 0 || weekConvs > 0) {
          setValue({
            aiRepliesMonth: aiReplies,
            weekConversations: weekConvs,
            weeklyTrendPct:
              typeof stats.weekly_trend_pct === "number" ? stats.weekly_trend_pct : null,
            avgResponseSec:
              typeof stats.avg_ai_response_sec === "number" ? stats.avg_ai_response_sec : null,
          });
        }
      }

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

  // Acción primaria contextual de Inicio: "lo más importante ahora" según el
  // estado del negocio. Se muestra como un botón GRANDE y etiquetado en el hero
  // (visible y descubrible), no como un gesto oculto.
  const primaryAction = !data.waConnected
    ? { label: "Conectar WhatsApp", go: () => router.push("/app/connect") }
    : data.needsAttention > 0
    ? {
        label: `Atender ${data.needsAttention} ${data.needsAttention === 1 ? "chat" : "chats"}`,
        go: () => router.push("/app/conversations"),
      }
    : data.productCount === 0
    ? { label: "Configurá tu asistente", go: () => setShowWizard(true) }
    : { label: "Probar el asistente", go: () => router.push("/app/business#probar-asistente") };

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

        {/* Alerta fuerte: el negocio YA operó (tiene historial) pero WhatsApp está
            desconectado → no está atendiendo y puede estar perdiendo mensajes.
            Distinto del onboarding de un usuario nuevo (sin historial). */}
        {!loading && !data.waConnected && data.totalConversations > 0 && (
          <button
            type="button"
            onClick={() => router.push("/app/connect")}
            className="liquid-card"
            style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, cursor: "pointer", textAlign: "left", width: "100%", border: "1px solid var(--danger)", background: "var(--danger-tint, rgba(192,57,43,0.08))" }}
          >
            <span style={{ fontSize: 24, flexShrink: 0 }}>⚠️</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 15, fontWeight: 720, color: "var(--danger-ink, var(--danger))" }}>
                Tu WhatsApp está desconectado
              </span>
              <span style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>
                El asistente no está respondiendo y podés estar perdiendo mensajes de clientes. Reconectá ahora.
              </span>
            </span>
            <span className="liquid-action accent" style={{ flexShrink: 0 }}>Reconectar</span>
          </button>
        )}

        {!loading && data.productCount === 0 && (
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="liquid-card"
            style={{ display: "flex", alignItems: "center", gap: 14, padding: 18, cursor: "pointer", textAlign: "left", border: "1px solid var(--green)", width: "100%" }}
          >
            <span style={{ fontSize: 26, flexShrink: 0 }}>✨</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 15.5, fontWeight: 700, color: "var(--ink)" }}>Configurá tu asistente en 3 pasos</span>
              <span style={{ display: "block", fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>Elegí tu rubro, cargá un producto y listo. Te dejamos reglas de ejemplo para editar.</span>
            </span>
            <Arrow size={18} />
          </button>
        )}

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
                onClick={primaryAction.go}
                className={`liquid-action ${data.waConnected && data.needsAttention === 0 ? "primary" : "accent"}`}
                style={{ width: "fit-content" }}
              >
                {primaryAction.label}
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
            {/* Los 4 pasos completos (antes sólo se mostraba el próximo y quedaba
                un hueco vacío). De un vistazo se ve qué falta y qué ya está. */}
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {steps.map((step) => (
                <button
                  key={step.key}
                  onClick={() => router.push(step.href)}
                  className="liquid-panel"
                  style={{ width: "100%", padding: 12, border: "1px solid var(--glass-border)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", color: "var(--ink)", opacity: step.done ? 0.62 : 1 }}
                >
                  {step.done ? (
                    <span style={{ width: 22, height: 22, borderRadius: 999, background: "var(--green)", color: "var(--on-green)", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>✓</span>
                  ) : (
                    <span style={{ width: 22, height: 22, borderRadius: 999, border: "1.5px solid var(--green)", flexShrink: 0 }} />
                  )}
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 650, textDecoration: step.done ? "line-through" : "none" }}>{step.label}</span>
                  {!step.done && <Arrow size={16} style={{ color: "var(--muted)" }} />}
                </button>
              ))}
            </div>
          </section>
        </div>

        {data.waConnected && value && (
          <button
            onClick={() => router.push("/app/stats")}
            className="liquid-card"
            style={{ padding: 20, textAlign: "left", cursor: "pointer", color: "var(--ink)", border: "1px solid var(--green)", width: "100%" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 18 }}>💪</span>
              <span style={{ fontSize: 14, fontWeight: 720, color: "var(--ink)" }}>Lo que hizo tu asistente</span>
              <Arrow size={15} style={{ color: "var(--muted)", marginLeft: "auto" }} />
            </div>
            <div className="liquid-grid cols-3" style={{ gap: 12 }}>
              <div>
                <div className="serif" style={{ fontSize: 32, lineHeight: 0.95, color: "var(--green)" }}>{value.aiRepliesMonth}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>respuestas automáticas este mes</div>
              </div>
              <div>
                <div className="serif" style={{ fontSize: 32, lineHeight: 0.95 }}>{value.weekConversations}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>
                  conversaciones esta semana
                  {value.weeklyTrendPct !== null && value.weeklyTrendPct !== 0 && (
                    <span style={{ color: value.weeklyTrendPct > 0 ? "var(--green)" : "var(--ink-3)", fontWeight: 600 }}>
                      {" "}{value.weeklyTrendPct > 0 ? "↑" : "↓"}{Math.abs(value.weeklyTrendPct)}%
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="serif" style={{ fontSize: 32, lineHeight: 0.95 }}>
                  {value.avgResponseSec !== null
                    ? value.avgResponseSec < 60
                      ? `${value.avgResponseSec}s`
                      : `${Math.round(value.avgResponseSec / 60)}m`
                    : "—"}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>tiempo de respuesta promedio</div>
              </div>
            </div>
          </button>
        )}

        {/* Preview accionable: chats que requieren intervención humana. */}
        {pendingChats.length > 0 && (
          <section className="liquid-card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--accent)", flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 720, color: "var(--ink)" }}>Chats que necesitan tu atención</span>
              <span className="atd-badge" style={{ marginLeft: "auto" }}>{data.needsAttention}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => router.push(`/app/conversations?c=${chat.id}`)}
                  className="liquid-panel"
                  style={{ width: "100%", padding: 12, border: "1px solid var(--glass-border)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", color: "var(--ink)" }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 650, color: "var(--ink)" }}>{chat.name}</span>
                    {chat.preview && (
                      <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-3)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{chat.preview}</span>
                    )}
                  </span>
                  <Arrow size={16} style={{ color: "var(--muted)", flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Accesos rápidos a las 2 acciones más comunes. */}
        <div className="liquid-grid cols-2" style={{ gap: 12 }}>
          <button
            onClick={() => router.push("/app/business#probar-asistente")}
            className="liquid-card"
            style={{ padding: 18, textAlign: "left", cursor: "pointer", color: "var(--ink)", border: "1px solid var(--glass-border)", display: "flex", alignItems: "center", gap: 12 }}
          >
            <span style={{ fontSize: 22, flexShrink: 0 }}>✨</span>
            <span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>Probar el asistente</span>
          </button>
          <button
            onClick={() => router.push("/app/catalog")}
            className="liquid-card"
            style={{ padding: 18, textAlign: "left", cursor: "pointer", color: "var(--ink)", border: "1px solid var(--glass-border)", display: "flex", alignItems: "center", gap: 12 }}
          >
            <span style={{ fontSize: 22, flexShrink: 0 }}>📦</span>
            <span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>Agregar producto</span>
          </button>
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

      {showWizard && <OnboardingWizard onClose={() => setShowWizard(false)} />}
    </div>
  );
}
