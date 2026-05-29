"use client";

import { useState } from "react";

const FAQ = [
  {
    q: "¿Tengo que conectar WhatsApp para probar?",
    a: "No. Podés probar la demo de acá arriba sin registrarte y sin conectar nada. Cuando quieras, creás tu cuenta y conectás WhatsApp en un par de minutos.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí, cancelás cuando quieras, sin compromiso ni permanencia. No hay letra chica.",
  },
  {
    q: "¿Pierdo mis datos si cancelo?",
    a: "No. Tus conversaciones y la info de tu negocio no se borran automáticamente al cancelar.",
  },
  {
    q: "¿Necesito saber de tecnología o de IA?",
    a: "Para nada. Configurás tu negocio con textos simples, como si le explicaras a un empleado nuevo. El asistente se encarga del resto.",
  },
  {
    q: "¿La IA responde sola todo el tiempo?",
    a: "Vos decidís. La IA responde por defecto, pero podés tomar el control de cualquier conversación cuando quieras y la IA se detiene.",
  },
];

export default function Objections() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {FAQ.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.q}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--hairline)",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                padding: "18px 20px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "var(--font-sans)",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", lineHeight: 1.4 }}>
                {item.q}
              </span>
              <span
                className={`lp-acc-ic ${isOpen ? "open" : ""}`}
                style={{
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent)",
                  fontSize: 22,
                  lineHeight: 1,
                }}
              >
                +
              </span>
            </button>
            <div className={`lp-acc-body ${isOpen ? "open" : ""}`}>
              <div>
                <p style={{ margin: 0, padding: "0 20px 18px", fontSize: 14, color: "var(--ink-3)", lineHeight: 1.6 }}>
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
