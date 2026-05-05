import Link from "next/link";

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">¡Pago procesado!</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          Tu cuenta está siendo activada. En unos segundos vas a poder acceder al dashboard y conectar tu WhatsApp.
        </p>
        <Link
          href="/app/plan"
          className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
        >
          Ir a Mi Plan
        </Link>
        <p className="mt-4 text-xs text-gray-400">
          Si el estado no actualizó en 1 minuto, recargá la página.
        </p>
      </div>
    </div>
  );
}
