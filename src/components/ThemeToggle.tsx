"use client";

import { useTheme, type ThemeChoice } from "./ThemeProvider";
import { Sun, Moon, Monitor } from "./atende/Icons";

const OPTIONS: { value: ThemeChoice; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
  { value: "system", label: "Sistema", Icon: Monitor },
];

/**
 * Control segmentado compacto para el tema. Es deliberadamente discreto:
 * vive como una fila más dentro de Ajustes, no como una sección destacada.
 * `showLabels` agrega el texto al lado del ícono (para layouts más anchos).
 */
export default function ThemeToggle({ showLabels = false }: { showLabels?: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Apariencia"
      style={{
        display: "inline-flex",
        gap: 2,
        background: "var(--surface-2)",
        border: "1px solid var(--hairline)",
        borderRadius: 999,
        padding: 3,
        flexShrink: 0,
      }}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              height: 30,
              minWidth: showLabels ? 0 : 36,
              padding: showLabels ? "0 12px" : 0,
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: active ? "var(--surface-solid)" : "transparent",
              boxShadow: active ? "var(--shadow-1)" : "none",
              color: active ? "var(--ink)" : "var(--muted)",
              fontWeight: 600,
              fontSize: 12,
              fontFamily: "var(--font-sans)",
              transition: "background .15s, color .15s",
            }}
          >
            <Icon size={15} />
            {showLabels && label}
          </button>
        );
      })}
    </div>
  );
}
