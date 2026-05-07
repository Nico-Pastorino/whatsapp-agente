"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import TemplateSelector from "./TemplateSelector";

interface Profile {
  name: string;
  description: string;
  extra: string;
}

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400";

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
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">{label}</p>
      <h3 className="mt-1 text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  );
}

export default function BusinessConfig() {
  const [profile, setProfile] = useState<Profile>({
    name: "",
    description: "",
    extra: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const reloadProfile = useCallback(() => {
    fetch("/api/business")
      .then((r) => r.json())
      .then((data) => {
        setProfile({
          name: data.name ?? "",
          description: data.description ?? "",
          extra: data.extra ?? "",
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
    await fetch("/api/business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: profile.name, description: profile.description, extra: profile.extra }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

        {/* Encabezado */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
            Configuración
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-gray-900">Mi Negocio</h2>
          <p className="mt-2 text-sm text-gray-500">
            Toda la información que cargues acá es usada por la IA para responder consultas de
            clientes de forma precisa y contextual.
          </p>
        </div>

        {/* Plantillas por Rubro */}
        <TemplateSelector
          profileIsEmpty={profileIsEmpty}
          onApplied={reloadProfile}
        />

        {/* Sección 1: Identidad del negocio */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <SectionHeader
            label="Sección 1"
            title="Identidad del negocio"
            description="El nombre y la descripción definen quién sos y qué hacés. Son lo primero que la IA usa para presentarse al cliente."
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
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <SectionHeader
            label="Sección 2"
            title="Catálogo de productos y servicios"
            description="Gestioná lo que vendés desde la sección dedicada. La IA usa esa información para responder consultas sobre precios, stock y disponibilidad."
          />
          <Link
            href="/app/catalog"
            className="flex items-center justify-between p-4 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors group"
          >
            <div>
              <p className="text-sm font-semibold text-emerald-800">Ir al Catálogo</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Agregá productos y servicios con categoría, precio, stock y más.
              </p>
            </div>
            <span className="text-emerald-500 group-hover:translate-x-1 transition-transform text-lg">→</span>
          </Link>
        </section>

        {/* Sección 3: Instrucciones adicionales */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
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

        {/* Botón guardar */}
        <div className="flex items-center justify-end gap-3 pb-4">
          {saved && (
            <span className="text-sm text-emerald-600 font-medium">
              Guardado correctamente
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>

      </div>
    </div>
  );
}
