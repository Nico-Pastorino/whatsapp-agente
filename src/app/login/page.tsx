"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthShell from "@/components/public/AuthShell";
import { Eye, Lock } from "@/components/atende/Icons";

function getFriendlyError(message: string): string {
  const normalized = message.trim().toLowerCase();

  if (!normalized) return "No pudimos completar la acción. Probá nuevamente.";
  if (normalized.includes("incorrect")) return "Email o contraseña incorrectos.";
  if (normalized.includes("expir")) return "Tu sesión expiró. Volvé a iniciar sesión.";
  if (normalized.includes("demasiados intentos")) return "Hiciste muchos intentos. Esperá un minuto y probá otra vez.";
  return message;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push("/app");
        router.refresh();
        return;
      }

      const data = await res.json().catch(() => ({}));
      setError(getFriendlyError(typeof data.error === "string" ? data.error : ""));
    } catch {
      setError("No pudimos completar la acción. Probá nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Ingresar"
      title="Ingresá a tu asistente"
      subtitle="Accedé al dashboard de tu negocio y gestioná tu WhatsApp con IA."
      footer={
        <>
          ¿No tenés cuenta?{" "}
          <Link href="/signup" className="font-medium text-[var(--green-soft)] underline-offset-4 hover:underline">
            Crear cuenta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[var(--ink-2)]">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            placeholder="tu@negocio.com"
            autoFocus
            autoComplete="email"
            className="w-full rounded-[18px] border border-[var(--hairline-2)] bg-[var(--surface)] px-4 py-3.5 text-[15px] text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--green-soft)] focus:ring-4 focus:ring-[rgba(31,107,74,0.12)]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[var(--ink-2)]">Contraseña</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="Ingresá tu contraseña"
              autoComplete="current-password"
              className="w-full rounded-[18px] border border-[var(--hairline-2)] bg-[var(--surface)] px-4 py-3.5 pr-12 text-[15px] text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--green-soft)] focus:ring-4 focus:ring-[rgba(31,107,74,0.12)]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--ink-2)]"
              tabIndex={-1}
            >
              <Eye size={18} />
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-[18px] border border-[rgba(187,50,33,0.16)] bg-[rgba(255,107,77,0.10)] px-4 py-3 text-sm leading-6 text-[rgb(128,42,28)]">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="mt-2 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[var(--green)] px-5 text-[15px] font-semibold text-[var(--on-green)] transition hover:translate-y-[-1px] hover:bg-[var(--green-soft)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Lock size={17} />
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </AuthShell>
  );
}
