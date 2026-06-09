import Link from "next/link";

export default function PaymentFailurePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg)" }}>
      <div className="max-w-md w-full rounded-3xl p-10 text-center" style={{ background: "var(--surface)", border: "1px solid var(--hairline)", boxShadow: "var(--shadow-2)" }}>
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "rgba(180,35,24,0.10)" }}>
          <svg className="h-8 w-8" style={{ color: "#b42318" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>El pago no se procesó</h1>
        <p className="mt-3 text-sm leading-6" style={{ color: "var(--ink-3)" }}>
          Hubo un problema con tu pago. Podés intentarlo de nuevo desde Mi Plan o escribirnos si el problema sigue.
        </p>
        <Link
          href="/app/plan"
          className="mt-8 inline-flex w-full items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold transition hover:opacity-90"
          style={{ background: "var(--ink)", color: "var(--bg)" }}
        >
          Intentar de nuevo
        </Link>
      </div>
    </div>
  );
}
