import Link from "next/link";
import BrandWordmark from "@/components/public/BrandWordmark";
import Reveal from "@/components/public/Reveal";
import HeroPhone from "@/components/public/HeroPhone";
import TryDemo from "@/components/public/TryDemo";
import Objections from "@/components/public/Objections";
import { PUBLIC_PLAN_LIST } from "@/lib/plan-display";

// ── Data ─────────────────────────────────────────────────────────────────────

const PROBLEMS = [
  { num: "01", title: "Tardás en responder", desc: "Y los clientes compran en otro lado." },
  { num: "02", title: "Las mismas preguntas", desc: "Precio, stock, envíos, cuotas. Todo el día." },
  { num: "03", title: "No sabés quién compra", desc: "Conversaciones perdidas en el chat." },
  { num: "04", title: "WhatsApp desordenado", desc: "Mezcla familia, trabajo y ventas." },
  { num: "05", title: "No respondés de noche", desc: "Y ahí es cuando muchos preguntan." },
];

const STEPS = [
  { num: "1", title: "Registrá tu negocio", desc: "Cargá el nombre, 30 segundos, lista la IA." },
  { num: "2", title: "Elegí tu plan", desc: "Starter para arrancar. Pro para vender más." },
  { num: "3", title: "Conectá WhatsApp", desc: "Escaneá un QR. Listo." },
  { num: "4", title: "Aplicá tu plantilla", desc: "Por rubro. Directo, ya probado." },
  { num: "5", title: "Tu asistente responde", desc: "Vos lo ves. Escalá. IA + vos." },
];

const SMALL_FEATURES = [
  { icon: "hand", title: "Modo humano", desc: "Tomá el control cuando quieras. La IA se detiene." },
  { icon: "template", title: "Plantillas por rubro", desc: "Configurá tu asistente en minutos según tu negocio." },
  { icon: "catalog", title: "Catálogo", desc: "Cargá productos, precios y servicios para respuestas más precisas." },
  { icon: "team", title: "Equipo", desc: "Invitá personas y definí roles según tu plan." },
  { icon: "chart", title: "Métricas", desc: "Entendé qué preguntan y cómo responde tu asistente." },
  { icon: "star", title: "Valoración", desc: "Detectá si la IA está ayudando o necesita ajustes." },
] as const;

const SOCIAL_PROOF = [
  { icon: "bolt", title: "Responde en segundos", desc: "Sin que el cliente espere." },
  { icon: "clock", title: "Disponible 24/7", desc: "De día, de noche y feriados." },
  { icon: "layers", title: "Muchas a la vez", desc: "Atiende varias consultas juntas." },
  { icon: "bell", title: "Nunca se olvida", desc: "Ningún mensaje queda sin responder." },
  { icon: "whatsapp", title: "Tu mismo WhatsApp", desc: "Tu número de siempre." },
] as const;

const TEMPLATES = [
  { emoji: "📱", name: "Tienda de celulares", desc: "Productos, financiación, modelos y gigas.", count: "8 de 32 plantillas" },
  { emoji: "👗", name: "Indumentaria", desc: "Talla, colores, cuidados y envíos.", count: "7 de 14 plantillas" },
  { emoji: "✂️", name: "Peluquería / estética", desc: "Turnos, servicios, promociones y el tono.", count: "12 de 26 plantillas" },
  { emoji: "🍽️", name: "Restaurante / comida", desc: "Menú, horarios, delivery y más.", count: "5 de 18 plantillas" },
  { emoji: "🎵", name: "Eventos / bolche", desc: "Programación, ubicación, lineup y fangs.", count: "9 de 13 plantillas" },
  { emoji: "🔧", name: "Servicios", desc: "Cotizaciones, horarios y soluciones.", count: "4 de 11 plantillas" },
];

// ── Iconos (line-style, premium) ───────────────────────────────────────────────

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "hand":
      return <svg {...common}><path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2a8 8 0 0 1-7.5-5.2L2.8 15a2 2 0 0 1 3.5-2" /></svg>;
    case "template":
      return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
    case "catalog":
      return <svg {...common}><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></svg>;
    case "team":
      return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.5a3 3 0 0 1 0 5.8M21 20a6 6 0 0 0-4-5.6" /></svg>;
    case "chart":
      return <svg {...common}><path d="M3 3v18h18" /><path d="M7 14l3-4 3 3 5-7" /></svg>;
    case "star":
      return <svg {...common}><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9L12 3z" /></svg>;
    case "bolt":
      return <svg {...common}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "layers":
      return <svg {...common}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5M3 18l9 5 9-5" /></svg>;
    case "bell":
      return <svg {...common}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>;
    case "whatsapp":
      return <svg {...common}><path d="M21 11.5a8.5 8.5 0 0 1-12.7 7.4L3 21l2.2-5.1A8.5 8.5 0 1 1 21 11.5z" /><path d="M8.5 9c0 3.6 2.9 6.5 6.5 6.5" /></svg>;
    case "spark":
      return <svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <main style={{ background: "var(--bg)", color: "var(--ink)", minHeight: "100vh", overflowX: "hidden" }}>

      {/* ── Navbar flotante ────────────────────────────────────────── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, padding: "12px 12px 0" }}>
        <div className="lp-nav" style={{
          maxWidth: 1000, margin: "0 auto",
          padding: "0 10px 0 18px", height: 56,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "color-mix(in oklab, var(--bg-elev) 78%, transparent)",
          backdropFilter: "blur(16px) saturate(1.4)",
          WebkitBackdropFilter: "blur(16px) saturate(1.4)",
          border: "1px solid var(--hairline)",
          borderRadius: 999,
          boxShadow: "var(--shadow-2)",
        }}>
          <BrandWordmark size={20} />

          <div className="hidden md:flex" style={{ gap: 28, fontSize: 14, color: "var(--ink-2)" }}>
            <a href="#demo" className="lp-navlink" style={{ color: "inherit", textDecoration: "none" }}>Demo</a>
            <a href="#como-funciona" className="lp-navlink" style={{ color: "inherit", textDecoration: "none" }}>Cómo funciona</a>
            <a href="#funciones" className="lp-navlink" style={{ color: "inherit", textDecoration: "none" }}>Funciones</a>
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

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(36px, 6vw, 72px) 24px clamp(48px, 7vw, 84px)" }}>
        <div className="grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]" style={{ gap: "clamp(36px, 5vw, 64px)", alignItems: "center" }}>
          <div className="lp-hero-copy">
            {/* Badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 13px", borderRadius: 99, background: "var(--surface)", border: "1px solid var(--hairline)", marginBottom: 24, boxShadow: "var(--shadow-1)" }}>
              <span className="atd-dot live" style={{ width: 7, height: 7, background: "var(--accent)", boxShadow: "0 0 0 4px color-mix(in oklab, var(--accent) 22%, transparent)" }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-2)" }}>Asistente de ventas con IA · WhatsApp</span>
            </div>

            {/* Heading */}
            <h1 style={{ fontSize: "clamp(40px, 6.4vw, 70px)", fontWeight: 700, lineHeight: 1.02, letterSpacing: "-0.03em", margin: "0 0 18px", maxWidth: 540 }}>
              Respondé a tus clientes{" "}
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 500, color: "var(--accent)" }}>
                hasta cuando dormís.
              </span>
            </h1>

            {/* Body */}
            <p style={{ fontSize: "clamp(15px, 2.4vw, 17px)", lineHeight: 1.6, color: "var(--ink-2)", margin: "0 0 28px", maxWidth: 440 }}>
              Tu asistente con IA atiende tu WhatsApp las 24 horas: responde consultas, recomienda y agenda turnos solo. Vos decidís cuándo intervenir.
            </p>

            {/* CTAs */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <Link href="/signup" className="lp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "14px 26px", fontSize: 15.5, fontWeight: 600, background: "var(--ink)", color: "#fff", borderRadius: 12, textDecoration: "none", boxShadow: "var(--shadow-2)" }}>
                Probar gratis 14 días <span className="arrow">→</span>
              </Link>
              <a href="#demo" className="lp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "14px 24px", fontSize: 15.5, fontWeight: 500, background: "var(--surface)", color: "var(--ink)", borderRadius: 12, textDecoration: "none", border: "1px solid var(--hairline-2)" }}>
                Ver demo
              </a>
            </div>

            {/* Trust */}
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0, display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
              <span>✓ Sin tarjeta</span>
              <span>✓ Cancelá cuando quieras</span>
              <span>✓ Sin saber de tecnología</span>
            </p>
          </div>

          {/* Teléfono vivo */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div className="lp-float" style={{ width: "100%", maxWidth: 320 }}>
              <HeroPhone />
            </div>
          </div>
        </div>
      </section>

      {/* ── Prueba social ──────────────────────────────────────────── */}
      <section style={{ borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)", background: "var(--bg-elev)" }}>
        <Reveal className="grid grid-cols-2 md:grid-cols-5" style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px", gap: 8 }}>
          {SOCIAL_PROOF.map((s) => (
            <div key={s.title} style={{ display: "flex", flexDirection: "column", gap: 9, padding: "8px 10px" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "var(--green-tint)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={s.icon} size={18} />
              </span>
              <div>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3 }}>{s.title}</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--ink-3)", lineHeight: 1.4 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ── El Problema ────────────────────────────────────────────── */}
      <section id="problema" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        <Reveal style={{ marginBottom: 44 }}>
          <h2 style={{ fontSize: "clamp(34px, 4.5vw, 58px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0, maxWidth: 700 }}>
            Vender por WhatsApp{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--accent)" }}>
              te consume el día.
            </span>
          </h2>
        </Reveal>

        <Reveal className="grid grid-cols-2 md:grid-cols-5" style={{ gap: 12 }}>
          {PROBLEMS.map((p) => (
            <div key={p.num} className="lp-card" style={{ padding: "20px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--hairline)" }}>
              <span style={{ display: "block", width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", marginBottom: 14 }} />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", margin: "0 0 6px", lineHeight: 1.3 }}>{p.title}</h3>
              <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: 0, lineHeight: 1.5 }}>{p.desc}</p>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ── En cinco pasos ─────────────────────────────────────────── */}
      <section id="como-funciona" style={{ background: "var(--green)", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(34px, 4.5vw, 58px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", color: "#fff", margin: 0 }}>
              En{" "}
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>cinco pasos.</span>
            </h2>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>Tiempo total: ~5 minutos.</span>
          </div>

          <Reveal className="grid grid-cols-2 md:grid-cols-5" style={{ gap: 20 }}>
            {STEPS.map((s) => (
              <div key={s.num}>
                <div style={{ fontSize: "clamp(40px, 4.5vw, 60px)", fontWeight: 700, color: "rgba(255,255,255,0.12)", lineHeight: 1, marginBottom: 14, fontFamily: "var(--font-serif)" }}>
                  {s.num}
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: "0 0 6px", lineHeight: 1.3 }}>{s.title}</h3>
                <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.55 }}>{s.desc}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Demo interactiva ───────────────────────────────────────── */}
      <section id="demo" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <div className="grid md:grid-cols-2" style={{ gap: 56, alignItems: "center" }}>
          <Reveal>
            <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 14, fontFamily: "var(--font-mono)" }}>
              ✦ probalo ahora
            </p>
            <h2 style={{ fontSize: "clamp(32px, 4.2vw, 52px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: "0 0 18px", maxWidth: 460 }}>
              Probalo{" "}
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--accent)" }}>
                ahora mismo.
              </span>
            </h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--ink-2)", margin: "0 0 22px", maxWidth: 410 }}>
              Escribí una consulta como lo haría un cliente y mirá cómo respondería. Sin registrarte y sin conectar WhatsApp.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["Sin registro", "Sin conectar WhatsApp", "Es solo una demo"].map((t) => (
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

      {/* ── Funciones ──────────────────────────────────────────────── */}
      <section id="funciones" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <Reveal style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            Todo lo que{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>tu WhatsApp</span>{" "}
            necesita.
          </h2>
          <p style={{ maxWidth: 540, margin: "14px 0 0", fontSize: 15, lineHeight: 1.7, color: "var(--ink-3)" }}>
            Una estructura simple para atender, vender y controlar la calidad sin que la experiencia se rompa en mobile.
          </p>
        </Reveal>

        <Reveal className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-stretch">
          <div className="lp-card on-dark" style={{
            background: "linear-gradient(165deg, var(--green-2) 0%, var(--green) 70%)", borderRadius: 20, padding: "28px 28px 32px",
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
            minHeight: 260, border: "1px solid transparent", position: "relative", overflow: "hidden",
          }}>
            <span style={{ position: "absolute", top: 26, left: 28, width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <Icon name="spark" size={24} />
            </span>
            <h3 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 10px", lineHeight: 1.2 }}>IA para responder</h3>
            <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.55 }}>
              Responde consultas con la información real de tu negocio, como lo haría tu mejor vendedor.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 xl:grid-cols-3">
            {SMALL_FEATURES.map((f) => (
              <div key={f.title} className="lp-card" style={{ background: "var(--surface)", borderRadius: 18, padding: "20px 20px 18px", border: "1px solid var(--hairline)", display: "flex", flexDirection: "column", gap: 14, minHeight: 168 }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--surface-2)", border: "1px solid var(--hairline)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name={f.icon} size={20} />
                </span>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", margin: "0 0 8px", lineHeight: 1.3 }}>{f.title}</h4>
                  <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0, lineHeight: 1.55 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Plantillas ─────────────────────────────────────────────── */}
      <section id="plantillas" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        <Reveal style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            Plantillas listas{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>para tu rubro.</span>
          </h2>
          <p style={{ maxWidth: 540, margin: "14px 0 0", fontSize: 15, lineHeight: 1.7, color: "var(--ink-3)" }}>
            Ideal para negocios que reciben consultas todos los días. Elegís tu rubro y tu asistente arranca configurado.
          </p>
        </Reveal>

        <Reveal className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 12 }}>
          {TEMPLATES.map((t) => (
            <div key={t.name} className="lp-card" style={{ background: "var(--surface)", borderRadius: 18, padding: 22, border: "1px solid var(--hairline)", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <span style={{ fontSize: 28, lineHeight: 1 }}>{t.emoji}</span>
                <span style={{ fontSize: 16, color: "var(--muted)" }}>→</span>
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: "0 0 5px" }}>{t.name}</h3>
                <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 10px", lineHeight: 1.45 }}>{t.desc}</p>
                <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{t.count}</span>
              </div>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ── Planes ─────────────────────────────────────────────────── */}
      <section id="planes" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        <Reveal style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <h2 style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            Elegí el plan que mejor acompaña a tu negocio.
          </h2>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Precios mensuales en ARS.</span>
        </Reveal>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", margin: "0 0 36px", display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
          <span>✓ Probalo gratis 14 días</span>
          <span>✓ Sin tarjeta para empezar</span>
          <span>✓ Cancelá cuando quieras</span>
        </p>

        <Reveal className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 12, alignItems: "stretch" }}>
          {PUBLIC_PLAN_LIST.map((plan) => {
            const featured = plan.code === "pro";

            return (
            <div key={plan.code} className={`lp-card ${featured ? "on-dark" : ""}`} style={{
              borderRadius: 22, padding: "28px 28px 24px",
              background: featured ? "var(--ink)" : "var(--surface)",
              border: featured ? "1px solid transparent" : "1px solid var(--hairline)",
              display: "flex", flexDirection: "column", position: "relative",
            }}>
              {plan.badge && (
                <div style={{ position: "absolute", top: -13, right: 22, padding: "4px 14px", borderRadius: 99, background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700 }}>
                  {plan.badge}
                </div>
              )}
              <p style={{ fontSize: 12, fontWeight: 500, color: featured ? "var(--accent)" : "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10, fontFamily: "var(--font-mono)" }}>
                {plan.description}
              </p>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: featured ? "#fff" : "var(--ink)", margin: "0 0 8px" }}>{plan.name}</h3>
              <p style={{ fontSize: 38, fontWeight: 700, color: featured ? "#fff" : "var(--ink)", lineHeight: 1.02, margin: "0 0 24px" }}>
                {plan.priceLabel}
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                {plan.features.map((feature) => (
                  <li key={feature} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13, color: featured ? "rgba(255,255,255,0.7)" : "var(--ink-2)", lineHeight: 1.5 }}>
                    <span style={{ color: featured ? "rgba(255,255,255,0.45)" : "var(--green)", flexShrink: 0, fontSize: 14, fontWeight: 600 }}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={`/signup?plan=${plan.code}`}
                className="lp-btn"
                style={{
                  display: "block", textAlign: "center",
                  padding: "13px 20px", borderRadius: 12,
                  fontSize: 14, fontWeight: 600, textDecoration: "none",
                  background: featured ? "var(--accent)" : "var(--ink)",
                  color: "#fff", whiteSpace: "nowrap",
                }}
              >
                {plan.cta}
              </Link>
            </div>
          );
          })}
        </Reveal>
      </section>

      {/* ── Control ────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        <div className="grid md:grid-cols-2" style={{ gap: 64, alignItems: "start" }}>
          <Reveal>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: "0 0 20px" }}>
              Tu negocio{" "}
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>siempre</span>{" "}
              bajo control.
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--ink-2)", margin: 0 }}>
              La IA es una herramienta, no un piloto automático. Vos seguís siendo el dueño de tus conversaciones y podés tomar el control cuando querés.
            </p>
          </Reveal>
          <Reveal delay={100} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { title: "Ves todo cuando querés, cuando hace falta.", desc: "El inbox muestra el historial completo en tiempo real." },
              { title: "Tu información, tus respuestas.", desc: "Nada se va a donde no te importa." },
              { title: "Conversaciones a destino.", desc: "Derivación segura y controlada." },
              { title: "Estás donde querés.", desc: "Decidís cuándo entrar a la conversación." },
            ].map((f) => (
              <div key={f.title} className="lp-card" style={{ padding: 18, borderRadius: 16, background: "var(--surface)", border: "1px solid var(--hairline)" }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", margin: "0 0 6px", lineHeight: 1.4 }}>{f.title}</h4>
                <p style={{ fontSize: 12, color: "var(--ink-3)", margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Preguntas frecuentes / objeciones ──────────────────────── */}
      <section id="preguntas" style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 90px" }}>
        <Reveal style={{ marginBottom: 32, textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            Sin letra chica,{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--accent)" }}>sin compromiso.</span>
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <Objections />
        </Reveal>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section style={{ background: "var(--green)", padding: "80px 24px 72px" }}>
        <Reveal style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", color: "#fff", margin: "0 0 16px" }}>
            Tu próximo cliente{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--accent)" }}>
              ya te está escribiendo.
            </span>
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,0.5)", margin: "0 auto 36px", maxWidth: 400 }}>
            Conectás WhatsApp y tu asistente empieza a responder. No necesitás saber de tecnología.
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
        </Reveal>
      </section>

    </main>
  );
}
