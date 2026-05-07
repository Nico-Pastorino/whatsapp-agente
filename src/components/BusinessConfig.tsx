"use client";

import { useEffect, useState } from "react";

interface Product {
  name: string;
  price: string;
  description: string;
}

interface Profile {
  name: string;
  description: string;
  products: Product[];
  extra: string;
}

const EMPTY_PRODUCT = (): Product => ({ name: "", price: "", description: "" });

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400";

const inputInlineClass =
  "border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400";

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
    products: [],
    extra: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/business")
      .then((r) => r.json())
      .then((data) => {
        setProfile({
          name: data.name ?? "",
          description: data.description ?? "",
          products:
            Array.isArray(data.products) && data.products.length > 0
              ? data.products
              : [],
          extra: data.extra ?? "",
        });
        setLoading(false);
      });
  }, []);

  function updateField(field: keyof Omit<Profile, "products">, value: string) {
    setProfile((p) => ({ ...p, [field]: value }));
    setSaved(false);
  }

  function addProduct() {
    setProfile((p) => ({ ...p, products: [...p.products, EMPTY_PRODUCT()] }));
    setSaved(false);
  }

  function updateProduct(index: number, field: keyof Product, value: string) {
    setProfile((p) => {
      const products = p.products.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      );
      return { ...p, products };
    });
    setSaved(false);
  }

  function removeProduct(index: number) {
    setProfile((p) => ({
      ...p,
      products: p.products.filter((_, i) => i !== index),
    }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    await fetch("/api/business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
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

        {/* ── Encabezado ── */}
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

        {/* ── Sección 1: Identidad del negocio ── */}
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

        {/* ── Sección 2: Catálogo de productos / servicios ── */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <SectionHeader
              label="Sección 2"
              title="Catálogo de productos / servicios"
              description="Cada item que cargues (nombre, precio y descripción) aparece en las respuestas de la IA cuando un cliente pregunta qué ofrecés o cuánto sale."
            />
            <button
              onClick={addProduct}
              className="shrink-0 text-sm text-emerald-600 hover:text-emerald-700 font-medium px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
            >
              + Agregar
            </button>
          </div>

          {profile.products.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
              <p className="text-sm text-gray-500">
                No hay productos o servicios cargados.
              </p>
              <button
                onClick={addProduct}
                className="mt-2 text-sm text-emerald-600 hover:underline"
              >
                Agregar el primero
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {profile.products.map((product, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-500 w-6 text-center shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={product.name}
                        onChange={(e) => updateProduct(index, "name", e.target.value)}
                        placeholder="Nombre del producto/servicio *"
                        className={inputInlineClass}
                      />
                      <input
                        type="text"
                        value={product.price}
                        onChange={(e) => updateProduct(index, "price", e.target.value)}
                        placeholder="Precio (ej: $5000 / $50 USD)"
                        className={inputInlineClass}
                      />
                    </div>
                    <button
                      onClick={() => removeProduct(index)}
                      className="text-gray-400 hover:text-red-500 transition-colors text-xl leading-none shrink-0"
                      title="Eliminar"
                    >
                      ×
                    </button>
                  </div>
                  <div className="pl-9">
                    <input
                      type="text"
                      value={product.description}
                      onChange={(e) => updateProduct(index, "description", e.target.value)}
                      placeholder="Descripción breve (opcional)"
                      className={inputClass}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Sección 3: Instrucciones adicionales ── */}
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

        {/* ── Próximas secciones (placeholder, sin funcionalidad todavía) ── */}
        <section className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 opacity-50">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
            Próximamente
          </p>
          <h3 className="mt-1 text-base font-semibold text-gray-500">
            Personalización avanzada del asistente
          </h3>
          <p className="mt-1 text-sm text-gray-400">
            Tono de respuesta, plantillas por rubro, preguntas frecuentes y entrenamiento con
            conversaciones reales. Disponible en una próxima versión.
          </p>
        </section>

        {/* ── Botón guardar ── */}
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
