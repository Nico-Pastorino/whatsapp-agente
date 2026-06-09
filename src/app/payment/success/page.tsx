import Link from "next/link";

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg)" }}>
      <div className="max-w-md w-full rounded-3xl p-10 text-center" style={{ background: "var(--surface)", border: "1px solid var(--hairline)", boxShadow: "var(--shadow-2)" }}>
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--green-tint)" }}>
          <svg className="h-8 w-8" style={{ color: "var(--green)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>¡Pago procesado!</h1>
        <p className="mt-3 text-sm leading-6" style={{ color: "var(--ink-3)" }}>
          Tu cuenta está siendo activada. En unos segundos vas a poder entrar al panel y conectar tu WhatsApp.
        </p>
        <Link
          href="/app/plan"
          className="mt-8 inline-flex w-full items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold transition hover:opacity-90"
          style={{ background: "var(--green)", color: "var(--on-green)" }}
        >
          Ir a Mi Plan
        </Link>
        <p className="mt-4 text-xs" style={{ color: "var(--muted)" }}>
          Si el estado no actualizó en 1 minuto, recargá la página.
        </p>
      </div>
    </div>
  );
}
