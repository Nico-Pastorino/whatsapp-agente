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
  last_message_at: number | null;
}

interface StatsData {
  total_conversations: number;
  ai_conversations: number;
  human_conversations: number;
  inbound_messages_this_month: number;
  ai_replies_this_month: number;
  human_messages_this_month: number;
  daily_activity: DailyPoint[];
  recent_conversations: RecentConv[];
}

function formatTime(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="atd-card"
      style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 11 }}>
        {icon}
        <span className="mono" style={{ textTransform: "uppercase", letterSpacing: "0.12em" }}>
          {label}
        </span>
      </div>
      <div
        className="serif"
        style={{ fontSize: 36, lineHeight: 1.1, color: "var(--ink)", marginTop: 4 }}
      >
        {typeof value === "number" ? value.toLocaleString("es-AR") : value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

function MiniBarChart({ data }: { data: DailyPoint[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 56 }}>
      {data.map((d) => {
        const pct = (d.count / max) * 100;
        const label = new Date(d.date + "T00:00:00").toLocaleDateString("es-AR", {
          weekday: "short",
        });
        return (
          <div
            key={d.date}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
          >
            <div
              style={{
                width: "100%",
                height: `${Math.max(pct, 4)}%`,
                background: d.count > 0 ? "var(--green-soft)" : "var(--surface-2)",
                borderRadius: 4,
                transition: "height .3s",
                minHeight: 4,
              }}
              title={`${d.date}: ${d.count} conversaciones`}
            />
            <span className="mono" style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase" }}>
              {label.slice(0, 2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

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
      .then((data) => {
        setStats(data);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Error al cargar métricas.");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          background: "var(--bg)",
        }}
      >
        <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div style={{ height: "100%", background: "var(--bg)", padding: 20 }}>
        <div
          className="atd-card"
          style={{
            padding: 16,
            color: "#c0392b",
            background: "rgba(192,57,43,0.07)",
            borderColor: "rgba(192,57,43,0.2)",
          }}
        >
          {error ?? "No se pudieron cargar las métricas."}
        </div>
      </div>
    );
  }

  const aiPct =
    stats.total_conversations > 0
      ? Math.round((stats.ai_conversations / stats.total_conversations) * 100)
      : 0;

  return (
    <DashboardContentShell maxWidth={1180}>
      <div className="page-header">
        <div>
          <div className="page-sub">05 · métricas</div>
          <h1 className="page-title">Actividad</h1>
        </div>
      </div>

      {/* KPI grid */}
      <div
        className="lg:grid lg:grid-cols-3 lg:gap-3"
        style={{ margin: "0 20px 12px" }}
      >
        <StatCard
          label="Conversaciones totales"
          value={stats.total_conversations}
          sub={`${aiPct}% respondidas por IA`}
          icon={<Spark size={11} />}
        />
        <StatCard
          label="Mensajes recibidos"
          value={stats.inbound_messages_this_month}
          sub="este mes"
        />
        <StatCard
          label="Respuestas IA"
          value={stats.ai_replies_this_month}
          sub="este mes"
        />
      </div>

      <div
        className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-3"
        style={{ margin: "0 20px 12px" }}
      >
        {/* Mode breakdown */}
        <div className="atd-card" style={{ padding: 16, marginBottom: 12 }}>
          <div className="page-sub" style={{ marginBottom: 12 }}>
            modo de atención
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div
              style={{
                flex: aiPct,
                height: 8,
                background: "var(--green-soft)",
                borderRadius: "4px 0 0 4px",
                minWidth: 4,
              }}
            />
            <div
              style={{
                flex: 100 - aiPct,
                height: 8,
                background: "var(--human)",
                borderRadius: "0 4px 4px 0",
                minWidth: 4,
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <div>
              <div
                className="mono"
                style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)" }}
              >
                {stats.ai_conversations}
              </div>
              <div style={{ fontSize: 12, color: "var(--green-soft)", display: "flex", alignItems: "center", gap: 4 }}>
                <Spark size={11} /> IA
              </div>
            </div>
            <div>
              <div
                className="mono"
                style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)" }}
              >
                {stats.human_conversations}
              </div>
              <div style={{ fontSize: 12, color: "var(--human)" }}>Humano</div>
            </div>
          </div>
        </div>

        {/* Mini bar chart */}
        {stats.daily_activity.length > 0 && (
          <div className="atd-card" style={{ padding: 16, marginBottom: 12 }}>
            <div className="page-sub" style={{ marginBottom: 12 }}>
              nuevas conversaciones · últimos 7 días
            </div>
            <MiniBarChart data={stats.daily_activity} />
          </div>
        )}
      </div>

      {/* Recent conversations */}
      {stats.recent_conversations.length > 0 && (
        <div className="atd-card" style={{ margin: "0 20px 12px", padding: 16 }}>
          <div className="page-sub" style={{ marginBottom: 10 }}>
            conversaciones recientes
          </div>
          {stats.recent_conversations.map((conv, i) => (
            <div
              key={conv.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderTop: i ? "1px dashed var(--hairline-2)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background:
                      conv.mode === "AI" ? "var(--green-tint)" : "var(--human-tint)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {conv.mode === "AI" ? (
                    <Spark size={14} style={{ color: "var(--green-ink)" }} />
                  ) : (
                    <span style={{ fontSize: 14 }}>👤</span>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                    {conv.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    {conv.mode === "AI" ? "IA" : "Humano"}
                  </div>
                </div>
              </div>
              <div
                className="mono"
                style={{ fontSize: 11, color: "var(--muted)", textAlign: "right" }}
              >
                {formatTime(conv.last_message_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardContentShell>
  );
}
