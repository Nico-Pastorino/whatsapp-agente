"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import DashboardContentShell from "./DashboardContentShell";
import TemplateSelector from "./TemplateSelector";

interface Profile {
  name: string;
  description: string;
  extra: string;
  quick_replies: string[];
}

const inputClass = "atd-input";

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

export default function BusinessConfig() {
  const [profile, setProfile] = useState<Profile>({
    name: "",
    description: "",
    extra: "",
    quick_replies: [],
  });
  const [newReply, setNewReply] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadProfile = useCallback(() => {
    fetch("/api/business")
      .then((r) => r.json())
      .then((data) => {
        setProfile({
          name: data.name ?? "",
          description: data.description ?? "",
          extra: data.extra ?? "",
          quick_replies: Array.isArray(data.quick_replies) ? data.quick_replies : [],
        });
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    reloadProfile();
  }, [reloadProfile]);

  const profileIsEmpty = !profile.description && !profile.extra;

  function updateField(field: keyof Profile, value: string) {
    setProfile((p) => ({ ...p, [field]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profile.name, description: profile.description, extra: profile.extra, quick_replies: profile.quick_replies }),
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
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <DashboardContentShell maxWidth={1180}>

        <div className="page-header">
          <div>
            <div className="page-sub">01 · configuración</div>
            <h1 className="page-title">Mi negocio</h1>
          </div>
        </div>

        <div style={{ padding: "0 20px 6px", fontSize: 13, color: "var(--ink-3)" }}>
          La información que cargues acá es usada por la IA para responder consultas de clientes.
        </div>

        {/* Plantillas por Rubro */}
        <TemplateSelector
          profileIsEmpty={profileIsEmpty}
          onApplied={reloadProfile}
        />

        {/* Sección 1: Identidad del negocio */}
        <section className="atd-card" style={{ margin: "12px 20px 0", padding: 20 }}>
          <SectionHeader
            label="Sección 1"
            title="Identidad del negocio"
            description="El nombre y la descripción definen quién sos y qué hacés."
          />
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción del negocio
              </label>
              <textarea
                value={profile.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={3}
                placeholder="Ej: Somos una peluquería con más de 10 años de experiencia, especializada en cortes modernos y coloración..."
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>
        </section>

        {/* Sección 2: Catálogo → link al nuevo módulo */}
        <section className="atd-card" style={{ margin: "12px 20px 0", padding: 20 }}>
          <SectionHeader
            label="Sección 2"
            title="Catálogo de productos y servicios"
            description="Gestioná lo que vendés desde la sección dedicada. La IA usa esa información para responder consultas sobre precios, stock y disponibilidad."
          />
          <Link
            href="/app/catalog"
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: 16, borderRadius: 12, border: "1px solid var(--green)",
              background: "var(--green-tint)", textDecoration: "none",
            }}
          >
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--green)", margin: 0 }}>Ir al Catálogo</p>
              <p style={{ fontSize: 12, color: "var(--green)", opacity: 0.8, marginTop: 2 }}>
                Agregá productos y servicios con categoría, precio, stock y más.
              </p>
            </div>
            <span style={{ color: "var(--green)", fontSize: 18 }}>→</span>
          </Link>
        </section>

        {/* Sección 3: Instrucciones adicionales */}
        <section className="atd-card" style={{ margin: "12px 20px 0", padding: 20 }}>
          <SectionHeader
            label="Sección 3"
            title="Instrucciones adicionales"
            description="Horarios, ubicación, métodos de pago, cómo reservar, condiciones especiales. Todo lo que no entra en el catálogo pero el cliente puede preguntar."
          />
          <textarea
            value={profile.extra}
            onChange={(e) => updateField("extra", e.target.value)}
            rows={5}
            placeholder={`Ej:\nHorario: Lunes a Viernes 9:00 a 18:00 / Sábados 9:00 a 13:00\nUbicación: Av. Siempre Viva 742, Buenos Aires\nMétodos de pago: Efectivo, transferencia, tarjeta\nPara reservar: enviá tu nombre, fecha y hora deseada`}
            className={`${inputClass} resize-none`}
          />
        </section>

        {/* Sección 4: Respuestas rápidas */}
        <section className="atd-card" style={{ margin: "12px 20px 0", padding: 20 }}>
          <SectionHeader
            label="Sección 4"
            title="Respuestas rápidas"
            description="Frases predefinidas que aparecen como chips cuando un integrante del equipo toma el control de una conversación. Clic para insertar en el mensaje."
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

        {/* Botón guardar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, padding: "16px 20px" }}>
          {saved && (
            <span style={{ fontSize: 13, color: "var(--green)", fontWeight: 500 }}>
              Guardado correctamente
            </span>
          )}
          {saveError && (
            <span style={{ fontSize: 13, color: "#c0392b", fontWeight: 500 }}>
              {saveError}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="atd-btn primary"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>

    </DashboardContentShell>
  );
}
