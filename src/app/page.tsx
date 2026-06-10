import Link from "next/link";
import BrandWordmark from "@/components/public/BrandWordmark";
import Reveal from "@/components/public/Reveal";
import HeroPhone from "@/components/public/HeroPhone";
import TryDemo from "@/components/public/TryDemo";
import Objections from "@/components/public/Objections";
import PricingPlans from "@/components/public/PricingPlans";

/* ─────────────────────────────────────────────────────────────────────────────
   LANDING — concepto: "La venta empieza con un mensaje".
   Una sola historia: la consulta que hoy se pierde → cómo la resuelve Atende →
   probalo vos mismo → empezá gratis. Mobile-first, secciones cortas, un CTA.
   ──────────────────────────────────────────────────────────────────────────── */

// Consultas que llegan cuando nadie responde (sección "lo que está pasando").
const MISSED = [
  { time: "13:12", text: "Hola! ¿Cuánto sale el iPhone 13?", status: "visto a las 19:40 — ya compró en otro lado" },
  { time: "21:55", text: "¿Tenés turno para el sábado?", status: "respondido al día siguiente — no contestó más" },
  { time: "02:31", text: "¿Hasta qué edad se puede entrar?", status: "nunca respondido" },
] as const;

// La misma consulta, resuelta por el asistente (chat estático estilizado).
const RESOLVED_CHAT = [
  { from: "them", text: "Hola! ¿Cuánto sale el corte + color?" },
  { from: "me", text: "¡Hola! 👋 Corte + color está $28.000 e incluye lavado. ¿Querés que te pase un turno?" },
  { from: "them", text: "Dale, ¿tenés algo el sábado a la tarde?" },
  { from: "me", text: "Dale, te anoto 🙌 Pasame tu nombre y te dejo solicitado el sábado a la tarde. El equipo te confirma el horario por acá." },
  { from: "them", text: "Sofía. ¡Gracias!" },
  { from: "me", text: "Listo, Sofía. Quedó solicitado para el sábado ✅" },
] as const;

const STEPS = [
  { num: "1", title: "Conectá tu WhatsApp", desc: "Escaneás un QR, igual que WhatsApp Web. Tu mismo número de siempre." },
  { num: "2", title: "Elegí tu rubro", desc: "Aplicás una plantilla y cargás tus precios, horarios y datos reales." },
  { num: "3", title: "Tu asistente responde", desc: "Atiende cada consulta al instante. Vos mirás todo desde el panel." },
] as const;

const BENEFITS = [
  { icon: "clock", title: "Responde 24/7", desc: "De noche, los domingos y cuando estás con las manos ocupadas." },
  { icon: "shield", title: "No inventa", desc: "Responde solo con la información que vos cargaste. Si no sabe, consulta." },
  { icon: "calendar", title: "Toma reservas y turnos", desc: "Pide los datos, deja la solicitud lista y le avisa a tu equipo." },
  { icon: "hand", title: "Modo humano", desc: "Tomás el control de cualquier chat en un toque. La IA se corre." },
  { icon: "catalog", title: "Tu catálogo, sus respuestas", desc: "Cargás productos y servicios una vez; responde precios y stock solo." },
  { icon: "team", title: "Tu equipo adentro", desc: "Invitás personas para responder y administrar, con roles." },
] as const;

const RUBROS = [
  { emoji: "✂️", name: "Peluquería / estética", desc: "Toma turnos, informa precios y servicios." },
  { emoji: "🍽️", name: "Restaurante / delivery", desc: "Reservas, menú, horarios y pedidos." },
  { emoji: "🎵", name: "Boliche / eventos", desc: "Entradas, edad mínima, cumpleaños y VIP." },
  { emoji: "📱", name: "Tienda de celulares", desc: "Precios, stock, cuotas, garantía y envíos." },
  { emoji: "👗", name: "Indumentaria", desc: "Talles, colores, cambios y envíos." },
  { emoji: "💪", name: "Gimnasio", desc: "Planes, horarios, clases y promos." },
  { emoji: "🏨", name: "Turismo / hospedaje", desc: "Tarifas, disponibilidad y reservas." },
  { emoji: "⚽", name: "Canchas / deportes", desc: "Precios por hora y turnos de cancha." },
] as const;

const TRUST = [
  { title: "Vos tenés el control.", desc: "Activás o pausás la IA por conversación, cuando quieras." },
  { title: "Si no sabe, no inventa.", desc: "Lo consulta con tu equipo y te avisa para que cargues el dato." },
  { title: "Si piden una persona, deriva.", desc: "El chat pasa a modo humano y tu equipo lo sigue." },
  { title: "Tus datos quedan guardados.", desc: "Si pausás o cancelás, no perdés nada. Reactivás cuando quieras." },
] as const;

// ── Iconos line-style ────────────────────────────────────────────────────────
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.8,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "clock": return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "shield": return <svg {...common}><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>;
    case "calendar": return <svg {...common}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></svg>;
    case "hand": return <svg {...common}><path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2a8 8 0 0 1-7.5-5.2L2.8 15a2 2 0 0 1 3.5-2" /></svg>;
    case "catalog": return <svg {...common}><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></svg>;
    case "team": return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.5a3 3 0 0 1 0 5.8M21 20a6 6 0 0 0-4-5.6" /></svg>;
    case "spark": return <svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
  }
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <main style={{ background: "var(--bg)", color: "var(--ink)", minHeight: "100vh", overflowX: "hidden" }}>

      {/* ── Nav flotante ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, padding: "12px 12px 0" }}>
        <div className="lp-nav" style={{
          maxWidth: 1000, margin: "0 auto", padding: "0 10px 0 18px", height: 56,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "color-mix(in oklab, var(--bg-elev) 78%, transparent)",
          backdropFilter: "blur(16px) saturate(1.4)", WebkitBackdropFilter: "blur(16px) saturate(1.4)",
          border: "1px solid var(--hairline)", borderRadius: 999, boxShadow: "var(--shadow-2)",
        }}>
          <BrandWordmark size={20} />
          <div className="hidden md:flex" style={{ gap: 28, fontSize: 14, color: "var(--ink-2)" }}>
            <a href="#como-funciona" className="lp-navlink" style={{ color: "inherit", textDecoration: "none" }}>Cómo funciona</a>
            <a href="#rubros" className="lp-navlink" style={{ color: "inherit", textDecoration: "none" }}>Rubros</a>
            <a href="#demo" className="lp-navlink" style={{ color: "inherit", textDecoration: "none" }}>Demo</a>
            <a href="#planes" className="lp-navlink" style={{ color: "inherit", textDecoration: "none" }}>Planes</a>
            <a href="#preguntas" className="lp-navlink" style={{ color: "inherit", textDecoration: "none" }}>Preguntas</a>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Link href="/login" className="lp-btn hidden min-[420px]:inline-flex" style={{ padding: "8px 14px", fontSize: 14, fontWeight: 500, color: "var(--ink-2)", textDecoration: "none", borderRadius: 999 }}>
              Ingresar
            </Link>
            <Link href="/signup" className="lp-btn" style={{ padding: "9px 18px", fontSize: 14, fontWeight: 600, background: "var(--ink)", color: "#fff", borderRadius: 999, textDecoration: "none" }}>
              Probar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(36px, 6vw, 76px) 24px clamp(48px, 7vw, 88px)" }}>
        <div className="grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]" style={{ gap: "clamp(36px, 5vw, 64px)", alignItems: "center" }}>
          <div className="lp-hero-copy">
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 13px", borderRadius: 99, background: "var(--surface)", border: "1px solid var(--hairline)", marginBottom: 24, boxShadow: "var(--shadow-1)" }}>
              <span className="atd-dot live" style={{ width: 7, height: 7, background: "var(--accent)", boxShadow: "0 0 0 4px color-mix(in oklab, var(--accent) 22%, transparent)" }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-2)" }}>Para negocios que venden por WhatsApp</span>
            </div>

            <h1 style={{ fontSize: "clamp(40px, 6.4vw, 70px)", fontWeight: 700, lineHeight: 1.02, letterSpacing: "-0.03em", margin: "0 0 18px", maxWidth: 540 }}>
              Tu vendedor{" "}
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 500, color: "var(--accent)" }}>
                automático
              </span>{" "}
              por WhatsApp.
            </h1>

            <p style={{ fontSize: "clamp(15px, 2.4vw, 17px)", lineHeight: 1.6, color: "var(--ink-2)", margin: "0 0 28px", maxWidth: 440 }}>
              Responde consultas, toma reservas y capta clientes las 24 hs — con la información
              real de tu negocio. Y cuando hace falta una persona, te lo pasa a vos.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <Link href="/signup" className="lp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "14px 26px", fontSize: 15.5, fontWeight: 600, background: "var(--ink)", color: "#fff", borderRadius: 12, textDecoration: "none", boxShadow: "var(--shadow-2)" }}>
                Probar gratis 14 días <span className="arrow">→</span>
              </Link>
              <a href="#demo" className="lp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "14px 24px", fontSize: 15.5, fontWeight: 500, background: "var(--surface)", color: "var(--ink)", borderRadius: 12, textDecoration: "none", border: "1px solid var(--hairline-2)" }}>
                Ver cómo responde
              </a>
            </div>

            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0, display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
              <span>✓ Sin tarjeta para empezar</span>
              <span>✓ Tu mismo número</span>
              <span>✓ Listo en 5 minutos</span>
            </p>
          </div>

          {/* Teléfono + chips de estado flotantes */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", position: "relative" }}>
            <div className="lp-float" style={{ width: "100%", maxWidth: 320, position: "relative" }}>
              <HeroPhone />
              <div className="hidden sm:flex" style={{ position: "absolute", top: 18, left: -86, flexDirection: "column", gap: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--hairline)", boxShadow: "var(--shadow-2)", fontSize: 12, fontWeight: 600, color: "var(--green-ink)" }}>
                  <Icon name="spark" size={13} /> IA activa
                </span>
              </div>
              <div className="hidden sm:flex" style={{ position: "absolute", bottom: 64, right: -78, flexDirection: "column", gap: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--hairline)", boxShadow: "var(--shadow-2)", fontSize: 12, fontWeight: 600, color: "var(--human)" }}>
                  🔥 Cliente interesado
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LO QUE ESTÁ PASANDO — consultas perdidas (banda oscura) ── */}
      <section style={{ background: "var(--green)", padding: "64px 24px 68px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <Reveal style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: "clamp(30px, 4.4vw, 52px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", color: "#fff", margin: 0, maxWidth: 640 }}>
              Mientras leés esto, alguien le está escribiendo{" "}
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--accent)" }}>a tu negocio.</span>
            </h2>
          </Reveal>
          <Reveal className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 12 }}>
            {MISSED.map((m) => (
              <div key={m.time} style={{ padding: "18px 20px", borderRadius: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <p className="mono" style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: "0 0 8px" }}>{m.time}</p>
                <p style={{ fontSize: 15, fontWeight: 500, color: "#fff", margin: "0 0 10px", lineHeight: 1.45 }}>“{m.text}”</p>
                <p style={{ fontSize: 12.5, color: "rgba(255,107,77,0.9)", margin: 0 }}>✕ {m.status}</p>
              </div>
            ))}
          </Reveal>
          <Reveal style={{ marginTop: 28 }}>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", margin: 0, maxWidth: 520, lineHeight: 1.6 }}>
              Cada consulta sin responder es una venta que se enfría. No es falta de ganas —
              es que nadie puede estar en el celular todo el día.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── EL GIRO — la misma consulta, resuelta ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <div className="grid md:grid-cols-2" style={{ gap: 56, alignItems: "center" }}>
          <Reveal>
            <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 14, fontFamily: "var(--font-mono)" }}>
              ✦ con atendé
            </p>
            <h2 style={{ fontSize: "clamp(32px, 4.2vw, 52px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: "0 0 18px", maxWidth: 460 }}>
              Esa misma consulta{" "}
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--accent)" }}>
                termina en venta.
              </span>
            </h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--ink-2)", margin: "0 0 22px", maxWidth: 420 }}>
              Tu asistente responde al instante con tus precios y horarios reales, toma la
              reserva y le avisa a tu equipo. El cliente nunca queda esperando — y vos no
              tuviste que agarrar el celular.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["Responde con tu información", "Toma la reserva", "Avisa a tu equipo"].map((t) => (
                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--hairline)", fontSize: 12.5, color: "var(--ink-2)" }}>
                  <span style={{ color: "var(--green-soft)", fontWeight: 700 }}>✓</span> {t}
                </span>
              ))}
            </div>
          </Reveal>

          {/* Chat resuelto (estático, estilizado) */}
          <Reveal delay={120}>
            <div style={{ borderRadius: 22, background: "var(--surface)", border: "1px solid var(--hairline)", boxShadow: "var(--shadow-2)", overflow: "hidden", maxWidth: 420, margin: "0 auto", width: "100%" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 32, height: 32, borderRadius: 999, background: "var(--green-tint)", color: "var(--green-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>S</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>Sofía</p>
                  <p className="mono" style={{ fontSize: 10.5, color: "var(--green-soft)", margin: 0 }}>respondiendo con IA</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: "var(--green-tint)", color: "var(--green-ink)" }}>IA</span>
              </div>
              <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                {RESOLVED_CHAT.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: m.from === "me" ? "flex-end" : "flex-start",
                      maxWidth: "82%",
                      padding: "9px 13px",
                      borderRadius: m.from === "me" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      background: m.from === "me" ? "var(--green-tint)" : "var(--surface-2)",
                      color: "var(--ink)",
                      fontSize: 13.5,
                      lineHeight: 1.5,
                    }}
                  >
                    {m.text}
                  </div>
                ))}
                <div style={{ alignSelf: "center", marginTop: 6, display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 999, background: "var(--human-tint)", border: "1px solid rgba(212,154,58,0.3)", fontSize: 12, fontWeight: 600, color: "var(--human)" }}>
                  🔔 Aviso enviado a tu equipo: nueva reserva pendiente
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CÓMO EMPEZÁS — 3 pasos ── */}
      <section id="como-funciona" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        <Reveal style={{ marginBottom: 40, textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 700, lineHeight: 1.06, letterSpacing: "-0.03em", margin: 0 }}>
            Empezás{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>hoy mismo.</span>
          </h2>
          <p style={{ fontSize: 14.5, color: "var(--ink-3)", margin: "12px auto 0", maxWidth: 480 }}>
            Sin instalaciones raras. Sin configuraciones técnicas. Pensado para negocios reales.
          </p>
        </Reveal>
        <Reveal className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 14 }}>
          {STEPS.map((s) => (
            <div key={s.num} className="lp-card" style={{ padding: "26px 24px", borderRadius: 18, background: "var(--surface)", border: "1px solid var(--hairline)" }}>
              <div style={{ fontSize: 44, fontWeight: 700, color: "var(--green-tint-2, var(--green-tint))", lineHeight: 1, marginBottom: 14, fontFamily: "var(--font-serif)" }}>
                {s.num}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", margin: "0 0 6px" }}>{s.title}</h3>
              <p style={{ fontSize: 13.5, color: "var(--ink-3)", margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ── QUÉ HACE POR TU NEGOCIO ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        <Reveal style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 700, lineHeight: 1.06, letterSpacing: "-0.03em", margin: 0, maxWidth: 560 }}>
            Trabaja como tu mejor vendedor.{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--accent)" }}>Sin francos.</span>
          </h2>
        </Reveal>
        <Reveal className="grid grid-cols-1 min-[430px]:grid-cols-2 lg:grid-cols-3" style={{ gap: 12 }}>
          {BENEFITS.map((b) => (
            <div key={b.title} className="lp-card" style={{ padding: 22, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--hairline)", display: "flex", flexDirection: "column", gap: 13 }}>
              <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--green-tint)", color: "var(--green-ink)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={b.icon} size={20} />
              </span>
              <div>
                <h3 style={{ fontSize: 15.5, fontWeight: 600, color: "var(--ink)", margin: "0 0 6px" }}>{b.title}</h3>
                <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0, lineHeight: 1.55 }}>{b.desc}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ── RUBROS — el gran diferencial ── */}
      <section id="rubros" style={{ background: "var(--bg-elev)", borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)", padding: "76px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Reveal style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 700, lineHeight: 1.06, letterSpacing: "-0.03em", margin: 0, maxWidth: 600 }}>
              No arranca de cero:{" "}
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>ya conoce tu rubro.</span>
            </h2>
            <p style={{ maxWidth: 540, margin: "14px 0 0", fontSize: 15, lineHeight: 1.7, color: "var(--ink-3)" }}>
              Elegís tu rubro y Atende carga preguntas frecuentes, tono y reglas pensadas para tu
              tipo de negocio. Vos solo completás tus precios, horarios y datos reales.
            </p>
          </Reveal>
          <Reveal className="grid grid-cols-1 min-[430px]:grid-cols-2 lg:grid-cols-4" style={{ gap: 10 }}>
            {RUBROS.map((r) => (
              <div key={r.name} className="lp-card" style={{ padding: 18, borderRadius: 16, background: "var(--surface)", border: "1px solid var(--hairline)", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{r.emoji}</span>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>{r.name}</h3>
                  <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: 0, lineHeight: 1.45 }}>{r.desc}</p>
                </div>
              </div>
            ))}
          </Reveal>
          <Reveal style={{ marginTop: 18 }}>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
              + servicios técnicos, inmobiliarias, consultorios, cursos y más.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── DEMO INTERACTIVA ── */}
      <section id="demo" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <div className="grid md:grid-cols-2" style={{ gap: 56, alignItems: "center" }}>
          <Reveal>
            <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 14, fontFamily: "var(--font-mono)" }}>
              ✦ probalo ahora
            </p>
            <h2 style={{ fontSize: "clamp(32px, 4.2vw, 52px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: "0 0 18px", maxWidth: 460 }}>
              Escribile como{" "}
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--accent)" }}>
                un cliente.
              </span>
            </h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--ink-2)", margin: "0 0 22px", maxWidth: 410 }}>
              Probá una consulta como la haría un cliente y mirá cómo respondería tu asistente.
              Sin registrarte y sin conectar WhatsApp.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["Sin registro", "Sin conectar WhatsApp", "Es una simulación"].map((t) => (
                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--hairline)", fontSize: 12.5, color: "var(--ink-2)" }}>
                  <span style={{ color: "var(--green-soft)", fontWeight: 700 }}>✓</span> {t}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={120}>
            <TryDemo />
          </Reveal>
        </div>
      </section>

      {/* ── CONTROL HUMANO ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        <div className="grid md:grid-cols-2" style={{ gap: 56, alignItems: "start" }}>
          <Reveal>
            <h2 style={{ fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 700, lineHeight: 1.06, letterSpacing: "-0.03em", margin: "0 0 18px" }}>
              La IA atiende.{" "}
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>Vos decidís.</span>
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--ink-2)", margin: 0, maxWidth: 420 }}>
              Atende no reemplaza a tu equipo: le saca de encima las preguntas repetidas para
              que se ocupe de lo que importa. Cualquier conversación puede pasar a una persona
              en un toque.
            </p>
          </Reveal>
          <Reveal delay={100} className="grid grid-cols-1 min-[430px]:grid-cols-2" style={{ gap: 10 }}>
            {TRUST.map((f) => (
              <div key={f.title} className="lp-card" style={{ padding: 18, borderRadius: 16, background: "var(--surface)", border: "1px solid var(--hairline)" }}>
                <h4 style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", margin: "0 0 6px", lineHeight: 1.4 }}>{f.title}</h4>
                <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── PLANES ── */}
      <section id="planes" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 14 }}>
          <h2 style={{ fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 700, lineHeight: 1.06, letterSpacing: "-0.03em", margin: 0 }}>
            Planes simples,{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--accent)" }}>en pesos.</span>
          </h2>
        </Reveal>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", margin: "0 0 28px", display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "4px 14px" }}>
          <span>✓ 14 días gratis con Growth</span>
          <span>✓ Sin tarjeta para empezar</span>
          <span>✓ Cancelá cuando quieras</span>
        </p>
        <Reveal>
          <PricingPlans />
        </Reveal>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "16px 0 0", textAlign: "center" }}>
          Probá Atende gratis durante 14 días. Después elegís el plan que mejor se adapte a tu negocio.
        </p>
      </section>

      {/* ── FAQ ── */}
      <section id="preguntas" style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 90px" }}>
        <Reveal style={{ marginBottom: 32, textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            Sin letra chica,{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--accent)" }}>sin compromiso.</span>
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <Objections />
        </Reveal>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{ background: "var(--green)", padding: "80px 24px 72px" }}>
        <Reveal style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", color: "#fff", margin: "0 0 16px" }}>
            Tu próximo cliente{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--accent)" }}>
              ya te está escribiendo.
            </span>
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,0.55)", margin: "0 auto 36px", maxWidth: 420 }}>
            Conectá tu WhatsApp, elegí tu rubro y dejá que tu asistente responda por vos.
            No necesitás saber de tecnología.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 18 }}>
            <Link href="/signup" className="lp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "14px 26px", fontSize: 15, fontWeight: 600, background: "var(--accent)", color: "#fff", borderRadius: 12, textDecoration: "none" }}>
              Probar gratis 14 días <span className="arrow">→</span>
            </Link>
            <a href="#demo" className="lp-btn" style={{ display: "inline-flex", alignItems: "center", padding: "14px 26px", fontSize: 15, fontWeight: 500, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)", borderRadius: 12, textDecoration: "none", border: "1px solid rgba(255,255,255,0.15)" }}>
              Ver cómo responde
            </a>
          </div>
          <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.4)", margin: "0 0 56px" }}>
            Sin tarjeta · cancelá cuando quieras · sin compromiso
          </p>
          <BrandWordmark size={20} color="rgba(255,255,255,0.5)" />
          <p style={{ marginTop: 18, fontSize: 12, color: "rgba(255,255,255,0.35)", display: "flex", gap: 16, justifyContent: "center" }}>
            <Link href="/terminos" style={{ color: "inherit", textDecoration: "none" }}>Términos y Condiciones</Link>
            <Link href="/privacidad" style={{ color: "inherit", textDecoration: "none" }}>Política de Privacidad</Link>
          </p>
        </Reveal>
      </section>

    </main>
  );
}
