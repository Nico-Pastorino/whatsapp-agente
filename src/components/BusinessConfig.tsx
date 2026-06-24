"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import DashboardContentShell from "./DashboardContentShell";
import TemplateSelector from "./TemplateSelector";
import AssistantTester from "./AssistantTester";
import KnowledgeSourcesSection from "./KnowledgeSourcesSection";
import ScheduleEditor from "./ScheduleEditor";
import { TONE_PRESETS, buildAssistantChecklist, assistantProgress } from "@/lib/onboarding";

interface Profile {
  name: string;
  description: string;
  extra: string;
  quick_replies: string[];
  knowledge_base: string;
  booking_enabled: boolean;
  booking_config: string;
  notify_enabled: boolean;
  notify_phone: string;
  notify_events: string[];
  response_tone: string;
}

const NOTIFY_EVENT_OPTIONS: { key: string; label: string; icon: string }[] = [
  { key: "new_appointment", label: "Nueva reserva / turno", icon: "📅" },
  { key: "appointment_cancelled", label: "Reserva cancelada", icon: "❌" },
  { key: "human_handoff", label: "Cliente pide hablar con una persona", icon: "🙋" },
  { key: "hot_lead", label: "Cliente interesado en comprar o reservar", icon: "🔥" },
  { key: "unanswered", label: "El asistente no supo qué responder", icon: "🤔" },
  { key: "daily_summary", label: "Resumen diario de actividad", icon: "📊" },
];

const DEFAULT_NOTIFY_EVENTS = ["new_appointment", "human_handoff", "hot_lead", "unanswered"];

/** Valida que el número tenga código de país (mínimo 10 dígitos) */
function validateNotifyPhone(raw: string): { valid: boolean; normalized: string; hint: string } {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return { valid: false, normalized: "", hint: "" };
  if (digits.length < 10) {
    return {
      valid: false,
      normalized: digits,
      hint: "Número muy corto. Incluí el código de país (ej: 54 para Argentina).",
    };
  }
  // Argentina: 54 + código de área + número (total 13 dígitos para celular con 9)
  // Colombia: 57..., México: 52..., etc.
  if (digits.startsWith("0")) {
    return {
      valid: false,
      normalized: digits,
      hint: "No uses 0 al inicio. Usá el código de país directo (ej: 54 9 11...).",
    };
  }
  return { valid: true, normalized: digits, hint: "" };
}

const inputClass = "atd-input";

// ── Preguntas frecuentes estructuradas ───────────────────────────────────────
// Se guardan como texto plano "P:/R:" en el campo knowledge_base existente,
// que la IA ya lee junto con la info clave. Sin cambios de esquema.

interface FaqItem {
  q: string;
  a: string;
}

function serializeFaqs(faqs: FaqItem[]): string {
  return faqs
    .filter((f) => f.q.trim() && f.a.trim())
    .map((f) => `P: ${f.q.trim()}\nR: ${f.a.trim()}`)
    .join("\n\n");
}

/** Reglas del negocio → líneas "REGLA: ..." (las lee la IA como obligatorias). */
function serializeRules(rules: string[]): string {
  return rules
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => `REGLA: ${r}`)
    .join("\n\n");
}

/**
 * Parser tolerante de knowledge_base: separa reglas ("REGLA: ..."), FAQs
 * ("P:/R:" o "Pregunta:/Respuesta:") y texto libre legacy. Nada se pierde:
 * lo que no matchea queda como legacy. Sin cambios de esquema.
 */
function parseKnowledge(text: string): { rules: string[]; faqs: FaqItem[]; legacy: string } {
  const rules: string[] = [];
  const faqs: FaqItem[] = [];
  const legacyParts: string[] = [];
  for (const block of (text ?? "").split(/\n\s*\n/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const faqMatch = trimmed.match(/^\s*(?:P|Pregunta)\s*:\s*([\s\S]*?)\n\s*(?:R|Respuesta)\s*:\s*([\s\S]*)$/i);
    if (faqMatch && faqMatch[1].trim() && faqMatch[2].trim()) {
      faqs.push({ q: faqMatch[1].trim(), a: faqMatch[2].trim() });
      continue;
    }
    if (/^\s*REGLA\s*:/i.test(trimmed)) {
      for (const line of trimmed.split(/\n/)) {
        const lm = line.match(/^\s*REGLA\s*:\s*(.+)$/i);
        if (lm && lm[1].trim()) rules.push(lm[1].trim());
      }
      continue;
    }
    legacyParts.push(trimmed);
  }
  return { rules, faqs, legacy: legacyParts.join("\n\n") };
}

const RULE_EXAMPLES = [
  "Aceptamos plan canje desde el iPhone 13 en adelante",
  "No tomamos equipos golpeados ni con piezas cambiadas",
  "Hacemos envíos solo dentro de la ciudad",
  "La seña para reservar es del 50%",
];

// ── Datos frecuentes ESTRUCTURADOS ──────────────────────────────────────────
// Antes era un único textarea libre (engorroso y producía "muros de texto" que
// empeoraban las respuestas de la IA). Ahora son campos guiados que se componen
// y parsean al MISMO campo `extra` (sin cambios de backend).
const PAYMENT_OPTIONS = [
  "Efectivo",
  "Transferencia",
  "Débito",
  "Crédito",
  "Mercado Pago",
  "Cuotas",
  "Dólares (USD)",
];

interface InfoFields {
  horarios: string;
  direccion: string;
  pagos: string[];
  enviosMode: "" | "si" | "no";
  enviosDetalle: string;
  notas: string;
}

const EMPTY_INFO: InfoFields = {
  horarios: "", direccion: "", pagos: [], enviosMode: "", enviosDetalle: "", notas: "",
};

function normalizeKey(input: string): string {
  return input.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** Compone los campos guiados a texto etiquetado para guardar en `extra`. */
function composeInfo(f: InfoFields): string {
  const lines: string[] = [];
  if (f.horarios.trim()) lines.push(`Horarios: ${f.horarios.trim()}`);
  if (f.direccion.trim()) lines.push(`Ubicación: ${f.direccion.trim()}`);
  if (f.pagos.length) lines.push(`Medios de pago: ${f.pagos.join(", ")}`);
  if (f.enviosMode === "si") lines.push(`Envíos: Sí${f.enviosDetalle.trim() ? ` — ${f.enviosDetalle.trim()}` : ""}`);
  else if (f.enviosMode === "no") lines.push("Envíos: No hacemos envíos");
  if (f.notas.trim()) lines.push(f.notas.trim());
  return lines.join("\n");
}

/** Parser tolerante: reconoce las etiquetas conocidas; lo demás va a Notas
 *  (así no se pierde nada del texto libre legacy). */
function parseInfo(extra: string): InfoFields {
  const f: InfoFields = { ...EMPTY_INFO, pagos: [] };
  const notas: string[] = [];
  for (const rawLine of (extra ?? "").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = /^([^:]{2,40}):\s*(.+)$/.exec(line);
    const key = m ? normalizeKey(m[1]) : "";
    const val = m ? m[2].trim() : "";
    if (key === "horarios" || key === "horario") { f.horarios = val; continue; }
    if (key === "ubicacion" || key === "direccion") { f.direccion = val; continue; }
    if (["medios de pago", "metodos de pago", "metodo de pago", "pago", "pagos"].includes(key)) {
      f.pagos = val.split(/[,/]|\sy\s/).map((s) => s.trim()).filter(Boolean);
      continue;
    }
    if (key === "envios" || key === "envio") {
      if (/^no\b|no hacemos/i.test(val)) { f.enviosMode = "no"; }
      else { f.enviosMode = "si"; f.enviosDetalle = val.replace(/^s[ií]\s*[—\-:]*\s*/i, "").trim(); }
      continue;
    }
    notas.push(line);
  }
  f.notas = notas.join("\n");
  return f;
}

function SectionHeader({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <p className="page-sub" style={{ color: "var(--green)", marginBottom: 4 }}>{label}</p>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{title}</h3>
      <p style={{ marginTop: 4, fontSize: 13, color: "var(--ink-3)" }}>{description}</p>
    </div>
  );
}

function AdvancedSummary({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <summary
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        cursor: "pointer",
        listStyle: "none",
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{title}</span>
        <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-3)", marginTop: 3 }}>{description}</span>
      </span>
      <span className="business-disclosure-arrow" aria-hidden="true">⌄</span>
    </summary>
  );
}

// Flag para reactivar la sección de links externos en el dashboard.
// Por defecto oculta: el conocimiento se carga desde el catálogo y los datos del negocio.
const SHOW_EXTERNAL_SOURCES = process.env.NEXT_PUBLIC_ENABLE_EXTERNAL_SOURCES === "true";

function TrainingPriorityGuide() {
  return (
    <section className="business-priority-note">
      <strong>Prioridad:</strong> catálogo → datos frecuentes → preguntas. Si falta algo, el asistente lo consulta en vez de inventar.
    </section>
  );
}

export default function BusinessConfig() {
  const [profile, setProfile] = useState<Profile>({
    name: "",
    description: "",
    extra: "",
    quick_replies: [],
    knowledge_base: "",
    booking_enabled: false,
    booking_config: "",
    notify_enabled: false,
    notify_phone: "",
    notify_events: [],
    response_tone: "",
  });
  const [newReply, setNewReply] = useState("");
  const [showTester, setShowTester] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogCount, setCatalogCount] = useState(0);
  // Reglas del negocio y FAQs (se serializan juntas a knowledge_base al guardar).
  const [rules, setRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState("");
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [faqLegacy, setFaqLegacy] = useState("");
  const [newFaqQ, setNewFaqQ] = useState("");
  const [newFaqA, setNewFaqA] = useState("");
  // Datos frecuentes estructurados (espejo de profile.extra).
  const [info, setInfo] = useState<InfoFields>(EMPTY_INFO);

  const reloadProfile = useCallback(() => {
    fetch("/api/business")
      .then((r) => r.json())
      .then((data) => {
        setProfile({
          name: data.name ?? "",
          description: data.description ?? "",
          extra: data.extra ?? "",
          quick_replies: Array.isArray(data.quick_replies) ? data.quick_replies : [],
          knowledge_base: data.knowledge_base ?? "",
          booking_enabled: Boolean(data.booking_enabled),
          booking_config: data.booking_config ?? "",
          notify_enabled: Boolean(data.notify_enabled),
          notify_phone: data.notify_phone ?? "",
          notify_events: Array.isArray(data.notify_events) ? data.notify_events : [],
          response_tone: typeof data.response_tone === "string" ? data.response_tone : "",
        });
        const parsed = parseKnowledge(data.knowledge_base ?? "");
        setRules(parsed.rules);
        setFaqs(parsed.faqs);
        setFaqLegacy(parsed.legacy);
        setInfo(parseInfo(data.extra ?? ""));
        setLoading(false);
      });
    fetch("/api/business/items", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { count?: number }) => setCatalogCount(data.count ?? 0))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    reloadProfile();
  }, [reloadProfile]);

  const profileIsEmpty = !profile.description && !profile.extra && !profile.knowledge_base;
  // Checklist unificado — misma fuente de verdad que el Centro de control.
  const checklist = buildAssistantChecklist(profile, catalogCount);
  const progress = assistantProgress(checklist);
  const nextStep = checklist.find((item) => !item.done);

  function updateField(field: keyof Profile, value: string) {
    setProfile((p) => ({ ...p, [field]: value }));
    setSaved(false);
  }

  // Actualiza un campo guiado de "Datos frecuentes" y recompone profile.extra
  // (lo que se guarda). Una sola fuente de verdad: el form estructurado.
  function applyInfo(patch: Partial<InfoFields>) {
    const next = { ...info, ...patch };
    setInfo(next);
    setProfile((p) => ({ ...p, extra: composeInfo(next) }));
    setSaved(false);
  }

  function togglePago(option: string) {
    applyInfo({
      pagos: info.pagos.includes(option)
        ? info.pagos.filter((p) => p !== option)
        : [...info.pagos, option],
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    // Reglas + FAQs + texto previo (legacy) componen knowledge_base. Las reglas
    // van primero para que la IA las lea como condiciones obligatorias.
    const knowledgeBase = [serializeRules(rules), serializeFaqs(faqs), faqLegacy.trim()]
      .filter(Boolean)
      .join("\n\n");
    try {
      const res = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profile.name, description: profile.description, extra: profile.extra, quick_replies: profile.quick_replies, knowledge_base: knowledgeBase, booking_enabled: profile.booking_enabled, booking_config: profile.booking_config, notify_enabled: profile.notify_enabled, notify_phone: profile.notify_phone, notify_events: profile.notify_events, response_tone: profile.response_tone }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json().catch(() => null) as { error?: string } | null;
        setSaveError(data?.error ?? "No se pudo guardar. Intentá de nuevo.");
      }
    } catch {
      setSaveError("Error de conexión. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: "var(--bg)" }}>
        <div className="w-8 h-8 rounded-full animate-spin" style={{ border: "4px solid var(--hairline-2)", borderTopColor: "var(--green)" }} />
      </div>
    );
  }

  return (
    <DashboardContentShell maxWidth={960} bottomPadding={220}>

        <div className="page-header">
          <div>
            <div className="page-sub">configuración</div>
            <h1 style={{ fontSize: 24, lineHeight: 1.12, fontWeight: 700, margin: 0, color: "var(--ink)" }}>Mi negocio</h1>
            <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "5px 0 0" }}>
              Cargá lo básico, guardá y probá.
            </p>
          </div>
        </div>

        <div style={{ padding: "0 0 6px" }}>
          <section className="atd-card" style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>Datos del negocio · {progress}% completo</h2>
                <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: "4px 0 0" }}>
                  {nextStep ? `Falta: ${nextStep.label}` : "Listo para probar."}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href={nextStep?.href ?? "#probar-asistente"} className="atd-btn primary sm" style={{ display: "inline-flex", textDecoration: "none" }}>
                  {nextStep ? "Completar" : "Revisar"}
                </a>
                <button type="button" onClick={() => setShowTester(true)} className="atd-btn ghost sm" style={{ display: "inline-flex" }}>
                  Probar
                </button>
              </div>
            </div>
          </section>

        </div>

        <div className="business-desktop-grid">
        {/* Plantillas por Rubro */}
        <div>
          <TemplateSelector
            profileIsEmpty={profileIsEmpty}
            onApplied={reloadProfile}
          />
        </div>

        <TrainingPriorityGuide />

        {/* Información principal */}
        <section id="datos-negocio" className="atd-card wide" style={{ padding: 20 }}>
          <SectionHeader
            label="Básico"
            title="Qué tiene que saber el asistente"
            description="Nombre y descripción del negocio."
          />
          <div className="business-form-grid">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--ink-2)" }}>
                Nombre del negocio
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Ej: Peluquería López, Tienda Ropa Verano..."
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--ink-2)" }}>
                Qué vendés o qué hacés
              </label>
              <textarea
                value={profile.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={3}
                placeholder="Ej: Peluquería con cortes, color y turnos de martes a sábado."
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>
        </section>

        {/* Columna IZQUIERDA: Reglas + Tono (balancea altura con Datos frecuentes) */}
        <div className="business-col">
        <section id="reglas-negocio" className="atd-card" style={{ padding: 20 }}>
          <SectionHeader
            label="Importante"
            title="Reglas del negocio"
            description="Frases simples que el asistente respeta SIEMPRE. Qué aceptás, qué no y tus condiciones."
          />

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const t = newRule.trim();
                  if (t) { setRules((prev) => (prev.includes(t) ? prev : [...prev, t])); setNewRule(""); setSaved(false); }
                }
              }}
              placeholder="Ej: Aceptamos plan canje desde el iPhone 13"
              className={inputClass}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="atd-btn primary sm"
              disabled={!newRule.trim()}
              onClick={() => {
                const t = newRule.trim();
                if (t) { setRules((prev) => (prev.includes(t) ? prev : [...prev, t])); setNewRule(""); setSaved(false); }
              }}
            >
              Agregar
            </button>
          </div>

          {rules.length === 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>Tocá un ejemplo para sumarlo:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {RULE_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => { setRules((prev) => (prev.includes(ex) ? prev : [...prev, ex])); setSaved(false); }}
                    style={{ fontSize: 12, padding: "5px 10px", borderRadius: 999, border: "1px solid var(--hairline-2)", background: "var(--surface-2)", color: "var(--ink-2)", cursor: "pointer" }}
                  >
                    + {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {rules.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rules.map((rule, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "var(--surface-2)" }}>
                  <span aria-hidden="true" style={{ color: "var(--green)", flexShrink: 0, fontWeight: 700 }}>✓</span>
                  <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>{rule}</span>
                  <button
                    type="button"
                    onClick={() => { setRules((prev) => prev.filter((_, j) => j !== i)); setSaved(false); }}
                    aria-label="Eliminar regla"
                    style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--hairline)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", fontSize: 15, lineHeight: 1, flexShrink: 0 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tono — movido a la columna izquierda para balancear con Datos frecuentes */}
        <section id="tono-respuesta" className="atd-card" style={{ padding: 20 }}>
          <SectionHeader
            label="Estilo"
            title="Cómo querés que hable"
            description="Elegí un tono."
          />
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            {TONE_PRESETS.map((tone) => {
              const selected = profile.response_tone === tone.code;
              return (
                <button
                  key={tone.code}
                  type="button"
                  onClick={() => {
                    setProfile((p) => ({ ...p, response_tone: selected ? "" : tone.code }));
                    setSaved(false);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 14px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                    border: `1.5px solid ${selected ? "var(--green)" : "var(--hairline)"}`,
                    background: selected ? "var(--green-tint)" : "var(--surface)",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{tone.emoji}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{tone.label}</span>
                  </span>
                  <span style={{
                    width: 18, height: 18, borderRadius: 999, flexShrink: 0,
                    background: selected ? "var(--green)" : "transparent",
                    border: selected ? "none" : "1.5px solid var(--hairline-2)",
                    color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                  }}>
                    {selected ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        </div>
        {/* Columna DERECHA: Datos frecuentes */}
        <div className="business-col">
        <section id="info-clave" className="atd-card" style={{ padding: 20 }}>
          <SectionHeader
            label="Respuestas"
            title="Datos frecuentes"
            description="Completá lo que te pregunten seguido. El asistente lo responde solo."
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Horarios */}
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>🕒 Horarios de atención</span>
              <input
                value={info.horarios}
                onChange={(e) => applyInfo({ horarios: e.target.value })}
                placeholder="Ej: Lun a Vie de 9 a 18, Sáb de 9 a 13"
                className={inputClass}
              />
            </label>

            {/* Dirección */}
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>📍 Dirección / ubicación</span>
              <input
                value={info.direccion}
                onChange={(e) => applyInfo({ direccion: e.target.value })}
                placeholder="Ej: Av. Siempre Viva 742, Springfield"
                className={inputClass}
              />
            </label>

            {/* Medios de pago (chips) */}
            <div>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>💳 Medios de pago</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Array.from(new Set([...PAYMENT_OPTIONS, ...info.pagos])).map((opt) => {
                  const on = info.pagos.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => togglePago(opt)}
                      aria-pressed={on}
                      style={{
                        fontSize: 13, padding: "8px 14px", borderRadius: 999, cursor: "pointer",
                        border: `1.5px solid ${on ? "var(--green)" : "var(--hairline-2)"}`,
                        background: on ? "var(--green-tint)" : "var(--surface-2)",
                        color: on ? "var(--green-ink)" : "var(--ink-2)",
                        fontWeight: on ? 600 : 400,
                      }}
                    >
                      {on ? "✓ " : ""}{opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Envíos */}
            <div>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>🚚 ¿Hacés envíos?</span>
              <div className="atd-seg" style={{ maxWidth: 240 }}>
                <button type="button" className={info.enviosMode === "si" ? "on" : ""} style={{ flex: 1, justifyContent: "center" }} onClick={() => applyInfo({ enviosMode: "si" })}>Sí</button>
                <button type="button" className={info.enviosMode === "no" ? "on" : ""} style={{ flex: 1, justifyContent: "center" }} onClick={() => applyInfo({ enviosMode: "no", enviosDetalle: "" })}>No</button>
              </div>
              {info.enviosMode === "si" && (
                <input
                  value={info.enviosDetalle}
                  onChange={(e) => applyInfo({ enviosDetalle: e.target.value })}
                  placeholder="Zona y costo. Ej: CABA $2000, interior por correo"
                  className={inputClass}
                  style={{ marginTop: 8 }}
                />
              )}
            </div>

            {/* Notas / otra info */}
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>📝 Otra info útil <span style={{ color: "var(--muted)", fontWeight: 400 }}>(opcional)</span></span>
              <textarea
                value={info.notas}
                onChange={(e) => applyInfo({ notas: e.target.value })}
                rows={3}
                placeholder="Garantía, qué incluye, aclaraciones… lo que no entre arriba."
                className={`${inputClass} resize-none`}
              />
            </label>
          </div>

          <div className="business-quick-links">
            <Link href="/app/catalog" className="business-quick-link">
              <span>Catálogo</span>
              <small>{catalogCount > 0 ? `${catalogCount} cargados` : "Agregar productos o servicios"}</small>
            </Link>
            <button type="button" onClick={() => setShowTester(true)} className="business-quick-link">
              <span>Probar asistente</span>
              <small>Ver cómo responde antes de activar</small>
            </button>
          </div>
        </section>

        {SHOW_EXTERNAL_SOURCES && (
          <section id="fuentes-externas" className="atd-card" style={{ padding: 20 }}>
            <SectionHeader
              label="Avanzado"
              title="Link externo"
              description="Planilla con precios y stock (opcional)."
            />
            <KnowledgeSourcesSection />
          </section>
        )}
        </div>

        <details className="atd-card business-advanced-card wide" style={{ padding: 20 }}>
          <AdvancedSummary
            title="Opciones avanzadas"
            description="Preguntas frecuentes, reservas, avisos y respuestas del equipo."
          />
          <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
            <section id="preguntas-frecuentes" className="business-nested-section">
              <SectionHeader
                label="Opcional"
                title="Preguntas frecuentes"
                description="Sumá preguntas exactas si querés respuestas más controladas."
              />

            {faqs.map((faq, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10, padding: 12, borderRadius: 12, background: "var(--surface-2)" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <input
                    value={faq.q}
                    onChange={(e) => {
                      setFaqs((prev) => prev.map((f, j) => (j === i ? { ...f, q: e.target.value } : f)));
                      setSaved(false);
                    }}
                    placeholder="Pregunta"
                    className={inputClass}
                    style={{ fontWeight: 600 }}
                  />
                  <textarea
                    value={faq.a}
                    onChange={(e) => {
                      setFaqs((prev) => prev.map((f, j) => (j === i ? { ...f, a: e.target.value } : f)));
                      setSaved(false);
                    }}
                    placeholder="Respuesta real"
                    rows={2}
                    className={`${inputClass} resize-none`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFaqs((prev) => prev.filter((_, j) => j !== i));
                    setSaved(false);
                  }}
                  aria-label="Eliminar pregunta"
                  style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--hairline)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", fontSize: 16, lineHeight: 1, flexShrink: 0 }}
                >
                  ×
                </button>
              </div>
            ))}

            {/* Alta de nueva FAQ */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 12, borderRadius: 12, border: "1px dashed var(--hairline-2)" }}>
              <input
                value={newFaqQ}
                onChange={(e) => setNewFaqQ(e.target.value)}
                placeholder='Ej: "¿Hacen envíos?"'
                className={inputClass}
              />
              <textarea
                value={newFaqA}
                onChange={(e) => setNewFaqA(e.target.value)}
                placeholder='Ej: "Sí, a todo el país por correo. CABA en el día."'
                rows={2}
                className={`${inputClass} resize-none`}
              />
              <button
                type="button"
                disabled={!newFaqQ.trim() || !newFaqA.trim()}
                onClick={() => {
                  setFaqs((prev) => [...prev, { q: newFaqQ.trim(), a: newFaqA.trim() }]);
                  setNewFaqQ("");
                  setNewFaqA("");
                  setSaved(false);
                }}
                className="atd-btn green sm"
                style={{ alignSelf: "flex-start", opacity: !newFaqQ.trim() || !newFaqA.trim() ? 0.5 : 1 }}
              >
                + Agregar pregunta
              </button>
            </div>

            {/* Contenido previo no estructurado (legacy) */}
            {faqLegacy && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 6px" }}>
                  Contenido anterior (también lo usa tu asistente; podés moverlo a preguntas o borrarlo):
                </p>
                <textarea
                  value={faqLegacy}
                  onChange={(e) => {
                    setFaqLegacy(e.target.value);
                    setSaved(false);
                  }}
                  rows={4}
                  className={`${inputClass} resize-none`}
                />
              </div>
            )}
            </section>

        <section id="turnos-reservas" className="business-nested-section">
          <div className="mb-4 flex items-start justify-between gap-4">
            <SectionHeader
              label="Opcional"
              title="Reservas / Turnos"
              description="Activá esto solo si querés que el asistente tome solicitudes de reserva."
            />
            <button
              type="button"
              role="switch"
              aria-checked={profile.booking_enabled}
              onClick={() => {
                setProfile((p) => ({ ...p, booking_enabled: !p.booking_enabled }));
                setSaved(false);
              }}
              style={{
                flexShrink: 0,
                width: 46,
                height: 26,
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                padding: 3,
                background: profile.booking_enabled ? "var(--green)" : "var(--hairline)",
                transition: "background .18s ease",
                display: "flex",
                justifyContent: profile.booking_enabled ? "flex-end" : "flex-start",
              }}
            >
              <span style={{ width: 20, height: 20, borderRadius: 999, background: "#fff", display: "block", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
            </button>
          </div>
          {profile.booking_enabled && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <ScheduleEditor />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Notas adicionales para el asistente</span>
                <span style={{ fontSize: 12, color: "var(--muted, #888)" }}>
                  Servicios, precios, seña y condiciones. El horario de arriba es la fuente de verdad de la disponibilidad.
                </span>
                <textarea
                  value={profile.booking_config}
                  onChange={(e) => updateField("booking_config", e.target.value)}
                  rows={5}
                  placeholder={`Ej:\nServicios: corte ($8.000, 45 min), color ($20.000, 2 hs)\nSeña: pedimos transferencia del 50% para confirmar.`}
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>
          )}
        </section>

        <section id="avisos-encargado" className="business-nested-section">
          <div className="mb-4 flex items-start justify-between gap-4">
            <SectionHeader
              label="Opcional"
              title="Avisos al equipo"
              description="Recibí avisos por WhatsApp cuando haya consultas importantes."
            />
            <button
              type="button"
              role="switch"
              aria-checked={profile.notify_enabled}
              onClick={() => {
                setProfile((p) => ({
                  ...p,
                  notify_enabled: !p.notify_enabled,
                  notify_events: !p.notify_enabled && p.notify_events.length === 0
                    ? DEFAULT_NOTIFY_EVENTS
                    : p.notify_events,
                }));
                setSaved(false);
              }}
              style={{
                flexShrink: 0,
                width: 46,
                height: 26,
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                padding: 3,
                background: profile.notify_enabled ? "var(--green)" : "var(--hairline)",
                transition: "background .18s ease",
                display: "flex",
                justifyContent: profile.notify_enabled ? "flex-end" : "flex-start",
              }}
            >
              <span style={{ width: 20, height: 20, borderRadius: 999, background: "#fff", display: "block", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
            </button>
          </div>
          {profile.notify_enabled && (() => {
            const phoneValidation = validateNotifyPhone(profile.notify_phone);
            return (
              <>
                {/* Phone number */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
                    Número de WhatsApp para avisos
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      value={profile.notify_phone}
                      onChange={(e) => { updateField("notify_phone", e.target.value); setSaved(false); }}
                      placeholder="5491151234567"
                      className={inputClass}
                      inputMode="tel"
                      style={{
                        paddingRight: 36,
                        borderColor: profile.notify_phone && !phoneValidation.valid
                          ? "var(--danger-border)"
                          : profile.notify_phone && phoneValidation.valid
                          ? "var(--green)"
                          : undefined,
                      }}
                    />
                    {profile.notify_phone && (
                      <span
                        style={{
                          position: "absolute",
                          right: 12,
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: 14,
                        }}
                      >
                        {phoneValidation.valid ? "✅" : "⚠️"}
                      </span>
                    )}
                  </div>

                  {/* Format guidance */}
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-3)" }}>
                    {phoneValidation.hint ? (
                      <span style={{ color: "#b45309" }}>⚠️ {phoneValidation.hint}</span>
                    ) : (
                      <span>
                        Solo dígitos, con código de país.{" "}
                        <strong>Argentina:</strong> 5491151234567 · <strong>México:</strong> 521234567890 · <strong>Colombia:</strong> 573001234567
                      </span>
                    )}
                  </div>

                {/* Phone preview */}
                  {phoneValidation.valid && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "var(--green-tint)",
                        border: "1px solid var(--green)",
                        fontSize: 12,
                        color: "var(--green)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      ✓ Los avisos se enviarán a WhatsApp:{" "}
                      <strong>+{phoneValidation.normalized}</strong>
                    </div>
                  )}
                </div>

                {/* Events */}
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>
                  ¿Qué eventos querés recibir?
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {NOTIFY_EVENT_OPTIONS.map((opt) => {
                    const checked = profile.notify_events.includes(opt.key);
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setProfile((p) => ({
                            ...p,
                            notify_events: checked
                              ? p.notify_events.filter((e) => e !== opt.key)
                              : [...p.notify_events, opt.key],
                          }));
                          setSaved(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "12px 14px",
                          borderRadius: 12,
                          cursor: "pointer",
                          textAlign: "left",
                          border: `1px solid ${checked ? "var(--green)" : "var(--hairline)"}`,
                          background: checked ? "var(--green-tint)" : "var(--surface)",
                          transition: "border-color 0.15s, background 0.15s",
                        }}
                      >
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{opt.icon}</span>
                        <span style={{ fontSize: 13, color: "var(--ink-2)", flex: 1 }}>{opt.label}</span>
                        <span
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 6,
                            flexShrink: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: checked ? "var(--green)" : "transparent",
                            border: checked ? "none" : "1.5px solid var(--hairline-2)",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {checked ? "✓" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Important note */}
                <div
                  style={{
                    marginTop: 14,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "var(--surface-2)",
                    fontSize: 12,
                    color: "var(--ink-3)",
                    lineHeight: 1.5,
                  }}
                >
                  Las alertas se envían por WhatsApp al número que configuraste.
                </div>
              </>
            );
          })()}
        </section>

        <section id="respuestas-rapidas" className="business-nested-section">
          <SectionHeader
            label="Opcional"
            title="Respuestas rápidas"
            description="Frases para el equipo cuando una persona toma el control de un chat."
          />

          {/* Lista de respuestas cargadas */}
          {profile.quick_replies.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {profile.quick_replies.map((reply, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 20,
                  background: "var(--surface-2)", border: "1px solid var(--hairline)",
                  fontSize: 13, color: "var(--ink)",
                }}>
                  <span style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {reply}
                  </span>
                  <button
                    onClick={() => setProfile((p) => ({ ...p, quick_replies: p.quick_replies.filter((_, j) => j !== i) }))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0, lineHeight: 1, fontSize: 15 }}
                    title="Eliminar"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {/* Input para agregar nueva respuesta */}
          {profile.quick_replies.length < 10 && (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={newReply}
                onChange={(e) => setNewReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newReply.trim()) {
                    setProfile((p) => ({ ...p, quick_replies: [...p.quick_replies, newReply.trim()] }));
                    setNewReply("");
                  }
                }}
                placeholder='Ej: "Ahora te llamo", "Confirmado, te esperamos", "¡Muchas gracias!"'
                maxLength={120}
                className={inputClass}
                style={{ flex: 1 }}
              />
              <button
                onClick={() => {
                  if (!newReply.trim()) return;
                  setProfile((p) => ({ ...p, quick_replies: [...p.quick_replies, newReply.trim()] }));
                  setNewReply("");
                }}
                disabled={!newReply.trim()}
                className="atd-btn primary sm"
              >
                Agregar
              </button>
            </div>
          )}
          {profile.quick_replies.length >= 10 && (
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Máximo 10 respuestas rápidas.</p>
          )}
          {profile.quick_replies.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              Todavía no hay respuestas rápidas. Agregá frases frecuentes de tu equipo.
            </p>
          )}
        </section>
          </div>
        </details>

        <section id="probar-asistente" className="atd-card wide" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <SectionHeader
              label="Prueba"
              title="Probá cómo responde"
              description="Guardá cambios y abrí una conversación de prueba con la configuración actual."
            />
            <button type="button" onClick={() => setShowTester(true)} className="atd-btn primary" style={{ flexShrink: 0 }}>
              Probar asistente
            </button>
          </div>
        </section>
        </div>

        <div className="business-save-dock" role="status" aria-live="polite">
          <span className={`business-save-state ${saveError ? "error" : saved ? "ok" : ""}`}>
            {saveError || (saved ? "Guardado" : saving ? "Sincronizando" : "Mi negocio")}
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="liquid-action primary business-save-button"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>

        {showTester && <AssistantTester onClose={() => setShowTester(false)} />}

    </DashboardContentShell>
  );
}
