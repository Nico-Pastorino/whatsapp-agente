import Link from "next/link";
import BrandWordmark from "@/components/public/BrandWordmark";
import Reveal from "@/components/public/Reveal";
import HeroPhone from "@/components/public/HeroPhone";
import TryDemo from "@/components/public/TryDemo";
import Objections from "@/components/public/Objections";
import PricingPlans from "@/components/public/PricingPlans";

/* ─────────────────────────────────────────────────────────────────────────────
   LANDING v3 — dirección editorial premium sobre la narrativa
   "la venta empieza con un mensaje": hero oscuro de alto impacto, marquees,
   burbujas esparcidas, grilla bento y tipografía gigante.
   ──────────────────────────────────────────────────────────────────────────── */

const DARK = "#0a2e23"; // verde profundo del hero (más oscuro que --green)

const MARQUEE_PHRASES = [
  "responde a las 2 AM",
  "toma reservas solo",
  "no inventa precios",
  "avisa a tu equipo",
  "atiende 10 chats a la vez",
  "habla como tu mejor vendedor",
  "deriva cuando hace falta",
  "nunca deja un visto",
];

const MISSED = [
  { time: "13:12", text: "Hola! ¿Cuánto sale el iPhone 13?", status: "visto 19:40 — compró en otro lado", rot: -2.2, x: "0%" },
  { time: "21:55", text: "¿Tenés turno para el sábado?", status: "respondido al otro día — no contestó más", rot: 1.6, x: "6%" },
  { time: "02:31", text: "¿Hasta qué edad se puede entrar?", status: "nunca respondido", rot: -1.2, x: "2%" },
] as const;

const RESOLVED_CHAT = [
  { from: "them", text: "Hola! ¿Cuánto sale el corte + color?" },
  { from: "me", text: "¡Hola! 👋 Corte + color está $28.000 e incluye lavado. ¿Querés que te pase un turno?" },
  { from: "them", text: "Dale, ¿tenés algo el sábado a la tarde?" },
  { from: "me", text: "Dale, te anoto 🙌 Pasame tu nombre y te dejo solicitado el sábado a la tarde. El equipo te confirma por acá." },
  { from: "them", text: "Sofía. ¡Gracias!" },
  { from: "me", text: "Listo, Sofía. Quedó solicitado para el sábado ✅" },
] as const;

const STEPS = [
  { num: "01", title: "Conectá tu WhatsApp", desc: "Escaneás un QR, igual que WhatsApp Web. Tu mismo número de siempre." },
  { num: "02", title: "Elegí tu rubro", desc: "Aplicás una plantilla y cargás tus precios, horarios y datos reales." },
  { num: "03", title: "Tu asistente responde", desc: "Atiende cada consulta al instante. Vos mirás todo desde el panel." },
] as const;

const BENTO_SMALL = [
  { icon: "shield", title: "No inventa", desc: "Responde solo con lo que cargaste. Si no sabe, lo consulta." },
  { icon: "calendar", title: "Toma reservas", desc: "Pide los datos y deja la solicitud lista para tu equipo." },
  { icon: "hand", title: "Modo humano", desc: "Tomás cualquier chat en un toque. La IA se corre." },
  { icon: "catalog", title: "Tu catálogo", desc: "Cargás productos una vez; responde precios y stock solo." },
  { icon: "team", title: "Tu equipo", desc: "Invitás personas con roles para responder y administrar." },
] as const;

const RUBROS_ROW_1 = [
  "✂️ Peluquería", "💅 Estética", "🍽️ Restaurante", "🛵 Delivery", "🎵 Boliche",
  "🎟️ Eventos", "📱 Celulares", "👗 Indumentaria",
];
const RUBROS_ROW_2 = [
  "💪 Gimnasio", "🏨 Hospedaje", "⚽ Canchas", "🔧 Servicio técnico",
  "🏠 Inmobiliaria", "🩺 Consultorio", "🎓 Cursos", "🚗 Concesionaria",
];

const TRUST = [
  { title: "Vos tenés el control.", desc: "Activás o pausás la IA por conversación, cuando quieras." },
  { title: "Si no sabe, no inventa.", desc: "Lo consulta con tu equipo y te avisa para que cargues el dato." },
  { title: "Si piden una persona, deriva.", desc: "El chat pasa a modo humano y tu equipo lo sigue." },
  { title: "Tus datos quedan guardados.", desc: "Si pausás o cancelás, no perdés nada. Reactivás cuando quieras." },
] as const;

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

export default function HomePage() {
  return (
    <main style={{ background: "var(--bg)", color: "var(--ink)", minHeight: "100vh", overflowX: "hidden" }}>

      {/* ── Nav sticky global (píldora oscura, funciona sobre ambos fondos) ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, padding: "12px 12px 0", marginBottom: -68 }}>
        <div className="lp-nav" style={{
          maxWidth: 1000, margin: "0 auto", padding: "0 10px 0 18px", height: 56,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(10,46,35,0.78)",
          backdropFilter: "blur(16px) saturate(1.3)", WebkitBackdropFilter: "blur(16px) saturate(1.3)",
          border: "1px solid rgba(255,255,255,0.10)", borderRadius: 999,
          boxShadow: "0 8px 32px -12px rgba(0,0,0,0.4)",
        }}>
          <BrandWordmark size={20} color="#f3f0ea" />
          <div className="hidden md:flex" style={{ gap: 28, fontSize: 14, color: "rgba(243,240,234,0.75)" }}>
            <a href="#como-funciona" className="lp-navlink" style={{ color: "inherit", textDecoration: "none" }}>Cómo funciona</a>
            <a href="#rubros" className="lp-navlink" style={{ color: "inherit", textDecoration: "none" }}>Rubros</a>
            <a href="#demo" className="lp-navlink" style={{ color: "inherit", textDecoration: "none" }}>Demo</a>
            <a href="#planes" className="lp-navlink" style={{ color: "inherit", textDecoration: "none" }}>Planes</a>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Link href="/login" className="lp-btn hidden min-[420px]:inline-flex" style={{ padding: "8px 14px", fontSize: 14, fontWeight: 500, color: "rgba(243,240,234,0.8)", textDecoration: "none", borderRadius: 999 }}>
              Ingresar
            </Link>
            <Link href="/signup" className="lp-btn" style={{ padding: "9px 18px", fontSize: 14, fontWeight: 600, background: "var(--accent)", color: "#fff", borderRadius: 999, textDecoration: "none" }}>
              Probar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ════════ HERO OSCURO FULL-BLEED ════════ */}
      <div style={{
        background: `radial-gradient(1200px 600px at 80% -10%, rgba(61,220,151,0.10), transparent 60%), radial-gradient(900px 500px at -10% 30%, rgba(255,107,77,0.10), transparent 55%), ${DARK}`,
        position: "relative",
        paddingTop: 68,
      }}>
        {/* Hero */}
        <section style={{ maxWidth: 1140, margin: "0 auto", padding: "clamp(44px, 7vw, 90px) 24px clamp(72px, 8vw, 110px)" }}>
          <div className="grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" style={{ gap: "clamp(44px, 5vw, 72px)", alignItems: "center" }}>
            <div className="lp-hero-copy">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 99, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", marginBottom: 28 }}>
                <span className="atd-dot live" style={{ width: 7, height: 7, background: "#3ddc97", boxShadow: "0 0 0 4px rgba(61,220,151,0.18)" }} />
                <span style={{ fontSize: 12.5, fontWeight: 500, color: "rgba(243,240,234,0.85)" }}>Para negocios que venden por WhatsApp</span>
              </div>

              <h1 style={{ fontSize: "clamp(46px, 7.6vw, 86px)", fontWeight: 700, lineHeight: 0.99, letterSpacing: "-0.035em", margin: "0 0 22px", color: "#f3f0ea", maxWidth: 560 }}>
                Tu vendedor{" "}
                <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 500, color: "var(--accent)", whiteSpace: "nowrap" }}>
                  automático
                </span>
                <br />
                por WhatsApp.
              </h1>

              <p style={{ fontSize: "clamp(15px, 2.4vw, 18px)", lineHeight: 1.6, color: "rgba(243,240,234,0.7)", margin: "0 0 32px", maxWidth: 460 }}>
                Responde consultas, toma reservas y capta clientes las 24 hs con la información
                real de tu negocio. Y cuando hace falta una persona, te lo pasa a vos.
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
                <Link href="/signup" className="lp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 30px", fontSize: 16, fontWeight: 600, background: "var(--accent)", color: "#fff", borderRadius: 14, textDecoration: "none", boxShadow: "0 8px 32px -8px rgba(255,107,77,0.5)" }}>
                  Probar gratis 14 días <span className="arrow">→</span>
                </Link>
                <a href="#demo" className="lp-btn" style={{ display: "inline-flex", alignItems: "center", padding: "16px 26px", fontSize: 16, fontWeight: 500, background: "rgba(255,255,255,0.07)", color: "#f3f0ea", borderRadius: 14, textDecoration: "none", border: "1px solid rgba(255,255,255,0.14)" }}>
                  Ver cómo responde
                </a>
              </div>

              <p style={{ fontSize: 12.5, color: "rgba(243,240,234,0.45)", margin: 0, display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
                <span>✓ Sin tarjeta para empezar</span>
                <span>✓ Tu mismo número</span>
                <span>✓ Listo en 5 minutos</span>
              </p>
            </div>

            {/* Teléfono con glow pulsante + chips */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", position: "relative" }}>
              <div className="lp-float" style={{ width: "100%", maxWidth: 320, position: "relative" }}>
                <div className="lp-hero-glow" aria-hidden />
                <div style={{ position: "relative" }}>
                  <HeroPhone />
                </div>
                <span className="hidden sm:inline-flex" style={{ position: "absolute", top: 16, left: -92, zIndex: 2, alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 999, background: "#f3f0ea", boxShadow: "0 8px 28px -6px rgba(0,0,0,0.45)", fontSize: 12, fontWeight: 700, color: "#0d3b2e", transform: "rotate(-4deg)" }}>
                  <Icon name="spark" size={13} /> IA activa
                </span>
                <span className="hidden sm:inline-flex" style={{ position: "absolute", bottom: 90, right: -84, zIndex: 2, alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 999, background: "#f3f0ea", boxShadow: "0 8px 28px -6px rgba(0,0,0,0.45)", fontSize: 12, fontWeight: 700, color: "#b4541f", transform: "rotate(3deg)" }}>
                  🔥 Cliente interesado
                </span>
                <span className="hidden lg:inline-flex" style={{ position: "absolute", bottom: 24, left: -70, zIndex: 2, alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 999, background: "#f3f0ea", boxShadow: "0 8px 28px -6px rgba(0,0,0,0.45)", fontSize: 12, fontWeight: 700, color: "#0d3b2e", transform: "rotate(2deg)" }}>
                  📅 Reserva tomada
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Marquee de capacidades — remate del hero */}
        <div className="lp-marquee-mask" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "18px 0", background: "rgba(0,0,0,0.18)" }} aria-hidden>
          <div className="lp-marquee">
            {[...MARQUEE_PHRASES, ...MARQUEE_PHRASES].map((p, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 18, paddingRight: 18, fontSize: 14, fontWeight: 500, color: "rgba(243,240,234,0.55)", whiteSpace: "nowrap" }}>
                {p} <span style={{ color: "var(--accent)", fontSize: 10 }}>✦</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ════════ CONSULTAS PERDIDAS — burbujas esparcidas ════════ */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(64px, 8vw, 100px) 24px" }}>
        <div className="grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" style={{ gap: "clamp(36px, 5vw, 64px)", alignItems: "center" }}>
          <Reveal>
            <h2 style={{ fontSize: "clamp(32px, 4.6vw, 56px)", fontWeight: 700, lineHeight: 1.04, letterSpacing: "-0.03em", margin: "0 0 18px" }}>
              Mientras leés esto, alguien le escribe{" "}
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--accent)" }}>a tu negocio.</span>
            </h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--ink-2)", margin: 0, maxWidth: 400 }}>
              Cada consulta sin responder es una venta que se enfría. No es falta de ganas —
              es que nadie puede estar en el celular todo el día.
            </p>
          </Reveal>
          <Reveal delay={100} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {MISSED.map((m) => (
              <div
                key={m.time}
                className="lp-sticker"
                style={{
                  transform: `rotate(${m.rot}deg)`,
                  marginLeft: m.x,
                  maxWidth: 430,
                  padding: "16px 20px",
                  borderRadius: "18px 18px 18px 5px",
                  background: "var(--surface)",
                  border: "1px solid var(--hairline)",
                  boxShadow: "var(--shadow-2)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                  <p style={{ fontSize: 15.5, fontWeight: 600, color: "var(--ink)", margin: 0, lineHeight: 1.4 }}>“{m.text}”</p>
                  <span className="mono" style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{m.time}</span>
                </div>
                <p style={{ fontSize: 12.5, color: "#c0392b", margin: 0, fontWeight: 500 }}>✕ {m.status}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ════════ EL GIRO — panel oscuro redondeado con el chat resuelto ════════ */}
      <section style={{ maxWidth: 1140, margin: "0 auto", padding: "0 16px clamp(64px, 8vw, 100px)" }}>
        <div style={{ borderRadius: 36, background: `radial-gradient(800px 400px at 90% 0%, rgba(255,107,77,0.12), transparent 55%), ${DARK}`, padding: "clamp(36px, 5vw, 64px) clamp(20px, 4vw, 56px)", overflow: "hidden" }}>
          <div className="grid md:grid-cols-2" style={{ gap: "clamp(36px, 5vw, 64px)", alignItems: "center" }}>
            <Reveal>
              <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 16, fontFamily: "var(--font-mono)" }}>
                ✦ con atendé
              </p>
              <h2 style={{ fontSize: "clamp(32px, 4.4vw, 54px)", fontWeight: 700, lineHeight: 1.04, letterSpacing: "-0.03em", margin: "0 0 18px", color: "#f3f0ea" }}>
                Esa misma consulta{" "}
                <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--accent)" }}>
                  termina en venta.
                </span>
              </h2>
              <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "rgba(243,240,234,0.65)", margin: "0 0 24px", maxWidth: 420 }}>
                Tu asistente responde al instante con tus precios y horarios reales, toma la
                reserva y le avisa a tu equipo. El cliente nunca queda esperando.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["Responde con tu información", "Toma la reserva", "Avisa a tu equipo"].map((t) => (
                  <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 12.5, color: "rgba(243,240,234,0.85)" }}>
                    <span style={{ color: "#3ddc97", fontWeight: 700 }}>✓</span> {t}
                  </span>
                ))}
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div style={{ borderRadius: 24, background: "var(--bg)", boxShadow: "0 24px 64px -16px rgba(0,0,0,0.5)", overflow: "hidden", maxWidth: 420, margin: "0 auto", width: "100%" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 10, background: "var(--surface)" }}>
                  <span style={{ width: 32, height: 32, borderRadius: 999, background: "var(--green-tint)", color: "var(--green-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>S</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0, color: "var(--ink)" }}>Sofía</p>
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
                    🔔 Aviso a tu equipo: nueva reserva pendiente
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ════════ CÓMO EMPEZÁS — numerales editoriales ════════ */}
      <section id="como-funciona" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px clamp(64px, 8vw, 100px)" }}>
        <Reveal style={{ marginBottom: 44 }}>
          <h2 style={{ fontSize: "clamp(32px, 4.4vw, 54px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            Empezás{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>hoy mismo.</span>
          </h2>
          <p style={{ fontSize: 14.5, color: "var(--ink-3)", margin: "12px 0 0", maxWidth: 480 }}>
            Sin instalaciones raras. Sin configuraciones técnicas. Pensado para negocios reales.
          </p>
        </Reveal>
        <Reveal className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 0 }}>
          {STEPS.map((s, i) => (
            <div key={s.num} style={{ padding: "28px 26px 32px", borderTop: "1px solid var(--hairline-2)", borderLeft: i ? undefined : undefined, position: "relative" }}>
              <span style={{ fontSize: "clamp(56px, 7vw, 84px)", fontWeight: 400, fontFamily: "var(--font-serif)", fontStyle: "italic", color: "transparent", WebkitTextStroke: "1.5px var(--accent)", lineHeight: 1, display: "block", marginBottom: 18 }}>
                {s.num}
              </span>
              <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)", margin: "0 0 8px" }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: "var(--ink-3)", margin: 0, lineHeight: 1.6, maxWidth: 300 }}>{s.desc}</p>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ════════ BENTO — qué hace por tu negocio ════════ */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px clamp(64px, 8vw, 100px)" }}>
        <Reveal style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: "clamp(32px, 4.4vw, 54px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0, maxWidth: 600 }}>
            Trabaja como tu mejor vendedor.{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--accent)" }}>Sin francos.</span>
          </h2>
        </Reveal>
        <Reveal className="grid grid-cols-1 min-[430px]:grid-cols-2 lg:grid-cols-3" style={{ gap: 12 }}>
          {/* Card grande destacada */}
          <div className="lp-card on-dark min-[430px]:col-span-2 lg:col-span-1 lg:row-span-2" style={{
            background: `radial-gradient(400px 300px at 80% 10%, rgba(255,107,77,0.16), transparent 60%), ${DARK}`,
            borderRadius: 22, padding: "28px 26px", display: "flex", flexDirection: "column", justifyContent: "flex-end", minHeight: 280, border: "1px solid transparent",
          }}>
            <span style={{ width: 46, height: 46, borderRadius: 13, background: "rgba(255,255,255,0.09)", color: "#f3f0ea", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "auto" }}>
              <Icon name="clock" size={22} />
            </span>
            <h3 style={{ fontSize: 24, fontWeight: 700, color: "#f3f0ea", margin: "18px 0 8px", lineHeight: 1.15 }}>
              Responde 24/7
            </h3>
            <p style={{ fontSize: 14, color: "rgba(243,240,234,0.6)", margin: 0, lineHeight: 1.6 }}>
              De noche, los feriados y cuando estás con las manos ocupadas. El 40% de las
              consultas llegan fuera de horario — ahora tienen respuesta.
            </p>
          </div>
          {BENTO_SMALL.map((b) => (
            <div key={b.title} className="lp-card" style={{ padding: 22, borderRadius: 20, background: "var(--surface)", border: "1px solid var(--hairline)", display: "flex", flexDirection: "column", gap: 13 }}>
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

      {/* ════════ RUBROS — doble marquee ════════ */}
      <section id="rubros" style={{ borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)", background: "var(--bg-elev)", padding: "clamp(56px, 7vw, 84px) 0" }}>
        <Reveal style={{ maxWidth: 1100, margin: "0 auto 36px", padding: "0 24px", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(32px, 4.4vw, 54px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            No arranca de cero:{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>ya conoce tu rubro.</span>
          </h2>
          <p style={{ maxWidth: 540, margin: "14px auto 0", fontSize: 15, lineHeight: 1.7, color: "var(--ink-3)" }}>
            Elegís tu rubro y Atende carga preguntas frecuentes, tono y reglas pensadas para tu
            negocio. Vos solo completás tus precios, horarios y datos reales.
          </p>
        </Reveal>
        <div className="lp-marquee-mask" aria-hidden style={{ marginBottom: 12 }}>
          <div className="lp-marquee slow">
            {[...RUBROS_ROW_1, ...RUBROS_ROW_1].map((r, i) => (
              <span key={i} style={{ display: "inline-block", margin: "0 6px", padding: "12px 22px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--hairline)", fontSize: 15, fontWeight: 500, color: "var(--ink)", whiteSpace: "nowrap", boxShadow: "var(--shadow-1)" }}>
                {r}
              </span>
            ))}
          </div>
        </div>
        <div className="lp-marquee-mask" aria-hidden>
          <div className="lp-marquee slow reverse">
            {[...RUBROS_ROW_2, ...RUBROS_ROW_2].map((r, i) => (
              <span key={i} style={{ display: "inline-block", margin: "0 6px", padding: "12px 22px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--hairline)", fontSize: 15, fontWeight: 500, color: "var(--ink)", whiteSpace: "nowrap", boxShadow: "var(--shadow-1)" }}>
                {r}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ DEMO INTERACTIVA ════════ */}
      <section id="demo" style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(64px, 8vw, 100px) 24px" }}>
        <div className="grid md:grid-cols-2" style={{ gap: 56, alignItems: "center" }}>
          <Reveal>
            <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 14, fontFamily: "var(--font-mono)" }}>
              ✦ probalo ahora
            </p>
            <h2 style={{ fontSize: "clamp(32px, 4.4vw, 54px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: "0 0 18px", maxWidth: 460 }}>
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

      {/* ════════ CONTROL HUMANO ════════ */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px clamp(64px, 8vw, 100px)" }}>
        <div className="grid md:grid-cols-2" style={{ gap: 56, alignItems: "start" }}>
          <Reveal>
            <h2 style={{ fontSize: "clamp(32px, 4.4vw, 54px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: "0 0 18px" }}>
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

      {/* ════════ PLANES ════════ */}
      <section id="planes" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px clamp(64px, 8vw, 100px)" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 14 }}>
          <h2 style={{ fontSize: "clamp(32px, 4.4vw, 54px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
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

      {/* ════════ FAQ ════════ */}
      <section id="preguntas" style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px clamp(72px, 8vw, 100px)" }}>
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

      {/* ════════ CTA FINAL ════════ */}
      <section style={{ background: `radial-gradient(900px 500px at 50% 120%, rgba(255,107,77,0.16), transparent 60%), ${DARK}`, padding: "clamp(72px, 9vw, 110px) 24px 72px" }}>
        <Reveal style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(38px, 5.6vw, 68px)", fontWeight: 700, lineHeight: 1.03, letterSpacing: "-0.035em", color: "#f3f0ea", margin: "0 0 18px" }}>
            Tu próximo cliente{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--accent)" }}>
              ya te está escribiendo.
            </span>
          </h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "rgba(243,240,234,0.55)", margin: "0 auto 38px", maxWidth: 420 }}>
            Conectá tu WhatsApp, elegí tu rubro y dejá que tu asistente responda por vos.
            No necesitás saber de tecnología.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 18 }}>
            <Link href="/signup" className="lp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 30px", fontSize: 16, fontWeight: 600, background: "var(--accent)", color: "#fff", borderRadius: 14, textDecoration: "none", boxShadow: "0 8px 32px -8px rgba(255,107,77,0.5)" }}>
              Probar gratis 14 días <span className="arrow">→</span>
            </Link>
            <a href="#demo" className="lp-btn" style={{ display: "inline-flex", alignItems: "center", padding: "16px 26px", fontSize: 16, fontWeight: 500, background: "rgba(255,255,255,0.07)", color: "rgba(243,240,234,0.85)", borderRadius: 14, textDecoration: "none", border: "1px solid rgba(255,255,255,0.14)" }}>
              Ver cómo responde
            </a>
          </div>
          <p style={{ fontSize: 12.5, color: "rgba(243,240,234,0.4)", margin: "0 0 56px" }}>
            Sin tarjeta · cancelá cuando quieras · sin compromiso
          </p>
          <BrandWordmark size={20} color="rgba(243,240,234,0.5)" />
          <p style={{ marginTop: 18, fontSize: 12, color: "rgba(243,240,234,0.35)", display: "flex", gap: 16, justifyContent: "center" }}>
            <Link href="/terminos" style={{ color: "inherit", textDecoration: "none" }}>Términos y Condiciones</Link>
            <Link href="/privacidad" style={{ color: "inherit", textDecoration: "none" }}>Política de Privacidad</Link>
          </p>
        </Reveal>
      </section>

    </main>
  );
}
