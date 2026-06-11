"use client";

import { useEffect, useState } from "react";

interface Source {
  id: string;
  url: string;
  label: string | null;
  source_type: "web" | "sheet";
  status: "pending" | "ok" | "error";
  error_message: string | null;
  enabled: boolean;
  last_fetched_at: string | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "nunca";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "recién";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

/**
 * Fuentes externas: el negocio pega un link (su web, carta online, Google
 * Sheets de precios/stock) y el asistente responde con esa información.
 */
export default function KnowledgeSourcesSection() {
  const [sources, setSources] = useState<Source[]>([]);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/business/sources", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.sources)) setSources(data.sources);
      })
      .catch(() => undefined);
  }, []);

  async function addSource() {
    if (!url.trim()) return;
    setAdding(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/business/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), label: label.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.source) {
        setSources((prev) => [...prev, data.source]);
        setUrl("");
        setLabel("");
        setNotice("Listo. Tu asistente ya puede responder con esa información.");
      } else {
        setError(data.error ?? "No pudimos leer ese link.");
      }
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setAdding(false);
    }
  }

  async function refreshSource(id: string) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/business/sources/${id}`, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.source) {
        setSources((prev) => prev.map((s) => (s.id === id ? data.source : s)));
        setNotice("Fuente actualizada.");
      } else {
        setError(data.error ?? "No pudimos actualizar la fuente.");
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeSource(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/business/sources/${id}`, { method: "DELETE" });
      if (res.ok) setSources((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section id="fuentes-externas" className="atd-card" style={{ margin: "12px 20px 0", padding: 20 }}>
      <div className="mb-4">
        <p className="page-sub" style={{ color: "var(--green)", marginBottom: 4 }}>conectá tus datos</p>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: 0 }}>Fuentes externas</h3>
        <p style={{ marginTop: 4, fontSize: 13, color: "var(--ink-3)" }}>
          Pegá el link de tu web, tu carta online o una planilla de Google con precios o stock.
          Tu asistente responde con esa información y se actualiza solo cada unas horas.
        </p>
      </div>

      {/* Fuentes cargadas */}
      {sources.map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: "var(--surface-2)", marginBottom: 8 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{s.source_type === "sheet" ? "📊" : "🌐"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.label || s.url.replace(/^https?:\/\//, "")}
            </p>
            <p style={{ fontSize: 11.5, margin: "2px 0 0", color: s.status === "error" ? "#b42318" : "var(--muted)" }}>
              {s.status === "error"
                ? s.error_message ?? "Error al leer el link"
                : `Actualizada ${timeAgo(s.last_fetched_at)}`}
            </p>
          </div>
          <button
            onClick={() => refreshSource(s.id)}
            disabled={busyId === s.id}
            aria-label="Actualizar fuente"
            title="Actualizar ahora"
            style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--hairline)", background: "var(--surface)", color: "var(--ink-2)", cursor: "pointer", fontSize: 14, flexShrink: 0, opacity: busyId === s.id ? 0.5 : 1 }}
          >
            ⟳
          </button>
          <button
            onClick={() => removeSource(s.id)}
            disabled={busyId === s.id}
            aria-label="Eliminar fuente"
            style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--hairline)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", fontSize: 15, flexShrink: 0 }}
          >
            ×
          </button>
        </div>
      ))}

      {/* Alta */}
      {sources.length < 3 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 12, borderRadius: 14, border: "1px dashed var(--hairline-2)" }}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://tu-pagina.com/carta  ·  link de Google Sheets  ·  .csv"
            className="atd-input"
            inputMode="url"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder='Nombre (opcional): "Carta", "Lista de precios"…'
            className="atd-input"
          />
          <button
            onClick={addSource}
            disabled={adding || !url.trim()}
            className="atd-btn green sm"
            style={{ alignSelf: "flex-start", opacity: adding || !url.trim() ? 0.5 : 1 }}
          >
            {adding ? "Leyendo el link…" : "+ Conectar fuente"}
          </button>
          <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "2px 0 0" }}>
            ¿Tenés un Excel? Subilo a Google Sheets y compartilo como “Cualquiera con el enlace”.
          </p>
        </div>
      ) : (
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
          Llegaste al máximo de 3 fuentes. Eliminá una para conectar otra.
        </p>
      )}

      {notice && <p style={{ fontSize: 13, color: "var(--green-soft)", marginTop: 10, fontWeight: 500 }}>{notice}</p>}
      {error && <p style={{ fontSize: 13, color: "#b42318", marginTop: 10 }}>{error}</p>}
    </section>
  );
}
