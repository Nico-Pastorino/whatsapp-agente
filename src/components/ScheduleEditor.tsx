"use client";

import { useEffect, useState } from "react";

// 0=Domingo .. 6=Sábado (igual que en la base). La UI los muestra Lun..Dom.
type Interval = { open_time: string; close_time: string };
type HourRow = { weekday: number; open_time: string; close_time: string };
type ExceptionRow = {
  exception_date: string;
  kind: "closed" | "block" | "special";
  start_time: string | null;
  end_time: string | null;
  reason: string;
};
type Settings = {
  timezone: string;
  slot_interval_minutes: number;
  default_duration_minutes: number;
  booking_lead_minutes: number;
  booking_horizon_days: number;
};

const DAYS: { weekday: number; label: string }[] = [
  { weekday: 1, label: "Lunes" },
  { weekday: 2, label: "Martes" },
  { weekday: 3, label: "Miércoles" },
  { weekday: 4, label: "Jueves" },
  { weekday: 5, label: "Viernes" },
  { weekday: 6, label: "Sábado" },
  { weekday: 0, label: "Domingo" },
];

const FREQ_OPTIONS = [15, 30, 45, 60, 90, 120];

function hoursToMap(hours: HourRow[]): Record<number, Interval[]> {
  const map: Record<number, Interval[]> = {};
  for (const h of hours) {
    (map[h.weekday] = map[h.weekday] ?? []).push({ open_time: h.open_time, close_time: h.close_time });
  }
  return map;
}

export default function ScheduleEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dayIntervals, setDayIntervals] = useState<Record<number, Interval[]>>({});
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [settings, setSettings] = useState<Settings>({
    timezone: "America/Argentina/Buenos_Aires",
    slot_interval_minutes: 30,
    default_duration_minutes: 30,
    booking_lead_minutes: 0,
    booking_horizon_days: 30,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/business/schedule");
        if (!res.ok) throw new Error("No se pudo cargar el horario.");
        const data = await res.json();
        if (!active) return;
        setDayIntervals(hoursToMap(data.hours ?? []));
        setExceptions(data.exceptions ?? []);
        if (data.settings) setSettings(data.settings);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Error al cargar.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function markDirty() {
    setSaved(false);
  }

  function toggleDay(weekday: number) {
    setDayIntervals((prev) => {
      const next = { ...prev };
      if (next[weekday]?.length) delete next[weekday];
      else next[weekday] = [{ open_time: "09:00", close_time: "18:00" }];
      return next;
    });
    markDirty();
  }

  function updateInterval(weekday: number, idx: number, field: keyof Interval, value: string) {
    setDayIntervals((prev) => {
      const list = [...(prev[weekday] ?? [])];
      list[idx] = { ...list[idx], [field]: value };
      return { ...prev, [weekday]: list };
    });
    markDirty();
  }

  function addInterval(weekday: number) {
    setDayIntervals((prev) => ({
      ...prev,
      [weekday]: [...(prev[weekday] ?? []), { open_time: "09:00", close_time: "13:00" }],
    }));
    markDirty();
  }

  function removeInterval(weekday: number, idx: number) {
    setDayIntervals((prev) => {
      const list = (prev[weekday] ?? []).filter((_, i) => i !== idx);
      const next = { ...prev };
      if (list.length) next[weekday] = list;
      else delete next[weekday];
      return next;
    });
    markDirty();
  }

  function addClosedDate() {
    setExceptions((prev) => [
      ...prev,
      { exception_date: "", kind: "closed", start_time: null, end_time: null, reason: "" },
    ]);
    markDirty();
  }

  function updateException(idx: number, field: keyof ExceptionRow, value: string) {
    setExceptions((prev) => {
      const list = [...prev];
      list[idx] = { ...list[idx], [field]: value };
      return list;
    });
    markDirty();
  }

  function removeException(idx: number) {
    setExceptions((prev) => prev.filter((_, i) => i !== idx));
    markDirty();
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const hours: HourRow[] = [];
      for (const [weekday, list] of Object.entries(dayIntervals)) {
        for (const iv of list) {
          if (iv.open_time && iv.close_time) {
            hours.push({ weekday: Number(weekday), open_time: iv.open_time, close_time: iv.close_time });
          }
        }
      }
      const cleanExceptions = exceptions.filter((e) => e.exception_date);
      const res = await fetch("/api/business/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours, exceptions: cleanExceptions, settings }),
      });
      if (!res.ok) throw new Error("No se pudo guardar.");
      const data = await res.json();
      setDayIntervals(hoursToMap(data.hours ?? []));
      setExceptions(data.exceptions ?? []);
      if (data.settings) setSettings(data.settings);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p style={{ color: "var(--muted, #888)", fontSize: 14 }}>Cargando horario…</p>;
  }

  const timeInputStyle: React.CSSProperties = {
    background: "var(--surface, #1a1a1a)",
    border: "1px solid var(--hairline, #333)",
    borderRadius: 8,
    padding: "6px 8px",
    color: "inherit",
    fontSize: 14,
    width: 96,
  };
  const smallBtn: React.CSSProperties = {
    background: "transparent",
    border: "none",
    color: "var(--accent, #3b82f6)",
    cursor: "pointer",
    fontSize: 13,
    padding: "4px 6px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Frecuencia + duración */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          Frecuencia de turnos
          <select
            value={settings.slot_interval_minutes}
            onChange={(e) => { setSettings((s) => ({ ...s, slot_interval_minutes: Number(e.target.value) })); markDirty(); }}
            style={timeInputStyle}
          >
            {FREQ_OPTIONS.map((m) => (
              <option key={m} value={m}>{`Cada ${m} min`}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          Duración del turno
          <select
            value={settings.default_duration_minutes}
            onChange={(e) => { setSettings((s) => ({ ...s, default_duration_minutes: Number(e.target.value) })); markDirty(); }}
            style={timeInputStyle}
          >
            {FREQ_OPTIONS.map((m) => (
              <option key={m} value={m}>{`${m} min`}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          Antelación mínima
          <select
            value={settings.booking_lead_minutes}
            onChange={(e) => { setSettings((s) => ({ ...s, booking_lead_minutes: Number(e.target.value) })); markDirty(); }}
            style={timeInputStyle}
          >
            <option value={0}>Sin mínimo</option>
            <option value={60}>1 hora</option>
            <option value={120}>2 horas</option>
            <option value={1440}>1 día</option>
          </select>
        </label>
      </div>

      {/* Horario semanal */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {DAYS.map(({ weekday, label }) => {
          const intervals = dayIntervals[weekday] ?? [];
          const open = intervals.length > 0;
          return (
            <div
              key={weekday}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "12px 0",
                borderBottom: "1px solid var(--hairline, #2a2a2a)",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 8, width: 120, paddingTop: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={open} onChange={() => toggleDay(weekday)} />
                <span>{label}</span>
              </label>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                {!open && <span style={{ color: "var(--muted, #888)", fontSize: 14, paddingTop: 6 }}>Cerrado</span>}
                {intervals.map((iv, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <input type="time" value={iv.open_time} onChange={(e) => updateInterval(weekday, idx, "open_time", e.target.value)} style={timeInputStyle} />
                    <span style={{ color: "var(--muted, #888)" }}>a</span>
                    <input type="time" value={iv.close_time} onChange={(e) => updateInterval(weekday, idx, "close_time", e.target.value)} style={timeInputStyle} />
                    {intervals.length > 1 && (
                      <button type="button" onClick={() => removeInterval(weekday, idx)} style={{ ...smallBtn, color: "var(--danger, #ef4444)" }}>Quitar</button>
                    )}
                    {idx === intervals.length - 1 && (
                      <button type="button" onClick={() => addInterval(weekday)} style={smallBtn}>+ Agregar turno</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Feriados / días cerrados */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Feriados y días cerrados</span>
          <button type="button" onClick={addClosedDate} style={smallBtn}>+ Agregar día cerrado</button>
        </div>
        {exceptions.length === 0 && (
          <span style={{ color: "var(--muted, #888)", fontSize: 13 }}>Sin días cerrados cargados.</span>
        )}
        {exceptions.map((ex, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <input type="date" value={ex.exception_date} onChange={(e) => updateException(idx, "exception_date", e.target.value)} style={{ ...timeInputStyle, width: 150 }} />
            <input
              type="text"
              placeholder="Motivo (opcional)"
              value={ex.reason}
              onChange={(e) => updateException(idx, "reason", e.target.value)}
              style={{ ...timeInputStyle, width: 200 }}
            />
            <button type="button" onClick={() => removeException(idx)} style={{ ...smallBtn, color: "var(--danger, #ef4444)" }}>Quitar</button>
          </div>
        ))}
      </div>

      {error && <span style={{ color: "var(--danger, #ef4444)", fontSize: 13 }}>{error}</span>}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            background: "var(--accent, #3b82f6)",
            color: "#fff",
            border: "none",
            borderRadius: 999,
            padding: "8px 18px",
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Guardando…" : "Guardar horario"}
        </button>
        {saved && <span style={{ color: "var(--green, #22c55e)", fontSize: 13 }}>Guardado ✓</span>}
      </div>
    </div>
  );
}
