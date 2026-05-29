"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Revela su contenido con un fade + slide-up cuando entra en viewport.
 * Sin dependencias: usa IntersectionObserver. Respeta prefers-reduced-motion
 * (el CSS deja el contenido visible si el usuario reduce el movimiento).
 */
export default function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
  style,
}: {
  children: ReactNode;
  /** Retardo en ms para escalonar entradas. */
  delay?: number;
  as?: "div" | "section";
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Si IntersectionObserver no existe, mostramos directamente.
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${shown ? "in-view" : ""} ${className}`.trim()}
      style={{ transitionDelay: shown && delay ? `${delay}ms` : undefined, ...style }}
    >
      {children}
    </Tag>
  );
}
