"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/public/AuthShell";
import { Eye, Arrow } from "@/components/atende/Icons";
import { getPublicPlan, formatARS } from "@/lib/plan-display";

function getFriendlyError(message: string): string {
  const normalized = message.trim().toLowerCase();

  if (!normalized) return "No pudimos completar la acción. Probá nuevamente.";
  if (normalized.includes("ya tiene una cuenta")) return "Ese email ya tiene una cuenta. Iniciá sesión para continuar.";
  if (normalized.includes("contraseña")) return message;
  if (normalized.includes("obligatorios")) return "Completá todos los campos para crear tu cuenta.";
  return message;
}

function SignupForm() {
  const trialPlan = getPublicPlan("growth");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName || !email || !password || !businessName) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, businessName, planCode: trialPlan.code }),
      });

      if (res.ok) {
        router.push("/app/plan");
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

  const planBanner = (
    <div className="rounded-[24px] border border-[rgba(31,107,74,0.18)] bg-[var(--green-tint)] px-5 py-4 text-center shadow-[var(--shadow-1)]">
      <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.22em] text-[var(--green-soft)]">
        Prueba gratuita
      </p>
      <p className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-[var(--green-ink)]">
        {trialPlan.name}
      </p>
      <p className="mt-1 text-sm text-[var(--green-soft)]">14 días sin cargo · luego {formatARS(trialPlan.priceMonthly)} / mes</p>
    </div>
  );

  return (
    <AuthShell
      eyebrow="Crear cuenta"
      title="Creá tu cuenta"
      subtitle="Creá tu cuenta y probá el plan Growth durante 14 días sin cargo. Después elegís el plan que mejor se adapte a tu negocio."
      planBanner={planBanner}
      footer={
        <>
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-medium text-[var(--green-soft)] underline-offset-4 hover:underline">
            Iniciá sesión
          </Link>
          <span className="mt-2 block text-xs text-[var(--muted)]">
            Al crear tu cuenta aceptás los{" "}
            <Link href="/terminos" className="underline underline-offset-2">Términos</Link> y la{" "}
            <Link href="/privacidad" className="underline underline-offset-2">Política de Privacidad</Link>.
          </span>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[var(--ink-2)]">Nombre completo</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setError("");
            }}
            placeholder="Juan Pérez"
            autoFocus
            autoComplete="name"
            className="w-full rounded-[18px] border border-[var(--hairline-2)] bg-[var(--surface)] px-4 py-3.5 text-[15px] text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--green-soft)] focus:ring-4 focus:ring-[rgba(31,107,74,0.12)]"
          />
        </div>

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
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
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

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[var(--ink-2)]">Nombre del negocio</label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => {
              setBusinessName(e.target.value);
              setError("");
            }}
            placeholder="Mi negocio"
            autoComplete="organization"
            className="w-full rounded-[18px] border border-[var(--hairline-2)] bg-[var(--surface)] px-4 py-3.5 text-[15px] text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--green-soft)] focus:ring-4 focus:ring-[rgba(31,107,74,0.12)]"
          />
        </div>

        {error ? (
          <div className="rounded-[18px] border border-[rgba(187,50,33,0.16)] bg-[rgba(255,107,77,0.10)] px-4 py-3 text-sm leading-6 text-[rgb(128,42,28)]">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || !fullName || !email || !password || !businessName}
          className="mt-2 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 text-[15px] font-semibold text-[var(--on-accent)] transition hover:translate-y-[-1px] hover:bg-[var(--accent-2)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Arrow size={17} />
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-[var(--green-tint-2)] border-t-[var(--green-soft)]" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
