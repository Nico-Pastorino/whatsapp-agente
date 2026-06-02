"use client";

import { useTheme, type ThemeChoice } from "./ThemeProvider";

const OPTIONS: { value: ThemeChoice; label: string; icon: string }[] = [
  { value: "light", label: "Claro", icon: "☀️" },
  { value: "dark", label: "Oscuro", icon: "🌙" },
  { value: "system", label: "Sistema", icon: "🖥️" },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Apariencia"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 6,
        background: "var(--surface-2)",
        border: "1px solid var(--hairline)",
        borderRadius: 14,
        padding: 4,
      }}
    >
      {OPTIONS.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(opt.value)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              minHeight: 56,
              padding: "8px 6px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              background: active ? "var(--surface)" : "transparent",
              boxShadow: active ? "var(--shadow-1)" : "none",
              color: active ? "var(--ink)" : "var(--ink-3)",
              fontWeight: active ? 600 : 400,
              fontSize: 12.5,
              fontFamily: "var(--font-sans)",
              transition: "background .15s, color .15s",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{opt.icon}</span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
