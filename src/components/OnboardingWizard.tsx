"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ModalPortal from "./ModalPortal";

// Onboarding guiado de 3 pasos para que un comerciante deje el bot listo rápido:
//  1) Elegí tu rubro  → aplica una plantilla que precarga tono, textos y REGLAS de ejemplo.
//  2) Cargá 1 producto → para que el asistente tenga algo que vender.
//  3) Listo           → lo mandamos a revisar/editar sus reglas.
// Es opcional y se puede saltar. No reemplaza la configuración avanzada.

const RUBROS: { id: string; emoji: string; label: string }[] = [
  { id: "tech_store", emoji: "📱", label: "Celulares / Tecnología" },
  { id: "clothing", emoji: "👕", label: "Indumentaria" },
  { id: "restaurant", emoji: "🍽️", label: "Comida / Delivery" },
  { id: "hair_salon", emoji: "✂️", label: "Peluquería / Estética" },
  { id: "gym", emoji: "💪", label: "Gimnasio" },
  { id: "general", emoji: "🚀", label: "Otro rubro" },
];

export default function OnboardingWizard({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rubro, setRubro] = useState<string | null>(null);
  const [prodName, setProdName] = useState("");
  const [prodPrice, setProdPrice] = useState("");

  async function applyRubro(id: string) {
    setRubro(id);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/business/apply-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: id, mode: "merge" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se pudo aplicar el rubro. Probá de nuevo.");
        return;
      }
      setStep(2);
    } catch {
      setError("Error de conexión. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProduct() {
    if (!prodName.trim()) { setStep(3); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/business/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_type: "product", name: prodName.trim(), price: prodPrice.trim() || null, is_active: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se pudo guardar el producto.");
        return;
      }
      setStep(3);
    } catch {
      setError("Error de conexión. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalPortal>
    <div className="atd-overlay" style={{ zIndex: 170 }} onClick={() => !busy && onClose()}>
      <div className="atd-modal" style={{ width: "min(94vw, 460px)", maxHeight: "90svh", overflow: "auto", padding: 22 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span className="page-sub">Configurá tu asistente · paso {step} de 3</span>
          <button onClick={onClose} disabled={busy} aria-label="Cerrar" style={{ fontSize: 20, lineHeight: 1, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>×</button>
        </div>

        {/* Barra de progreso */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ flex: 1, height: 5, borderRadius: 999, background: n <= step ? "var(--green)" : "var(--surface-2)" }} />
          ))}
        </div>

        {step === 1 && (
          <>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>¿De qué es tu negocio?</h3>
            <p style={{ margin: "6px 0 16px", fontSize: 13.5, color: "var(--ink-3)" }}>
              Elegí tu rubro y te dejamos cargadas reglas y respuestas de ejemplo para editar. Es la forma más rápida de arrancar.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {RUBROS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={busy}
                  onClick={() => applyRubro(r.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "14px 12px", borderRadius: 12,
                    border: `1.5px solid ${rubro === r.id ? "var(--green)" : "var(--hairline)"}`,
                    background: rubro === r.id ? "var(--green-tint)" : "var(--surface)", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{r.emoji}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{r.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>Cargá tu primer producto</h3>
            <p style={{ margin: "6px 0 16px", fontSize: 13.5, color: "var(--ink-3)" }}>
              Con esto el asistente ya puede responder precios. Después sumás todos los que quieras (o importás un Excel).
            </p>
            <input value={prodName} onChange={(e) => setProdName(e.target.value)} placeholder="Nombre (ej: iPhone 13 128GB)" className="atd-input" style={{ marginBottom: 8 }} />
            <input value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} placeholder="Precio (ej: $650.000)" className="atd-input" />
          </>
        )}

        {step === 3 && (
          <>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>¡Listo para probar! 🎉</h3>
            <p style={{ margin: "6px 0 16px", fontSize: 13.5, color: "var(--ink-3)" }}>
              Ya quedaron cargadas reglas de ejemplo de tu rubro. Revisalas y editalas con tus valores reales (precios, condiciones, qué aceptás y qué no) para que el asistente responda exacto.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="atd-btn primary" onClick={() => { onClose(); router.push("/app/business#reglas-negocio"); }}>
                Revisar mis reglas
              </button>
              <button className="atd-btn secondary" onClick={() => { onClose(); router.push("/app/business#probar-asistente"); }}>
                Probar el asistente
              </button>
            </div>
          </>
        )}

        {error && <p role="alert" style={{ marginTop: 12, fontSize: 13, color: "var(--danger-ink)" }}>{error}</p>}

        {step < 3 && (
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            {step === 2 && (
              <button className="atd-btn secondary" style={{ flex: 1 }} disabled={busy} onClick={() => setStep(3)}>
                Lo hago después
              </button>
            )}
            {step === 2 && (
              <button className="atd-btn primary" style={{ flex: 1 }} disabled={busy} onClick={saveProduct}>
                {busy ? "Guardando…" : "Continuar"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}
