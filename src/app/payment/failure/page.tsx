import Link from "next/link";

export default function PaymentFailurePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">El pago no se procesó</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          Hubo un problema con tu pago. Podés intentarlo de nuevo desde la sección Mi Plan o contactarnos si el problema persiste.
        </p>
        <Link
          href="/app/plan"
          className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          Intentar de nuevo
        </Link>
      </div>
    </div>
  );
}
