import Link from "next/link";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_WHATSAPP_URL?.trim() || "mailto:hola@example.com";

const plans = [
  {
    name: "Starter",
    price: "Ideal para validar la automatización",
    bullets: ["1 número de WhatsApp", "Inbox compartido", "Base de IA entrenable"],
  },
  {
    name: "Pro",
    price: "Para equipos con más volumen y seguimiento",
    bullets: ["Más respuestas IA", "Más usuarios internos", "Reportes y operación diaria"],
  },
  {
    name: "Premium",
    price: "Para negocios con operación comercial intensiva",
    bullets: ["Implementación asistida", "Mayor capacidad", "Roadmap a canal oficial Meta"],
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dff6eb,transparent_36%),linear-gradient(180deg,#f8fbf9_0%,#ffffff_100%)] text-gray-900">
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-200" />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.26em] text-emerald-600">
                  Agente WhatsApp
                </p>
                <p className="text-sm text-gray-500">Asistente comercial entrenado para tu negocio</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:text-gray-900"
              >
                Iniciar sesión
              </Link>
              <a
                href={DEMO_URL}
                className="rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Solicitar demo
              </a>
            </div>
          </header>

          <div className="grid gap-12 py-18 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="inline-flex rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700 shadow-sm">
                Atención comercial 24/7 con control humano
              </p>
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.04em] text-gray-950 md:text-7xl">
                Automatizá tu WhatsApp con un asistente entrenado para tu negocio
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
                Respondé consultas, mostrale productos a tus clientes y derivá a humano cuando
                haga falta. Todo desde un inbox comercial pensado para convertir conversaciones en
                ventas.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_18px_45px_-24px_rgba(16,185,129,0.75)] transition hover:bg-emerald-600"
                >
                  Iniciar sesión
                </Link>
                <a
                  href={DEMO_URL}
                  className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:text-gray-900"
                >
                  Solicitar demo
                </a>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_40px_120px_-56px_rgba(15,23,42,0.45)] backdrop-blur">
              <div className="rounded-[1.5rem] bg-gray-950 p-5 text-white">
                <div className="flex items-center justify-between text-sm text-white/70">
                  <span>Inbox comercial</span>
                  <span>Modo IA / Humano</span>
                </div>
                <div className="mt-5 space-y-4">
                  <div className="max-w-[80%] rounded-3xl rounded-tl-md bg-white/10 px-4 py-3 text-sm leading-6">
                    Hola, quería saber el precio del combo para regalo y si hacen envíos.
                  </div>
                  <div className="ml-auto max-w-[82%] rounded-3xl rounded-tr-md bg-emerald-500 px-4 py-3 text-sm leading-6 text-white">
                    Sí. Tenemos packs listos y también armados a medida. Te paso opciones,
                    disponibilidad y forma de pago.
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">
                      Entrenado con tu negocio
                    </p>
                    <p className="mt-2 text-sm text-white/75">
                      Catálogo, horarios, ubicación, precios y reglas de derivación centralizadas
                      en el dashboard.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-[2rem] border border-gray-200 bg-white p-7 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-500">Problema</p>
            <h2 className="mt-3 text-2xl font-semibold text-gray-900">Las consultas llegan, pero el seguimiento se pierde</h2>
            <p className="mt-4 text-sm leading-7 text-gray-600">
              WhatsApp termina mezclando ventas, soporte y derivaciones. El resultado es demora,
              respuestas inconsistentes y oportunidades sin cerrar.
            </p>
          </article>
          <article className="rounded-[2rem] border border-gray-200 bg-white p-7 shadow-sm lg:col-span-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">Solución</p>
            <h2 className="mt-3 text-2xl font-semibold text-gray-900">Un asistente comercial que responde con contexto real de tu negocio</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-600">
              El agente usa tu catálogo, datos de negocio, reglas de operación y modo IA/Humano
              para responder rápido sin perder control. Vos definís cuándo automatizar y cuándo
              tomar la conversación desde el dashboard.
            </p>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">Funcionalidades</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-gray-950">
              Operación diaria lista para vender mejor
            </h2>
          </div>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Inbox unificado por contacto y control de conversaciones duplicadas.",
            "Modo IA/Humano para alternar atención automática y manual.",
            "Entrenamiento con información de negocio, productos y reglas internas.",
            "Conexión persistente con WhatsApp y envío seguro evitando destinos inseguros.",
          ].map((item) => (
            <article key={item} className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm leading-7 text-gray-600">{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-4 lg:grid-cols-3">
          {["Inbox y conversaciones", "Mi Negocio y catálogo", "Conexión y control operativo"].map((title) => (
            <div key={title} className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm">
              <div className="h-56 rounded-[1.5rem] bg-[linear-gradient(135deg,#f3f4f6,#ffffff)] ring-1 ring-inset ring-gray-200" />
              <h3 className="mt-5 text-lg font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Capturas reales del producto listas para venta, onboarding y presentaciones.
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-[2.25rem] border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">Planes</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.name} className="rounded-[1.75rem] border border-gray-200 bg-gray-50 p-6">
                <h3 className="text-2xl font-semibold text-gray-900">{plan.name}</h3>
                <p className="mt-2 text-sm text-gray-500">{plan.price}</p>
                <ul className="mt-5 space-y-3 text-sm text-gray-600">
                  {plan.bullets.map((bullet) => (
                    <li key={bullet}>• {bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">Preguntas frecuentes</p>
          <div className="mt-6 space-y-5">
            {[
              {
                q: "¿La IA puede derivar a una persona real?",
                a: "Sí. El inbox permite cambiar por conversación entre Modo IA y Modo Humano.",
              },
              {
                q: "¿Puedo entrenarlo con productos y reglas del negocio?",
                a: "Sí. El panel de Mi Negocio centraliza descripción, catálogo e información operativa.",
              },
              {
                q: "¿Queda preparado para migrar al canal oficial de Meta?",
                a: "Sí. La arquitectura se está desacoplando del provider para facilitar ese paso sin reescribir la app.",
              },
            ].map((item) => (
              <div key={item.q} className="rounded-2xl bg-gray-50 p-5">
                <h3 className="text-lg font-semibold text-gray-900">{item.q}</h3>
                <p className="mt-2 text-sm leading-7 text-gray-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
