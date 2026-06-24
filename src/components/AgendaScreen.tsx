"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Appointment, AppointmentStatus } from "@/lib/db";
import DashboardContentShell from "./DashboardContentShell";
import ModalPortal from "./ModalPortal";

const STATUS_META: Record<AppointmentStatus, { label: string; bg: string; color: string }> = {
  pending: { label: "Pendiente", bg: "var(--accent-soft)", color: "var(--accent-ink)" },
  confirmed: { label: "Confirmada", bg: "var(--green-tint)", color: "var(--green-ink)" },
  cancelled: { label: "Cancelada", bg: "#f1d9d6", color: "#7a271a" },
  done: { label: "Completada", bg: "var(--surface-2)", color: "var(--ink-2)" },
};

const STATUS_ORDER: AppointmentStatus[] = ["pending", "confirmed", "done", "cancelled"];

interface FormState {
  customer_name: string;
  customer_phone: string;
  datetime: string;
  service: string;
  notes: string;
  status: AppointmentStatus;
}

const EMPTY_FORM: FormState = {
  customer_name: "",
  customer_phone: "",
  datetime: "",
  service: "",
  notes: "",
  status: "pending",
};

type AvailableSlot = { label: string; iso: string };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timeOf(d: Date): string {
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

/** "vie 19 jun, 09:00–09:30" usando duración/fin cuando existen. */
function formatRange(a: Appointment): string {
  if (!a.starts_at) return "Sin fecha";
  const start = new Date(a.starts_at);
  if (Number.isNaN(start.getTime())) return "Sin fecha";
  const dayStr = start.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" });
  let end: Date | null = null;
  if (a.ends_at) end = new Date(a.ends_at);
  else if (a.duration_minutes) end = new Date(start.getTime() + a.duration_minutes * 60_000);
  const timeStr = end && !Number.isNaN(end.getTime()) ? `${timeOf(start)}–${timeOf(end)}` : timeOf(start);
  return `${dayStr}, ${timeStr}`;
}

/** Encabezado de grupo por día: Hoy / Mañana / fecha. */
function dayHeading(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  const now = new Date();
  const todayKey = dateKey(now);
  const tomorrowKey = dateKey(new Date(now.getTime() + 86_400_000));
  const k = dateKey(d);
  if (k === todayKey) return "Hoy";
  if (k === tomorrowKey) return "Mañana";
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long" });
}

type StatusFilter = "all" | AppointmentStatus;
type ViewMode = "list" | "day" | "week";

export default function AgendaScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [view, setView] = useState<ViewMode>("day");
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reprogramación con slots libres
  const [reschedule, setReschedule] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>("");
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsConfigured, setSlotsConfigured] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [manualDatetime, setManualDatetime] = useState("");
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/appointments?all=1", { cache: "no-store" });
      if (!res.ok) {
        setLoadError("No pudimos cargar las reservas. Intentá de nuevo.");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { appointments: Appointment[] };
      setAppointments(data.appointments ?? []);
    } catch {
      setLoadError("Error de conexión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(a: Appointment) {
    setEditing(a);
    setForm({
      customer_name: a.customer_name ?? "",
      customer_phone: a.customer_phone ?? "",
      datetime: toLocalInputValue(a.starts_at),
      service: a.service ?? "",
      notes: a.notes ?? "",
      status: a.status,
    });
    setError(null);
    setShowForm(true);
  }

  async function save() {
    if (!form.customer_name.trim()) {
      setError("Poné el nombre del cliente.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim() || null,
      service: form.service.trim() || null,
      notes: form.notes.trim() || null,
      starts_at: form.datetime ? new Date(form.datetime).toISOString() : null,
      status: form.status,
    };
    try {
      const res = editing
        ? await fetch(`/api/appointments/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/appointments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar la reserva.");
        return;
      }
      setShowForm(false);
      await load();
    } catch {
      setError("Error de conexión. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(a: Appointment, status: AppointmentStatus) {
    setAppointments((prev) => prev.map((x) => (x.id === a.id ? { ...x, status } : x)));
    try {
      await fetch(`/api/appointments/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } finally {
      load();
    }
  }

  async function removeAppointment(a: Appointment) {
    if (typeof window !== "undefined" && !window.confirm("¿Eliminar esta reserva? No se puede deshacer.")) return;
    setAppointments((prev) => prev.filter((x) => x.id !== a.id));
    try {
      await fetch(`/api/appointments/${a.id}`, { method: "DELETE" });
    } finally {
      load();
    }
  }

  async function clearClosed() {
    if (typeof window !== "undefined" && !window.confirm("¿Vaciar todas las completadas y canceladas? No se puede deshacer.")) return;
    try {
      await fetch("/api/appointments/clear", { method: "POST" });
    } finally {
      load();
    }
  }

  const fetchSlots = useCallback(async (date: string) => {
    if (!date) return;
    setSlotsLoading(true);
    try {
      const res = await fetch(`/api/business/availability?date=${date}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setSlotsConfigured(Boolean(data.configured));
      setSlots(Array.isArray(data.slots) ? data.slots : []);
    } catch {
      setSlotsConfigured(false);
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  function openReschedule(a: Appointment) {
    const base = a.starts_at ? new Date(a.starts_at) : new Date();
    const d = Number.isNaN(base.getTime()) ? new Date() : base;
    const date = dateKey(d);
    setReschedule(a);
    setRescheduleDate(date);
    setManualDatetime(toLocalInputValue(a.starts_at));
    setSlots([]);
    setSlotsConfigured(true);
    fetchSlots(date);
  }

  async function applyReschedule(iso: string) {
    if (!reschedule) return;
    setRescheduleSaving(true);
    try {
      await fetch(`/api/appointments/${reschedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starts_at: iso }),
      });
      setReschedule(null);
      await load();
    } finally {
      setRescheduleSaving(false);
    }
  }

  const sorted = useMemo(() => {
    return [...appointments].sort((a, b) => {
      const ta = a.starts_at ? new Date(a.starts_at).getTime() : Infinity;
      const tb = b.starts_at ? new Date(b.starts_at).getTime() : Infinity;
      return ta - tb;
    });
  }, [appointments]);

  const filtered = statusFilter === "all" ? sorted : sorted.filter((a) => a.status === statusFilter);
  const upcoming = filtered.filter((a) => a.status !== "cancelled" && a.status !== "done");
  const past = filtered.filter((a) => a.status === "cancelled" || a.status === "done");

  // Agrupado por día (vista "Día").
  const groupedUpcoming = useMemo(() => {
    const groups: { key: string; heading: string; items: Appointment[] }[] = [];
    const byKey: Record<string, { heading: string; items: Appointment[] }> = {};
    for (const a of upcoming) {
      const key = a.starts_at ? dateKey(new Date(a.starts_at)) : "sin-fecha";
      if (!byKey[key]) {
        byKey[key] = { heading: a.starts_at ? dayHeading(a.starts_at) : "Sin fecha", items: [] };
        groups.push({ key, heading: byKey[key].heading, items: byKey[key].items });
      }
      byKey[key].items.push(a);
    }
    return groups;
  }, [upcoming]);

  const pendingCount = appointments.filter((a) => a.status === "pending").length;
  const confirmedCount = appointments.filter((a) => a.status === "confirmed").length;
  const assistantCount = appointments.filter((a) => a.source === "ai").length;
  const countByStatus = (s: AppointmentStatus) => appointments.filter((a) => a.status === s).length;

  return (
    <DashboardContentShell maxWidth={1320}>
      <div style={{ padding: "14px 0 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <div>
            <div className="page-sub">agenda</div>
            <h1 className="page-title">Reservas</h1>
          </div>
          <button onClick={openNew} className="atd-btn primary sm" style={{ whiteSpace: "nowrap" }}>
            Nueva
          </button>
        </div>

        <div className="agenda-desktop-grid">
          <aside>
            <div className="atd-card agenda-summary-grid" style={{ padding: 14, marginBottom: 12 }}>
              <Summary label="Pendientes" value={pendingCount} />
              <Summary label="Confirmadas" value={confirmedCount} />
              <Summary label="IA" value={assistantCount} />
            </div>

            {/* Vista: Día / Lista */}
            <div className="atd-card" style={{ display: "flex", gap: 6, marginBottom: 12, padding: 8 }}>
              {([["day", "Día"], ["week", "Semana"], ["list", "Lista"]] as [ViewMode, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className="atd-pill"
                  style={{
                    flex: 1,
                    background: view === key ? "var(--ink)" : "var(--surface)",
                    color: view === key ? "var(--bg)" : "var(--ink-2)",
                    borderColor: view === key ? "transparent" : "var(--hairline-2)",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {appointments.length > 0 && (
              <div className="atd-card" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, padding: 12 }}>
                {([
                  ["all", `Todas ${appointments.length}`],
                  ["pending", `Pendientes ${countByStatus("pending")}`],
                  ["confirmed", `Confirmadas ${countByStatus("confirmed")}`],
                  ["done", `Completadas ${countByStatus("done")}`],
                  ["cancelled", `Canceladas ${countByStatus("cancelled")}`],
                ] as [StatusFilter, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className="atd-pill"
                    style={{
                      background: statusFilter === key ? "var(--ink)" : "var(--surface)",
                      color: statusFilter === key ? "var(--bg)" : "var(--ink-2)",
                      borderColor: statusFilter === key ? "transparent" : "var(--hairline-2)",
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </aside>

          <main>
            {loadError && (
              <div className="atd-card" style={{ padding: 14, marginBottom: 14, color: "var(--danger-ink)", borderColor: "var(--danger-border)" }}>
                {loadError}
              </div>
            )}

            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Cargando…</div>
            ) : appointments.length === 0 ? (
              <div className="atd-card" style={{ padding: 28, textAlign: "center" }}>
                <div style={{ fontSize: 34, marginBottom: 8 }}>🗓️</div>
                <h3 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 6px" }}>Todavía no hay reservas</h3>
                <p style={{ fontSize: 13.5, color: "var(--ink-3)", margin: "0 0 16px" }}>
                  Creá tu primera reserva o dejá que tu asistente las tome por vos.
                </p>
                <button onClick={openNew} className="atd-btn green">+ Nueva reserva</button>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                No hay reservas con este estado.
              </div>
            ) : (
              <>
                {view === "week" && (
                  <WeekCalendar
                    appointments={filtered}
                    weekOffset={weekOffset}
                    onPrev={() => setWeekOffset((w) => w - 1)}
                    onNext={() => setWeekOffset((w) => w + 1)}
                    onToday={() => setWeekOffset(0)}
                    onSelect={openEdit}
                  />
                )}

                {upcoming.length > 0 && view === "day" && (
                  <div style={{ marginBottom: 22, display: "flex", flexDirection: "column", gap: 20 }}>
                    {groupedUpcoming.map((g) => (
                      <div key={g.key}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", margin: "0 0 10px", textTransform: "capitalize" }}>
                          {g.heading} <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {g.items.length}</span>
                        </p>
                        <div className="agenda-card-grid">
                          {g.items.map((a) => (
                            <AppointmentCard key={a.id} a={a} onEdit={openEdit} onStatus={changeStatus} onReschedule={openReschedule} onDelete={removeAppointment} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {upcoming.length > 0 && view === "list" && (
                  <div className="agenda-card-grid" style={{ marginBottom: 22 }}>
                    {upcoming.map((a) => (
                      <AppointmentCard key={a.id} a={a} onEdit={openEdit} onStatus={changeStatus} onReschedule={openReschedule} onDelete={removeAppointment} />
                    ))}
                  </div>
                )}

                {past.length > 0 && view !== "week" && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "0 0 10px" }}>
                      <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", margin: 0 }}>
                        Completadas / canceladas
                      </p>
                      <button onClick={clearClosed} className="atd-chip" style={{ color: "var(--danger-ink)" }}>
                        Vaciar
                      </button>
                    </div>
                    <div className="agenda-card-grid" style={{ opacity: 0.72 }}>
                      {past.map((a) => (
                        <AppointmentCard key={a.id} a={a} onEdit={openEdit} onStatus={changeStatus} onReschedule={openReschedule} onDelete={removeAppointment} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {showForm && (
        <ModalPortal>
          <div onClick={() => !saving && setShowForm(false)} className="atd-overlay sheet" style={{ zIndex: 200 }}>
            <div onClick={(e) => e.stopPropagation()} className="atd-modal" style={{ width: "100%", maxWidth: 520, padding: 20, maxHeight: "92svh", overflowY: "auto" }}>
              <div className="atd-sheet-grabber md:hidden" style={{ margin: "-6px auto 10px" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{editing ? "Editar reserva" : "Nueva reserva"}</h3>
                <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--muted)" }}>×</button>
              </div>

              <Field label="Cliente">
                <input className="atd-input" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Nombre del cliente" />
              </Field>
              <Field label="Teléfono (opcional)">
                <input className="atd-input" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} placeholder="Ej: 11 5555 5555" inputMode="tel" />
              </Field>
              <Field label="Día y horario">
                <input className="atd-input" type="datetime-local" value={form.datetime} onChange={(e) => setForm({ ...form, datetime: e.target.value })} />
              </Field>
              <Field label="Servicio (opcional)">
                <input className="atd-input" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} placeholder="Ej: Corte, color, consulta…" />
              </Field>
              <Field label="Notas internas (opcional)">
                <textarea className="atd-input resize-none" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Algo que tengas que recordar" />
              </Field>
              <Field label="Estado">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {STATUS_ORDER.map((s) => (
                    <button
                      key={s}
                      onClick={() => setForm({ ...form, status: s })}
                      style={{
                        padding: "7px 13px",
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        border: form.status === s ? "1px solid transparent" : "1px solid var(--hairline)",
                        background: form.status === s ? STATUS_META[s].bg : "transparent",
                        color: form.status === s ? STATUS_META[s].color : "var(--ink-3)",
                      }}
                    >
                      {STATUS_META[s].label}
                    </button>
                  ))}
                </div>
              </Field>

              {error && <p style={{ color: "var(--danger-ink)", fontSize: 13, margin: "4px 0 0" }}>{error}</p>}

              <button onClick={save} disabled={saving} className="atd-btn green" style={{ width: "100%", marginTop: 14, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear reserva"}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {reschedule && (
        <ModalPortal>
          <div onClick={() => !rescheduleSaving && setReschedule(null)} className="atd-overlay sheet" style={{ zIndex: 210 }}>
            <div onClick={(e) => e.stopPropagation()} className="atd-modal" style={{ width: "100%", maxWidth: 480, padding: 20, maxHeight: "92svh", overflowY: "auto" }}>
              <div className="atd-sheet-grabber md:hidden" style={{ margin: "-6px auto 10px" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Reprogramar</h3>
                <button onClick={() => setReschedule(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--muted)" }}>×</button>
              </div>
              <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 14px" }}>
                {reschedule.customer_name || "Reserva"} · {reschedule.service || "sin servicio"}
              </p>

              <Field label="Día">
                <input
                  className="atd-input"
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => {
                    setRescheduleDate(e.target.value);
                    fetchSlots(e.target.value);
                  }}
                />
              </Field>

              {slotsLoading ? (
                <p style={{ fontSize: 13, color: "var(--muted)" }}>Buscando horarios libres…</p>
              ) : slotsConfigured ? (
                slots.length > 0 ? (
                  <>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink-2)", marginBottom: 8 }}>Horarios libres</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {slots.map((s) => (
                        <button
                          key={s.iso}
                          onClick={() => applyReschedule(s.iso)}
                          disabled={rescheduleSaving}
                          className="atd-chip"
                          style={{ minWidth: 64, justifyContent: "center" }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: "var(--muted)" }}>No hay horarios libres ese día. Probá otro.</p>
                )
              ) : (
                <>
                  <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 8px" }}>
                    Cargá tus horarios en Asistente → Reservas para ver sugerencias automáticas. Por ahora elegí manual:
                  </p>
                  <input
                    className="atd-input"
                    type="datetime-local"
                    value={manualDatetime}
                    onChange={(e) => setManualDatetime(e.target.value)}
                  />
                  <button
                    onClick={() => manualDatetime && applyReschedule(new Date(manualDatetime).toISOString())}
                    disabled={rescheduleSaving || !manualDatetime}
                    className="atd-btn green"
                    style={{ width: "100%", marginTop: 12, opacity: rescheduleSaving || !manualDatetime ? 0.6 : 1 }}
                  >
                    {rescheduleSaving ? "Guardando…" : "Reprogramar"}
                  </button>
                </>
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </DashboardContentShell>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p style={{ fontSize: 19, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{value}</p>
      <p style={{ fontSize: 11.5, color: "var(--muted)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink-2)", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function AppointmentCard({
  a,
  onEdit,
  onStatus,
  onReschedule,
  onDelete,
}: {
  a: Appointment;
  onEdit: (a: Appointment) => void;
  onStatus: (a: Appointment, status: AppointmentStatus) => void;
  onReschedule: (a: Appointment) => void;
  onDelete: (a: Appointment) => void;
}) {
  const meta = STATUS_META[a.status];
  const isClosed = a.status === "cancelled" || a.status === "done";
  // Acciones secundarias agrupadas en un menú "⋯" para no saturar la card en
  // mobile (antes eran hasta 6 botones apilados).
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="atd-card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 2px", color: "var(--ink)" }}>{a.customer_name || "Sin nombre"}</p>
          <p style={{ fontSize: 13, color: "var(--ink-2)", margin: 0 }}>{formatRange(a)}</p>
          {a.service && <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "2px 0 0" }}>{a.service}</p>}
          {a.customer_phone && <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "2px 0 0" }}>{a.customer_phone}</p>}
          {a.notes && <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: "4px 0 0", fontStyle: "italic" }}>{a.notes}</p>}
          {a.source === "ai" && (
            <span style={{ display: "inline-block", marginTop: 6, fontSize: 11, color: "var(--green-soft)", fontWeight: 600 }}>Tomado por el asistente</span>
          )}
          {a.conversation_id && (
            <a
              href={`/app/conversations?c=${a.conversation_id}`}
              style={{ display: "inline-block", marginTop: 6, marginLeft: a.source === "ai" ? 8 : 0, fontSize: 11, color: "var(--green-soft)", textDecoration: "underline", textUnderlineOffset: 2 }}
            >
              Ver conversación →
            </a>
          )}
        </div>
        <span style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: meta.bg, color: meta.color }}>
          {meta.label}
        </span>
      </div>
      {/* Acciones primarias siempre visibles + "⋯" para las secundarias. */}
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        {a.status !== "confirmed" && a.status !== "cancelled" && (
          <button onClick={() => onStatus(a, "confirmed")} className="atd-chip">Confirmar</button>
        )}
        {a.status !== "done" && a.status !== "cancelled" && (
          <button onClick={() => onStatus(a, "done")} className="atd-chip">Completar</button>
        )}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="atd-chip"
          aria-expanded={menuOpen}
          aria-label="Más acciones"
        >
          {menuOpen ? "Menos ✕" : "⋯ Más"}
        </button>
      </div>
      {menuOpen && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {!isClosed && (
            <button onClick={() => onReschedule(a)} className="atd-chip">Reprogramar</button>
          )}
          <button onClick={() => onEdit(a)} className="atd-chip">Editar</button>
          {a.status !== "cancelled" && (
            <button onClick={() => onStatus(a, "cancelled")} className="atd-chip" style={{ color: "var(--danger-ink)" }}>Cancelar</button>
          )}
          <button onClick={() => onDelete(a)} className="atd-chip" style={{ color: "var(--danger-ink)" }} title="Eliminar definitivamente">Eliminar</button>
        </div>
      )}
    </div>
  );
}

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Dom..6=Sáb
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day)); // retroceder al lunes
  return x;
}

function durationOf(a: Appointment): number {
  if (a.duration_minutes && a.duration_minutes > 0) return a.duration_minutes;
  if (a.starts_at && a.ends_at) {
    const diff = (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000;
    if (diff > 0) return diff;
  }
  return 30;
}

function WeekCalendar({
  appointments,
  weekOffset,
  onPrev,
  onNext,
  onToday,
  onSelect,
}: {
  appointments: Appointment[];
  weekOffset: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelect: (a: Appointment) => void;
}) {
  const base = new Date();
  base.setDate(base.getDate() + weekOffset * 7);
  const weekStart = startOfWeekMonday(base);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const weekStartMs = weekStart.getTime();
  const weekEndMs = weekStartMs + 7 * 86_400_000;

  const inWeek = appointments.filter((a) => {
    if (!a.starts_at) return false;
    const t = new Date(a.starts_at).getTime();
    return !Number.isNaN(t) && t >= weekStartMs && t < weekEndMs;
  });

  // Rango horario: 8–20 por defecto, expandido para que entren todos los turnos.
  let minH = 8;
  let maxH = 20;
  for (const a of inWeek) {
    const s = new Date(a.starts_at!);
    const startMin = s.getHours() * 60 + s.getMinutes();
    const endMin = startMin + durationOf(a);
    minH = Math.min(minH, Math.floor(startMin / 60));
    maxH = Math.max(maxH, Math.ceil(endMin / 60));
  }
  minH = Math.max(0, minH);
  maxH = Math.min(24, maxH);
  const HOUR = 52;
  const gridH = (maxH - minH) * HOUR;
  const hours = Array.from({ length: maxH - minH + 1 }, (_, i) => minH + i);
  const todayKey = dateKey(new Date());
  const weekLabel = `${days[0].toLocaleDateString("es-AR", { day: "2-digit", month: "short" })} – ${days[6].toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}`;

  return (
    <div className="atd-card" style={{ padding: 12, marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onPrev} className="atd-chip" aria-label="Semana anterior">←</button>
          <button onClick={onToday} className="atd-chip">Hoy</button>
          <button onClick={onNext} className="atd-chip" aria-label="Semana siguiente">→</button>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", textTransform: "capitalize" }}>{weekLabel}</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 680, display: "grid", gridTemplateColumns: "44px repeat(7, 1fr)" }}>
          {/* Encabezado */}
          <div />
          {days.map((d, i) => {
            const isToday = dateKey(d) === todayKey;
            return (
              <div key={i} style={{ textAlign: "center", padding: "2px 0 8px", fontSize: 11.5, fontWeight: 600, color: isToday ? "var(--accent-ink)" : "var(--ink-2)" }}>
                <div style={{ textTransform: "capitalize" }}>{d.toLocaleDateString("es-AR", { weekday: "short" })}</div>
                <div style={{ fontSize: 14, marginTop: 1 }}>{d.getDate()}</div>
              </div>
            );
          })}

          {/* Eje horario */}
          <div style={{ position: "relative", height: gridH }}>
            {hours.map((h, i) => (
              <div key={h} style={{ position: "absolute", top: i * HOUR - 6, right: 6, fontSize: 10, color: "var(--muted)" }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Columnas por día */}
          {days.map((d, di) => {
            const dk = dateKey(d);
            const evs = inWeek.filter((a) => dateKey(new Date(a.starts_at!)) === dk);
            return (
              <div key={di} style={{ position: "relative", height: gridH, borderLeft: "1px solid var(--hairline)" }}>
                {hours.map((h, i) => (
                  <div key={h} style={{ position: "absolute", top: i * HOUR, left: 0, right: 0, height: 1, background: "var(--hairline)" }} />
                ))}
                {evs.map((a) => {
                  const s = new Date(a.starts_at!);
                  const startMin = s.getHours() * 60 + s.getMinutes();
                  const top = ((startMin - minH * 60) / 60) * HOUR;
                  const height = Math.max(22, (durationOf(a) / 60) * HOUR);
                  const meta = STATUS_META[a.status];
                  return (
                    <button
                      key={a.id}
                      onClick={() => onSelect(a)}
                      title={`${a.customer_name || "Reserva"}${a.service ? " · " + a.service : ""}`}
                      style={{
                        position: "absolute",
                        top,
                        height,
                        left: 2,
                        right: 2,
                        background: meta.bg,
                        color: meta.color,
                        border: "none",
                        borderRadius: 6,
                        padding: "2px 5px",
                        fontSize: 10.5,
                        textAlign: "left",
                        overflow: "hidden",
                        cursor: "pointer",
                        lineHeight: 1.15,
                      }}
                    >
                      <strong>{timeOf(s)}</strong> {a.customer_name || "Reserva"}
                      {a.service ? ` · ${a.service}` : ""}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
