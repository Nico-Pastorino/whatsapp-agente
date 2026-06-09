import Link from "next/link";

export default function PaymentPendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg)" }}>
      <div className="max-w-md w-full rounded-3xl p-10 text-center" style={{ background: "var(--surface)", border: "1px solid var(--hairline)", boxShadow: "var(--shadow-2)" }}>
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--human-tint)" }}>
          <svg className="h-8 w-8" style={{ color: "var(--human)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>Pago en proceso</h1>
        <p className="mt-3 text-sm leading-6" style={{ color: "var(--ink-3)" }}>
          Tu pago está siendo procesado por Mercado Pago. Te avisamos por email cuando se confirme y tu cuenta quede activa.
        </p>
        <Link
          href="/app/plan"
          className="mt-8 inline-flex w-full items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold transition hover:opacity-90"
          style={{ background: "var(--human-tint)", color: "var(--human)", border: "1px solid rgba(212,154,58,0.35)" }}
        >
          Ir a Mi Plan
        </Link>
      </div>
    </div>
  );
}
