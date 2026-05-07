import type { ReactNode } from "react";
import Link from "next/link";
import BrandWordmark from "./BrandWordmark";

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  planBanner,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  planBanner?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-hidden bg-[var(--bg)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(255,107,77,0.14), transparent 28%), radial-gradient(circle at top right, rgba(13,59,46,0.12), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.56), rgba(243,240,234,0.9))",
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-5 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center text-[var(--ink)] no-underline">
            <BrandWordmark size={22} />
          </Link>
          <span className="hidden rounded-full border border-[var(--hairline)] bg-white/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted)] shadow-[var(--shadow-1)] sm:inline-flex">
            Asistente comercial
          </span>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <section className="hidden lg:block">
            <div className="max-w-xl">
              {eyebrow ? (
                <p className="mb-4 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                  {eyebrow}
                </p>
              ) : null}
              <h1 className="max-w-lg text-[clamp(44px,5vw,72px)] font-semibold leading-[0.98] tracking-[-0.04em] text-[var(--ink)]">
                {title}
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-[var(--ink-3)]">
                {subtitle}
              </p>

              <div className="mt-10 grid gap-3 sm:grid-cols-2">
                {[
                  "Respondé consultas con la información real de tu negocio.",
                  "Conectá WhatsApp y controlá todo desde un solo dashboard.",
                  "Elegí un plan claro y seguí con el pago sin pasos extra.",
                  "Invitá a tu equipo y mantené el control del negocio.",
                ].map((item, index) => (
                  <div
                    key={item}
                    className="rounded-[24px] border border-[var(--hairline)] bg-white/80 p-4 shadow-[var(--shadow-1)] backdrop-blur"
                  >
                    <div className="mb-4 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                      0{index + 1}
                    </div>
                    <p className="text-sm leading-6 text-[var(--ink-2)]">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-[440px]">
            {planBanner ? <div className="mb-4">{planBanner}</div> : null}
            <div
              className="rounded-[30px] border border-[var(--hairline)] bg-white/92 p-6 shadow-[var(--shadow-3)] backdrop-blur sm:p-8"
            >
              <div className="mb-6 text-center sm:mb-8">
                {eyebrow ? (
                  <p className="mb-3 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] lg:hidden">
                    {eyebrow}
                  </p>
                ) : null}
                <h2 className="text-[32px] font-semibold leading-none tracking-[-0.03em] text-[var(--ink)]">
                  {title}
                </h2>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[var(--ink-3)]">
                  {subtitle}
                </p>
              </div>

              {children}

              {footer ? <div className="mt-7 text-center text-sm text-[var(--ink-3)]">{footer}</div> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
