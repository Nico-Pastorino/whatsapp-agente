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

        {/* Encabezado */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Mi Negocio</h2>
          <p className="text-sm text-gray-500 mt-1">
            La IA usará esta información para responder consultas de clientes sobre
            productos, precios y reservas.
          </p>
        </div>

        {/* Datos generales */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Datos generales
          </h3>

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
        </section>

        {/* Catálogo */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Catálogo de productos / servicios
            </h3>
            <button
              onClick={addProduct}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
            >
              + Agregar
            </button>
          </div>

          {profile.products.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
              <p className="text-sm text-gray-500">
                No hay productos/servicios cargados.
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
                        onChange={(e) =>
                          updateProduct(index, "name", e.target.value)
                        }
                        placeholder="Nombre del producto/servicio *"
                        className={inputInlineClass}
                      />
                      <input
                        type="text"
                        value={product.price}
                        onChange={(e) =>
                          updateProduct(index, "price", e.target.value)
                        }
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
                      onChange={(e) =>
                        updateProduct(index, "description", e.target.value)
                      }
                      placeholder="Descripción breve (opcional)"
                      className={inputClass}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Info extra */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Información adicional
          </h3>
          <p className="text-xs text-gray-500">
            Horarios, ubicación, métodos de pago, instrucciones para reservar, etc.
          </p>
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
