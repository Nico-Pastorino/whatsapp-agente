"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renderiza a `document.body` vía React Portal para que los overlays/sheets
 * (`.atd-overlay`) escapen de cualquier contexto de apilamiento creado por
 * contenedores con transform/filter/backdrop-filter (p. ej. `.liquid-container`
 * o `.liquid-card`). Así el overlay siempre queda por encima del tabbar mobile
 * (`.atd-tabbar`, z-index 60) y de cualquier otra capa.
 *
 * Solo es presentación: no toca lógica de negocio.
 */
export default function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(children, document.body);
}
