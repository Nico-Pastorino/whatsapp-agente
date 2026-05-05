import Link from "next/link";

export default function PaymentPendingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-8 w-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Pago en proceso</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          Tu pago está siendo procesado por Mercado Pago. Te avisaremos por email cuando se confirme y tu cuenta quede activa.
        </p>
        <Link
          href="/app/plan"
          className="mt-8 inline-flex w-full items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-6 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
        >
          Ir a Mi Plan
        </Link>
      </div>
    </div>
  );
}
