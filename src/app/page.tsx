import Link from "next/link";
import BrandWordmark from "@/components/public/BrandWordmark";
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
  { num: "02", title: "Modo humano", desc: "Tomá el control cuando quieras. La IA se detiene." },
  { num: "03", title: "Plantillas por rubro", desc: "Configurá tu asistente en minutos según tu negocio." },
  { num: "04", title: "Catálogo", desc: "Cargá productos, precios y servicios para respuestas más precisas." },
  { num: "05", title: "Equipo", desc: "Invitá personas y definí roles según tu plan." },
  { num: "06", title: "Métricas", desc: "Entendé qué preguntan y cómo responde tu asistente." },
  { num: "07", title: "Valoración", desc: "Detectá si la IA está ayudando o necesita ajustes." },
];

const TEMPLATES = [
  { emoji: "📱", name: "Tienda de celulares", desc: "Productos, financiación, modelos y gigas.", count: "8 de 32 plantillas" },
  { emoji: "👗", name: "Indumentaria", desc: "Talla, colores, cuidados y envíos.", count: "7 de 14 plantillas" },
  { emoji: "✂️", name: "Peluquería / estética", desc: "Turnos, servicios, promociones y el tono.", count: "12 de 26 plantillas" },
  { emoji: "🍽️", name: "Restaurante / comida", desc: "Menú, horarios, delivery y más.", count: "5 de 18 plantillas" },
  { emoji: "🎵", name: "Eventos / bolche", desc: "Programación, ubicación, lineup y fangs.", count: "9 de 13 plantillas" },
  { emoji: "🔧", name: "Servicios", desc: "Cotizaciones, horarios y soluciones.", count: "4 de 11 plantillas" },
];

// ── Phone Mockup ──────────────────────────────────────────────────────────────

function PhoneMockup() {
  return (
    <div style={{ position: "relative", width: 260, flexShrink: 0 }}>
      {/* Notification badge */}
      <div style={{
        position: "absolute", top: -14, right: -14, zIndex: 2,
        background: "var(--ink)", color: "#fff", borderRadius: 12,
        padding: "7px 13px", fontSize: 12, fontWeight: 600,
        border: "2px solid var(--bg)", whiteSpace: "nowrap",
      }}>
        +47 nuevos contactos
      </div>

      {/* Phone frame */}
      <div style={{
        background: "#1c1c1e", borderRadius: 46, padding: "14px 10px",
        boxShadow: "0 40px 100px -20px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)",
      }}>
        {/* Screen */}
        <div style={{ background: "#e5ddd5", borderRadius: 36, overflow: "hidden" }}>
          {/* WhatsApp header */}
          <div style={{ background: "#075e54", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#25d366", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>M</div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#fff", lineHeight: 1.2 }}>Marina - cliente</p>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.65)" }}>respondido con IA</p>
            </div>
          </div>

          {/* Messages */}
          <div style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: 8, minHeight: 340 }}>
            <Bubble from="them">¿Tenían iPhone 14 en negro?</Bubble>
            <Bubble from="me">Hola Marina! Sí, en negro y azul. $1.299.000 o 12 cuotas. ¿Lo querés con envío?</Bubble>
            <Bubble from="them">Sí, a Caballito.</Bubble>
            <Bubble from="me">Llega mañana sin cargo. Te paso el link de pago 🔗</Bubble>
          </div>

          {/* Input bar */}
          <div style={{ background: "#f0f0f0", padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, background: "#fff", borderRadius: 22, padding: "8px 12px", fontSize: 12, color: "#aaa" }}>Mensaje...</div>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#25d366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l14-6-6 14-2-6-6-2z"/></svg>
            </div>
          </div>
        </div>
      </div>

      {/* Connected badge */}
      <div style={{
        position: "absolute", bottom: -14, left: "50%", transform: "translateX(-50%)",
        background: "#fff", border: "1px solid rgba(0,0,0,0.1)",
        borderRadius: 99, padding: "7px 16px",
        display: "flex", alignItems: "center", gap: 7,
        fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
      }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#25d366", flexShrink: 0 }} />
        WhatsApp conectado
      </div>
    </div>
  );
}

function Bubble({ from, children }: { from: "me" | "them"; children: React.ReactNode }) {
  const isMe = from === "me";
  return (
    <div style={{
      alignSelf: isMe ? "flex-end" : "flex-start",
      maxWidth: "78%",
      background: isMe ? "#dcf8c6" : "#fff",
      borderRadius: isMe ? "14px 14px 0 14px" : "14px 14px 14px 0",
      padding: "8px 12px",
      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
    }}>
      <p style={{ margin: 0, fontSize: 12.5, color: "#111", lineHeight: 1.45 }}>{children}</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <main style={{ background: "var(--bg)", color: "var(--ink)", minHeight: "100vh", overflowX: "hidden" }}>

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "color-mix(in oklab, var(--bg) 92%, transparent)",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--hairline)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 62, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <BrandWordmark size={20} />

          <div className="hidden md:flex" style={{ gap: 32, fontSize: 14, color: "var(--ink-2)" }}>
            <a href="#como-funciona" style={{ color: "inherit", textDecoration: "none" }}>Cómo funciona</a>
            <a href="#funciones" style={{ color: "inherit", textDecoration: "none" }}>Funciones</a>
            <a href="#planes" style={{ color: "inherit", textDecoration: "none" }}>Planes</a>
            <a href="#plantillas" style={{ color: "inherit", textDecoration: "none" }}>Casos</a>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link href="/login" style={{ padding: "8px 14px", fontSize: 14, fontWeight: 500, color: "var(--ink-2)", textDecoration: "none", borderRadius: 8 }}>
              Ingresar
            </Link>
            <Link href="/signup" style={{ padding: "9px 20px", fontSize: 14, fontWeight: 600, background: "var(--ink)", color: "#fff", borderRadius: 10, textDecoration: "none" }}>
              Empezar
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px 100px" }}>
        <div className="grid md:grid-cols-2" style={{ gap: 64, alignItems: "center" }}>
          <div>
            {/* Badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 13px", borderRadius: 99, background: "var(--surface)", border: "1px solid var(--hairline)", marginBottom: 28 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-2)" }}>Asistente comercial para WhatsApp</span>
            </div>

            {/* Heading */}
            <h1 style={{ fontSize: "clamp(42px, 6vw, 72px)", fontWeight: 700, lineHeight: 1.03, letterSpacing: "-0.03em", margin: "0 0 20px", maxWidth: 520 }}>
              Tu vendedor automático{" "}
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 500 }}>
                por WhatsApp.
              </span>
            </h1>

            {/* Body */}
            <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--ink-2)", margin: "0 0 32px", maxWidth: 420 }}>
              Respondé consultas, captá clientes y vendé más sin estar todo el día pendiente del celular. La IA responde con la información real de tu negocio. Vos decidís cuándo entrar.
            </p>

            {/* CTAs */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
              <Link href="/signup" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "13px 24px", fontSize: 15, fontWeight: 600, background: "var(--ink)", color: "#fff", borderRadius: 12, textDecoration: "none" }}>
                Empezar ahora <span>→</span>
              </Link>
              <a href="#como-funciona" style={{ display: "inline-flex", alignItems: "center", padding: "13px 22px", fontSize: 15, fontWeight: 500, background: "var(--surface)", color: "var(--ink-2)", borderRadius: 12, textDecoration: "none", border: "1px solid var(--hairline)" }}>
                Ver cómo funciona
              </a>
            </div>

            {/* Trust */}
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
              · Planes claros &nbsp;·&nbsp; onboarding simple &nbsp;·&nbsp; plantillas por rubro
            </p>
          </div>

          {/* Phone mockup */}
          <div className="hidden md:flex" style={{ justifyContent: "center", alignItems: "center" }}>
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* ── El Problema ────────────────────────────────────────────── */}
      <section id="problema" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        <div style={{ marginBottom: 44 }}>
          <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 14, fontFamily: "var(--font-mono)" }}>
            02 · el problema
          </p>
          <h2 style={{ fontSize: "clamp(34px, 4.5vw, 58px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0, maxWidth: 700 }}>
            Vender por WhatsApp{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--accent)" }}>
              te consume el día.
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5" style={{ gap: 12 }}>
          {PROBLEMS.map((p) => (
            <div key={p.num} style={{ padding: "20px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--hairline)" }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: "var(--muted)", marginBottom: 10, fontFamily: "var(--font-mono)" }}>{p.num}</p>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", margin: "0 0 6px", lineHeight: 1.3 }}>{p.title}</h3>
              <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: 0, lineHeight: 1.5 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── En cinco pasos ─────────────────────────────────────────── */}
      <section id="como-funciona" style={{ background: "var(--green)", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 14, fontFamily: "var(--font-mono)" }}>
            04 · cómo funciona
          </p>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(34px, 4.5vw, 58px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", color: "#fff", margin: 0 }}>
              En{" "}
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>cinco pasos.</span>
            </h2>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>Tiempo total: ~5 minutos.</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5" style={{ gap: 20 }}>
            {STEPS.map((s) => (
              <div key={s.num}>
                <div style={{ fontSize: "clamp(40px, 4.5vw, 60px)", fontWeight: 700, color: "rgba(255,255,255,0.12)", lineHeight: 1, marginBottom: 14, fontFamily: "var(--font-serif)" }}>
                  {s.num}
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: "0 0 6px", lineHeight: 1.3 }}>{s.title}</h3>
                <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.55 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Funciones ──────────────────────────────────────────────── */}
      <section id="funciones" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            Todo lo que{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>tu WhatsApp</span>{" "}
            necesita.
          </h2>
          <p style={{ maxWidth: 540, margin: "14px 0 0", fontSize: 15, lineHeight: 1.7, color: "var(--ink-3)" }}>
            Una estructura simple para atender, vender y controlar la calidad sin que la experiencia se rompa en mobile.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-stretch">
          <div style={{
            background: "var(--green)", borderRadius: 20, padding: "28px 28px 32px",
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
            minHeight: 260,
          }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 12, fontFamily: "var(--font-mono)" }}>01</p>
            <h3 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 10px", lineHeight: 1.2 }}>IA para responder</h3>
            <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.55 }}>
              Responde consultas con la información real de tu negocio.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 xl:grid-cols-3">
            {SMALL_FEATURES.map((f) => (
              <div key={f.num} style={{ background: "var(--surface)", borderRadius: 18, padding: "20px 20px 18px", border: "1px solid var(--hairline)", display: "flex", flexDirection: "column", gap: 14, minHeight: 168 }}>
                <p style={{ fontSize: 10, fontWeight: 500, color: "var(--muted)", margin: 0, fontFamily: "var(--font-mono)" }}>{f.num}</p>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", margin: "0 0 8px", lineHeight: 1.3 }}>{f.title}</h4>
                  <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0, lineHeight: 1.55 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Plantillas ─────────────────────────────────────────────── */}
      <section id="plantillas" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            Plantillas listas{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>para tu rubro.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 12 }}>
          {TEMPLATES.map((t) => (
            <div key={t.name} style={{ background: "var(--surface)", borderRadius: 18, padding: 22, border: "1px solid var(--hairline)", display: "flex", flexDirection: "column", gap: 14 }}>
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
        </div>
      </section>

      {/* ── Planes ─────────────────────────────────────────────────── */}
      <section id="planes" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 36 }}>
          <h2 style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>
            Elegí el plan que mejor acompaña a tu negocio.
          </h2>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Precios mensuales en ARS.</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 12, alignItems: "stretch" }}>
          {PUBLIC_PLAN_LIST.map((plan) => {
            const featured = plan.code === "pro";

            return (
            <div key={plan.code} style={{
              borderRadius: 22, padding: "28px 28px 24px",
              background: featured ? "var(--ink)" : "var(--surface)",
              border: featured ? "none" : "1px solid var(--hairline)",
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
        </div>
      </section>

      {/* ── Control ────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        <div className="grid md:grid-cols-2" style={{ gap: 64, alignItems: "start" }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 14, fontFamily: "var(--font-mono)" }}>
              05 · control
            </p>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", margin: "0 0 20px" }}>
              Tu negocio{" "}
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>siempre</span>{" "}
              bajo control.
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--ink-2)", margin: 0 }}>
              La IA es una herramienta, no un piloto automático. Vos seguís siendo el dueño de tus conversaciones y podés tomar el control cuando querés.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { title: "Ves todo cuando querés, cuando hace falta.", desc: "El inbox muestra el historial completo en tiempo real." },
              { title: "Tu información, tus respuestas.", desc: "Nada se va a donde no te importa." },
              { title: "Conversaciones a destino.", desc: "Derivación segura y controlada." },
              { title: "Estás donde querés.", desc: "Decidís cuándo entrar a la conversación." },
            ].map((f) => (
              <div key={f.title} style={{ padding: 18, borderRadius: 16, background: "var(--surface)", border: "1px solid var(--hairline)" }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", margin: "0 0 6px", lineHeight: 1.4 }}>{f.title}</h4>
                <p style={{ fontSize: 12, color: "var(--ink-3)", margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section style={{ background: "var(--green)", padding: "80px 24px 72px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 24, fontFamily: "var(--font-mono)" }}>
            09 · crear
          </p>
          <h2 style={{ fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", color: "#fff", margin: "0 0 16px" }}>
            Tu próximo cliente{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--accent)" }}>
              ya te está escribiendo.
            </span>
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,0.5)", margin: "0 auto 36px", maxWidth: 380 }}>
            Dale a tu WhatsApp el músculo que le falta: un perfil que habla, sin la persona encima.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 56 }}>
            <Link href="/signup" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "14px 26px", fontSize: 15, fontWeight: 600, background: "var(--accent)", color: "#fff", borderRadius: 12, textDecoration: "none" }}>
              Crear mi asistente <span>→</span>
            </Link>
            <a href="#" style={{ display: "inline-flex", alignItems: "center", padding: "14px 26px", fontSize: 15, fontWeight: 500, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", borderRadius: 12, textDecoration: "none", border: "1px solid rgba(255,255,255,0.15)" }}>
              Hablar con ventas
            </a>
          </div>
          <BrandWordmark size={20} color="rgba(255,255,255,0.5)" />
        </div>
      </section>

    </main>
  );
}
