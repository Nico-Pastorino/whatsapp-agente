"use client";

import { useEffect, useState } from "react";
import DashboardContentShell from "./DashboardContentShell";
import { Spark } from "./atende/Icons";

interface DailyPoint {
  date: string;
  count: number;
}

interface RecentConv {
  id: string;
  name: string;
  mode: "AI" | "HUMAN";
  needs_attention: boolean;
  last_message_at: number | null;
}

interface StatsData {
  total_conversations: number;
  ai_conversations: number;
  human_conversations: number;
  handoff_rate: number;
  active_today: number;
  this_week_conversations: number;
  last_week_conversations: number;
  weekly_trend_pct: number | null;
  avg_ai_response_sec: number | null;
  inbound_messages_this_month: number;
  ai_replies_this_month: number;
  human_messages_this_month: number;
  daily_activity: DailyPoint[];
  recent_conversations: RecentConv[];
}

function formatTime(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("es-AR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function formatResponseTime(sec: number | null): string {
  if (sec === null) return "—";
  if (sec < 60) return `${sec}s`;
  return `${Math.round(sec / 60)}m`;
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon, accent,
}: {
  label: string;
  value: number | string;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="atd-card" style={{
      padding: "14px", display: "flex", flexDirection: "column", gap: 3,
      ...(accent ? { border: "1px solid var(--green)", background: "var(--green-tint)" } : {}),
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 11 }}>
        {icon}
        <span className="mono" style={{ textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1, color: "var(--ink)", marginTop: 4 }}>
        {typeof value === "number" ? value.toLocaleString("es-AR") : value}
      </div>
      {sub && <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Trend badge ──────────────────────────────────────────────────────────────
function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ fontSize: 12, color: "var(--muted)" }}>sin datos sem. anterior</span>;
  const up = pct >= 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 12, fontWeight: 600,
      color: up ? "var(--green-soft)" : "#c0392b",
    }}>
      {up ? "↑" : "↓"} {Math.abs(pct)}% vs semana anterior
    </span>
  );
}

// ── Mini bar chart ───────────────────────────────────────────────────────────
function MiniBarChart({ data }: { data: DailyPoint[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const todayKey = new Date().toISOString().slice(0, 10);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 64 }}>
      {data.map((d) => {
        const pct = (d.count / max) * 100;
        const label = new Date(d.date + "T00:00:00").toLocaleDateString("es-AR", { weekday: "short" });
        const isToday = d.date === todayKey;
        return (
          <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div
              style={{
                width: "100%", height: `${Math.max(pct, 4)}%`,
                background: isToday ? "var(--green-soft)" : d.count > 0 ? "var(--green-tint)" : "var(--surface-2)",
                borderRadius: 4, transition: "height .3s", minHeight: 4,
                border: isToday ? "1px solid var(--green-soft)" : "none",
              }}
              title={`${d.date}: ${d.count} conversaciones`}
            />
            <span className="mono" style={{
              fontSize: 9, textTransform: "uppercase",
              color: isToday ? "var(--green-soft)" : "var(--muted)",
              fontWeight: isToday ? 700 : 400,
            }}>
              {label.slice(0, 2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function StatsScreen() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const p = (await r.json().catch(() => null)) as { error?: string } | null;
          throw new Error(p?.error ?? "No se pudo cargar las métricas.");
        }
        return r.json() as Promise<StatsData>;
      })
      .then((data) => { setStats(data); setError(null); })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Error al cargar métricas."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "var(--bg)" }}>
        <div className="atd-spinner" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div style={{ height: "100%", background: "var(--bg)", padding: 20 }}>
        <div className="atd-card" style={{ padding: 16, color: "#c0392b", background: "rgba(192,57,43,0.07)", borderColor: "rgba(192,57,43,0.2)" }}>
          {error ?? "No se pudieron cargar las métricas."}
        </div>
      </div>
    );
  }

  const aiPct = stats.total_conversations > 0
    ? Math.round((stats.ai_conversations / stats.total_conversations) * 100)
    : 0;

  return (
    <DashboardContentShell maxWidth={1180}>
      <div className="page-header">
        <div>
          <div className="page-sub">métricas</div>
          <h1 className="page-title">Actividad</h1>
        </div>
      </div>

      <div className="atd-card" style={{ margin: "0 0 12px", padding: 16, background: stats.active_today > 0 ? "var(--green-tint)" : "var(--surface)" }}>
        <div className="page-sub" style={{ marginBottom: 4 }}>hoy</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 750, lineHeight: 1, color: "var(--ink)" }}>{stats.active_today}</div>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
              {stats.active_today === 1 ? "conversación activa" : "conversaciones activas"}
            </p>
          </div>
          <TrendBadge pct={stats.weekly_trend_pct} />
        </div>
      </div>

      {/* ── KPIs principales ── */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-3" style={{ margin: "0 0 12px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <StatCard
          label="Total"
          value={stats.total_conversations}
          icon={<Spark size={11} />}
        />
        <StatCard
          label="Semana"
          value={stats.this_week_conversations}
        />
        <StatCard
          label="Derivación"
          value={`${stats.handoff_rate}%`}
        />
        <StatCard label="Resp. IA" value={formatResponseTime(stats.avg_ai_response_sec)} />
      </div>

      {/* ── Modo + gráfico ── */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-3" style={{ margin: "0 0 12px" }}>

        {/* Modo de atención */}
        <div className="atd-card" style={{ padding: 16, marginBottom: 12 }}>
          <div className="page-sub" style={{ marginBottom: 12 }}>modo de atención</div>

          <div style={{ display: "flex", gap: 4, marginBottom: 14, height: 8, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ flex: Math.max(aiPct, 1), background: "var(--green-soft)" }} />
            <div style={{ flex: Math.max(100 - aiPct, 1), background: "var(--human)" }} />
          </div>

          <div style={{ display: "flex", gap: 24 }}>
            <div>
              <div className="mono" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)" }}>{stats.ai_conversations}</div>
              <div style={{ fontSize: 12, color: "var(--green-soft)", display: "flex", alignItems: "center", gap: 4 }}>
                <Spark size={11} /> IA · {aiPct}%
              </div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 28, fontWeight: 600, color: "var(--ink)" }}>{stats.human_conversations}</div>
              <div style={{ fontSize: 12, color: "var(--human)" }}>Humano · {100 - aiPct}%</div>
            </div>
          </div>

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px dashed var(--hairline-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Tasa de derivación</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: stats.handoff_rate > 30 ? "var(--human)" : "var(--ink)" }}>
                {stats.handoff_rate}%
              </span>
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted)" }}>
              {stats.handoff_rate > 30
                ? "⚠ Alta — completá más el perfil del negocio"
                : stats.handoff_rate > 0
                ? "Normal — la IA maneja la mayoría"
                : "Excelente — la IA resuelve todo"}
            </div>
          </div>
        </div>

        {/* Gráfico 7 días */}
        {stats.daily_activity.length > 0 && (
          <div className="atd-card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div className="page-sub" style={{ marginBottom: 2 }}>nuevas conversaciones</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>últimos 7 días</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)" }}>
                  {stats.this_week_conversations}
                </div>
                <TrendBadge pct={stats.weekly_trend_pct} />
              </div>
            </div>
            <MiniBarChart data={stats.daily_activity} />
          </div>
        )}
      </div>

      {/* ── Fila 4: Conversaciones recientes ── */}
      {stats.recent_conversations.length > 0 && (
        <div className="atd-card" style={{ margin: "0 0 12px", padding: 16 }}>
          <div className="page-sub" style={{ marginBottom: 10 }}>conversaciones recientes</div>
          {stats.recent_conversations.map((conv, i) => (
            <div
              key={conv.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 0",
                borderTop: i ? "1px dashed var(--hairline-2)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: conv.needs_attention
                    ? "rgba(212,154,58,0.18)"
                    : conv.mode === "AI" ? "var(--green-tint)" : "var(--human-tint)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {conv.needs_attention
                    ? <span style={{ fontSize: 13 }}>👋</span>
                    : conv.mode === "AI"
                    ? <Spark size={14} style={{ color: "var(--green-ink)" }} />
                    : <span style={{ fontSize: 14 }}>👤</span>}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{conv.name}</div>
                  <div style={{ fontSize: 11, color: conv.needs_attention ? "var(--human)" : "var(--muted)" }}>
                    {conv.needs_attention ? "⚡ Necesita atención" : conv.mode === "AI" ? "IA" : "Humano"}
                  </div>
                </div>
              </div>
              <div className="mono" style={{ fontSize: 11, color: "var(--muted)", textAlign: "right" }}>
                {formatTime(conv.last_message_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Estado vacío ── */}
      {stats.total_conversations === 0 && (
        <div className="atd-card" style={{ margin: 0, padding: "32px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
            Todavía no hay conversaciones
          </p>
          <p style={{ fontSize: 13, color: "var(--ink-3)" }}>
            Las métricas aparecen cuando empiecen a llegar mensajes de WhatsApp.
          </p>
        </div>
      )}
    </DashboardContentShell>
  );
}
