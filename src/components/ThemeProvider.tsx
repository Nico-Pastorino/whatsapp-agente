"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "atende-theme";

/** El tema solo aplica dentro de la app (/app/...). La landing y el login
 *  quedan siempre con su apariencia original (clara). */
function isAppPath(pathname: string | null | undefined): boolean {
  return !!pathname && (pathname === "/app" || pathname.startsWith("/app/"));
}

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

/** Aplica el tema solo si estamos dentro de la app; fuera, fuerza la apariencia
 *  clara original (quita data-theme) para que la landing/login no cambien. */
function applyTheme(resolved: ResolvedTheme, inApp: boolean): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (inApp) {
    html.setAttribute("data-theme", resolved);
    if (meta) meta.setAttribute("content", resolved === "dark" ? "#0f1411" : "#f3f0ea");
  } else {
    html.removeAttribute("data-theme");
    if (meta) meta.setAttribute("content", "#f3f0ea");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
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
    setThemeState(stored);
    setResolved(resolveChoice(stored));
  }, []);

  // Si la elección es "sistema", seguir los cambios del dispositivo en vivo.
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(mq.matches ? "dark" : "light");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  // Aplica (o limpia) el tema según el tema resuelto y la ruta actual.
  // Al navegar entre landing y app, esto re-evalúa y mantiene la landing clara.
  useEffect(() => {
    applyTheme(resolved, isAppPath(pathname));
  }, [resolved, pathname]);

  const setTheme = useCallback((next: ThemeChoice) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    setResolved(resolveChoice(next));
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
export const THEME_NO_FLASH_SCRIPT = `(function(){try{var p=location.pathname;if(p!=='/app'&&p.indexOf('/app/')!==0){return;}var t=localStorage.getItem('${STORAGE_KEY}')||'system';var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var e=(t==='dark')||(t==='system'&&d)?'dark':'light';document.documentElement.setAttribute('data-theme',e);}catch(_){}})();`;
