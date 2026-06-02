"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "atende-theme";

interface ThemeContextValue {
  /** Elección del usuario: claro, oscuro o sistema. */
  theme: ThemeChoice;
  /** Tema efectivo aplicado (resuelve "system" según el dispositivo). */
  resolved: ResolvedTheme;
  setTheme: (next: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches === true
  );
}

function resolveChoice(choice: ThemeChoice): ResolvedTheme {
  if (choice === "system") return prefersDark() ? "dark" : "light";
  return choice;
}

function applyResolved(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", resolved === "dark" ? "#0f1411" : "#f3f0ea");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  // Hidratar la preferencia guardada al montar (el script no-flash ya pintó el tema).
  useEffect(() => {
    let stored: ThemeChoice = "system";
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark" || saved === "system") {
        stored = saved;
      }
    } catch {
      /* localStorage no disponible */
    }
    const r = resolveChoice(stored);
    setThemeState(stored);
    setResolved(r);
    applyResolved(r);
  }, []);

  // Si la elección es "sistema", seguir los cambios del dispositivo en vivo.
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r: ResolvedTheme = mq.matches ? "dark" : "light";
      setResolved(r);
      applyResolved(r);
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemeChoice) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    const r = resolveChoice(next);
    setResolved(r);
    applyResolved(r);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme debe usarse dentro de <ThemeProvider>.");
  }
  return ctx;
}

/**
 * Script que corre ANTES del primer render para fijar el tema sin parpadeo.
 * Se inyecta en <head> desde el layout raíz.
 */
export const THEME_NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}')||'system';var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var e=(t==='dark')||(t==='system'&&d)?'dark':'light';document.documentElement.setAttribute('data-theme',e);}catch(_){document.documentElement.setAttribute('data-theme','light');}})();`;
