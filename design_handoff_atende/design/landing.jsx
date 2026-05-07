// landing.jsx — Public landing page (mobile + desktop variants)

function MiniPhone({ children, w = 240, h = 480 }) {
  return (
    <div style={{
      width: w, background: 'var(--ink)', borderRadius: 32, padding: 8,
      boxShadow: '0 30px 60px -30px rgba(0,0,0,0.4), 0 10px 30px -20px rgba(0,0,0,0.3)',
    }}>
      <div style={{ background: 'var(--bg)', borderRadius: 26, height: h, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}

function PhoneChat({ items }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-elev)' }}>
      <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar initials="MM" size={32} bg="var(--green)" fg="var(--on-green)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Marina · cliente</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--green-soft)' }}>respondiendo con IA</div>
        </div>
        <Ico.dot3 />
      </div>
      <div style={{ flex: 1, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
        {items.map((it, i) => (
          <div key={i} className={`atd-bub ${it.from}`} style={{ fontSize: 12.5 }}>
            {it.text}
            {it.meta && <div className="meta" style={{ fontSize: 9 }}>{it.meta}</div>}
          </div>
        ))}
      </div>
      <div style={{ padding: '8px 10px 14px', borderTop: '1px solid var(--hairline)', display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{ flex: 1, height: 30, borderRadius: 999, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 11, color: 'var(--muted)' }}>Mensaje…</div>
        <div style={{ width: 30, height: 30, borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l14-6-6 14-2-6-6-2z" /></svg>
        </div>
      </div>
    </div>
  );
}

const sampleChat = [
  { from: 'in',  text: '¿Tienen iPhone 14 en negro?' },
  { from: 'out', text: '¡Hola Marina! Sí, en negro y azul. $1.299.000 o 12 cuotas. ¿Lo querés con envío?', meta: '· ia 14:02' },
  { from: 'in',  text: 'Sí, a Caballito.' },
  { from: 'out', text: 'Llega mañana sin cargo. Te paso el link de pago 👇', meta: '· ia 14:02' },
];

// ─── HERO VARIANTS ─────────────────────────────────────────

function HeroA() {
  // Editorial big-serif + floating phone
  return (
    <div className="atd atd-paper" style={{ padding: '64px 80px', minHeight: 720, position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 60 }}>
        <Wordmark size={32} />
        <div style={{ display: 'flex', gap: 28, fontSize: 14, color: 'var(--ink-2)' }}>
          <span>Cómo funciona</span><span>Funciones</span><span>Planes</span><span>Casos</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="atd-btn ghost sm">Ingresar</button>
          <button className="atd-btn primary sm">Empezar</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 48, alignItems: 'center' }}>
        <div>
          <span className="atd-pill"><span className="atd-dot" style={{ background: 'var(--accent)' }} />Beta abierta · enero 2026</span>
          <h1 className="display" style={{ fontSize: 96, margin: '20px 0 18px', maxWidth: 720 }}>
            Tu vendedor<br />automático <span className="serif italic" style={{ color: 'var(--green)' }}>por WhatsApp.</span>
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.45, color: 'var(--ink-3)', maxWidth: 520, margin: 0 }}>
            Respondé consultas, captá clientes y vendé más sin estar todo el día pendiente del celular.
            La IA habla con la información de tu negocio. Vos decidís cuándo entrar.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 28, alignItems: 'center' }}>
            <button className="atd-btn primary lg">Empezar ahora<Ico.arrow /></button>
            <button className="atd-btn ghost lg">Ver cómo funciona</button>
          </div>
          <div style={{ display: 'flex', gap: 22, marginTop: 28, fontSize: 12.5, color: 'var(--muted)' }}>
            <span>· Sin tarjeta</span><span>· 7 días gratis</span><span>· Plantillas por rubro</span>
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', top: 30, left: -20, width: 280, height: 280, borderRadius: '50%', background: 'var(--green-tint)', filter: 'blur(40px)' }} />
          <MiniPhone w={280} h={560}>
            <PhoneChat items={sampleChat} />
          </MiniPhone>
          <div style={{ position: 'absolute', top: 60, right: -10, padding: '10px 14px', background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-2)', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-accent)' }}><Ico.spark /></div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>+47 nuevos contactos</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>esta semana</div>
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: 80, left: -30, padding: '10px 14px', background: 'var(--ink)', color: 'var(--bg)', borderRadius: 14, fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="atd-dot live" />WhatsApp conectado
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroB() {
  // Bold dark block — full-bleed brutalist with chat strip
  return (
    <div className="atd" style={{ background: 'var(--ink)', color: 'var(--bg)', padding: '40px 60px 0', minHeight: 720, position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Wordmark size={32} color="var(--bg)" />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="atd-btn ghost sm" style={{ color: 'var(--bg)', borderColor: 'rgba(255,255,255,0.2)' }}>Ingresar</button>
          <button className="atd-btn accent sm">Empezar</button>
        </div>
      </div>

      <div style={{ marginTop: 60, display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
        <span className="mono" style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em' }}>· un asistente que vende mientras dormís ·</span>
        <h1 className="display" style={{ fontSize: 168, margin: 0, lineHeight: 0.88, letterSpacing: '-0.04em', maxWidth: '100%' }}>
          Vendé<br />sin <span className="serif italic" style={{ color: 'var(--accent)' }}>estar.</span>
        </h1>
        <div style={{ display: 'flex', gap: 60, alignItems: 'flex-end', marginTop: 12 }}>
          <p style={{ fontSize: 18, lineHeight: 1.45, color: 'rgba(255,255,255,0.75)', maxWidth: 480, margin: 0 }}>
            Convertí tu WhatsApp en un asistente inteligente para vender, responder y organizar clientes.
            Tomás el control cuando querés.
          </p>
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
            <button className="atd-btn accent lg">Crear mi asistente <Ico.arrow /></button>
            <button className="atd-btn ghost lg" style={{ color: 'var(--bg)', borderColor: 'rgba(255,255,255,0.2)' }}>Ver demo</button>
          </div>
        </div>
      </div>

      {/* chat strip at bottom */}
      <div style={{ marginTop: 40, display: 'flex', gap: 16, overflow: 'hidden', alignItems: 'flex-end' }}>
        {[
          { who: 'cliente', txt: '¿Hacen envíos a Rosario?', t: '14:01', from: 'in' },
          { who: 'atendé · ia', txt: 'Sí, hacemos a todo el país. Llega en 48hs sin cargo desde $80k.', t: '14:01', from: 'out' },
          { who: 'cliente', txt: '¿Cuotas?', t: '14:02', from: 'in' },
          { who: 'atendé · ia', txt: 'Hasta 12 cuotas sin interés con todas las tarjetas.', t: '14:02', from: 'out' },
        ].map((m, i) => (
          <div key={i} style={{
            padding: '14px 16px', borderRadius: 18,
            background: m.from === 'out' ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
            color: m.from === 'out' ? 'var(--on-accent)' : 'var(--bg)',
            border: m.from === 'in' ? '1px solid rgba(255,255,255,0.12)' : 'none',
            maxWidth: 280, fontSize: 14, lineHeight: 1.4,
          }}>
            <div className="mono" style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>{m.who} · {m.t}</div>
            {m.txt}
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroC() {
  // Split — phone-centric, conversational
  return (
    <div className="atd" style={{ padding: '40px 60px', minHeight: 720, background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36 }}>
        <Wordmark size={32} />
        <div style={{ display: 'flex', gap: 28, fontSize: 14 }}>
          <span>Producto</span><span>Planes</span><span>Casos</span><span>Soporte</span>
        </div>
        <button className="atd-btn primary sm">Empezar gratis</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 60, alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: -20, left: -20, width: 320, height: 320, borderRadius: '50%', background: 'var(--accent-soft)', filter: 'blur(60px)', opacity: 0.7 }} />
          <MiniPhone w={300} h={600}>
            <PhoneChat items={sampleChat} />
          </MiniPhone>
        </div>

        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <span className="atd-pill mono">001 / hola</span>
            <span className="atd-pill green"><span className="atd-dot live"/>respondiendo</span>
          </div>
          <h1 className="display" style={{ fontSize: 80, margin: 0, lineHeight: 0.95, color: 'var(--ink)' }}>
            Tu negocio<br /><span className="serif italic">en el bolsillo,</span><br />respondiendo solo.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.5, color: 'var(--ink-3)', marginTop: 24, maxWidth: 460 }}>
            Conectá tu WhatsApp en 2 minutos. Cargá tu negocio. Tu asistente
            empieza a responder con tus precios, horarios y catálogo.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button className="atd-btn primary lg">Empezar ahora<Ico.arrow /></button>
            <button className="atd-btn ghost lg">Ver demo (1:30)</button>
          </div>
          <div style={{ marginTop: 36, padding: 18, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--hairline)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[['1.2k', 'comercios'], ['347k', 'mensajes/mes'], ['<2 min', 'al primer chat']].map(([n,l])=>(
              <div key={l}>
                <div className="serif" style={{ fontSize: 28 }}>{n}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── REST OF LANDING SECTIONS ──────────────────────────────

function ProblemSection() {
  const items = [
    { t: 'Tardás en responder', d: 'Y los clientes compran en otro lado.' },
    { t: 'Las mismas preguntas', d: 'Precio, stock, envíos, cuotas. Todo el día.' },
    { t: 'No sabés quién compra', d: 'Conversaciones perdidas en el chat.' },
    { t: 'WhatsApp desordenado', d: 'Mezcla familia, trabajo y ventas.' },
    { t: 'No respondés de noche', d: 'Y ahí es cuando muchos preguntan.' },
  ];
  return (
    <div className="atd" style={{ padding: '80px 60px', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 36 }}>
        <div>
          <span className="atd-pill mono">02 · el problema</span>
          <h2 className="display" style={{ fontSize: 64, margin: '14px 0 0', maxWidth: 700 }}>
            Vender por WhatsApp <span className="serif italic" style={{ color: 'var(--accent)' }}>te consume el día.</span>
          </h2>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        {items.map((it, i) => (
          <div key={i} className="atd-card" style={{ padding: 22, minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>0{i+1}</div>
            <div>
              <div className="serif" style={{ fontSize: 22, lineHeight: 1.1 }}>{it.t}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8 }}>{it.d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    ['Registrá tu negocio',  'Email y nombre. 30 segundos.'],
    ['Elegí tu plan',         'Starter para arrancar, Growth para vender.'],
    ['Conectá WhatsApp',      'Escaneá un QR. Listo.'],
    ['Aplicá tu plantilla',   'Por rubro: tienda, peluquería, restó…'],
    ['Tu asistente responde', 'Vos mirás. Si querés, entrás vos.'],
  ];
  return (
    <div className="atd" style={{ padding: '80px 60px', background: 'var(--ink)', color: 'var(--bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
        <div>
          <span className="atd-pill mono" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', borderColor: 'transparent' }}>04 · cómo funciona</span>
          <h2 className="display" style={{ fontSize: 64, margin: '14px 0 0', color: 'var(--bg)' }}>
            En <span className="serif italic" style={{ color: 'var(--accent)' }}>cinco pasos.</span>
          </h2>
        </div>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>Tiempo total: ~5 minutos.</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 18, overflow: 'hidden' }}>
        {steps.map(([t, d], i) => (
          <div key={i} style={{ padding: 28, background: 'var(--ink)', minHeight: 220, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div className="serif" style={{ fontSize: 64, color: 'var(--accent)', lineHeight: 0.8 }}>{i+1}</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 6 }}>{t}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.45 }}>{d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeaturesGrid() {
  const features = [
    { t: 'IA para responder', d: 'Habla con la información de tu negocio. Aprende del tono.', tag: 'inteligencia', big: true },
    { t: 'Modo humano',       d: 'Tomás el chat con un toque. La IA pausa.', tag: 'control' },
    { t: 'Plantillas por rubro', d: 'Configurada para vos en 1 click.', tag: 'plantillas' },
    { t: 'Catálogo',          d: 'Productos y servicios que la IA usa.', tag: 'datos' },
    { t: 'Equipo',            d: 'Invitá compañeros con roles.', tag: 'colaboración' },
    { t: 'Métricas',          d: 'Quién pregunta, qué pregunta, cuándo.', tag: 'pronto' },
  ];
  return (
    <div className="atd" style={{ padding: '80px 60px', background: 'var(--bg)' }}>
      <div style={{ marginBottom: 36 }}>
        <span className="atd-pill mono">05 · funciones</span>
        <h2 className="display" style={{ fontSize: 64, margin: '14px 0 0', maxWidth: 720 }}>
          Todo lo que <span className="serif italic">tu WhatsApp</span> necesita.
        </h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: 'auto auto', gap: 14 }}>
        {features.map((f, i) => (
          <div key={i} className="atd-card" style={{
            padding: 28, gridColumn: f.big ? 'span 1' : 'auto', gridRow: f.big ? 'span 2' : 'auto',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            minHeight: f.big ? 380 : 180,
            background: f.big ? 'var(--green)' : 'var(--surface)',
            color: f.big ? 'var(--on-green)' : 'var(--ink)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="mono" style={{ fontSize: 11, color: f.big ? 'rgba(255,255,255,0.55)' : 'var(--muted)', textTransform: 'uppercase' }}>{f.tag}</span>
              <span style={{ fontSize: 14, opacity: f.big ? 0.6 : 0.5 }}>0{i+1}</span>
            </div>
            <div>
              <div className="serif" style={{ fontSize: f.big ? 56 : 26, lineHeight: 1.05 }}>{f.t}</div>
              <div style={{ fontSize: f.big ? 16 : 13, color: f.big ? 'rgba(255,255,255,0.8)' : 'var(--ink-3)', marginTop: 8, maxWidth: 320 }}>{f.d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UseCases() {
  const cases = [
    ['Tienda de celulares', 'Responde precios, stock, cuotas, envíos y garantía.', '📱'],
    ['Indumentaria',         'Talles, colores, combinaciones y stock por sucursal.', '👕'],
    ['Peluquería / estética',  'Turnos, servicios, precios y promos del mes.', '💇'],
    ['Restaurante / comida', 'Menú, horarios, delivery y reservas.', '🍝'],
    ['Eventos / boliche',    'Entradas, ubicación, dress code y line-up.', '🎵'],
    ['Servicios',             'Cotizaciones, disponibilidad y zona de cobertura.', '🔧'],
  ];
  return (
    <div className="atd atd-dots" style={{ padding: '80px 60px', background: 'var(--bg-grain)' }}>
      <div style={{ marginBottom: 32 }}>
        <span className="atd-pill mono">06 · casos</span>
        <h2 className="display" style={{ fontSize: 64, margin: '14px 0 0' }}>
          Plantillas listas <span className="serif italic">para tu rubro.</span>
        </h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {cases.map(([t, d, e], i) => (
          <div key={i} className="atd-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--green-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{e}</div>
              <div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>0{i+1}</div>
                <div style={{ fontSize: 17, fontWeight: 500 }}>{t}</div>
              </div>
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>{d}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8, borderTop: '1px dashed var(--hairline-2)' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>incluye 24 respuestas</span>
              <Ico.arrow />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PricingSection() {
  const plans = [
    { name: 'Starter',  price: '$0',     sub: 'Para empezar a responder con IA.', features: ['1 usuario', '20 productos', '1 plantilla', '500 mensajes IA / mes'], cta: 'Empezar gratis', tone: 'light' },
    { name: 'Growth',   price: '$24.900',sub: 'Para vender más por WhatsApp.',     features: ['3 usuarios', '100 productos', '5 plantillas', 'Mensajes IA ilimitados', 'Modo humano avanzado'], cta: 'Probar Growth', tone: 'dark', popular: true },
    { name: 'Pro',      price: '$59.900',sub: 'Para negocios con más volumen y equipo.', features: ['Usuarios ilimitados', 'Productos ilimitados', 'Plantillas ilimitadas', 'Métricas avanzadas', 'Multi-WhatsApp', 'Soporte prioritario'], cta: 'Hablar con ventas', tone: 'light' },
  ];
  return (
    <div className="atd" style={{ padding: '80px 60px', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
        <div>
          <span className="atd-pill mono">07 · planes</span>
          <h2 className="display" style={{ fontSize: 64, margin: '14px 0 0' }}>
            Pagás lo que <span className="serif italic">usás.</span>
          </h2>
        </div>
        <span style={{ fontSize: 14, color: 'var(--muted)' }}>Precios en pesos argentinos · ARS · IVA incluido</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {plans.map((p) => {
          const dark = p.tone === 'dark';
          return (
            <div key={p.name} style={{
              padding: 28, borderRadius: 22,
              background: dark ? 'var(--ink)' : 'var(--surface)',
              color: dark ? 'var(--bg)' : 'var(--ink)',
              border: dark ? 'none' : '1px solid var(--hairline)',
              position: 'relative',
            }}>
              {p.popular && <span style={{ position: 'absolute', top: -10, right: 22, padding: '4px 10px', background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: 999, fontSize: 11, fontWeight: 500 }}>Más elegido</span>}
              <div className="serif" style={{ fontSize: 36 }}>{p.name}</div>
              <div style={{ fontSize: 13, opacity: 0.65, marginTop: 4 }}>{p.sub}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '20px 0' }}>
                <div className="serif" style={{ fontSize: 56, lineHeight: 1 }}>{p.price}</div>
                {p.price !== '$0' && <span className="mono" style={{ fontSize: 12, opacity: 0.55 }}>/mes</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
                {p.features.map(f => (
                  <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ width: 16, height: 16, borderRadius: 999, background: dark ? 'rgba(255,255,255,0.08)' : 'var(--green-tint)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: dark ? 'var(--accent)' : 'var(--green)' }}>
                      <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M4 10.5L8 14l8-8" /></svg>
                    </span>{f}
                  </div>
                ))}
              </div>
              <button className={`atd-btn ${dark ? 'accent' : 'primary'} lg`} style={{ width: '100%', marginTop: 24 }}>{p.cta}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrustSection() {
  const points = [
    ['Vos decidís cuándo IA, cuándo humano', 'Tomás el chat con un toque. La IA pausa hasta que vos digas.', 'control'],
    ['Tu información, tus respuestas',         'La IA responde sólo con lo que cargaste vos. Nada inventado.', 'datos'],
    ['Conversaciones ordenadas',                'Pendientes, IA, humano. Filtros simples, sin tableros.',       'orden'],
    ['Editá todo cuando quieras',              'Horarios, precios, tono. Cambia en vivo.',                      'flex'],
  ];
  return (
    <div className="atd" style={{ padding: '80px 60px', background: 'var(--bg)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 60, alignItems: 'flex-start' }}>
        <div>
          <span className="atd-pill mono">08 · confianza</span>
          <h2 className="display" style={{ fontSize: 56, margin: '14px 0 18px', lineHeight: 1 }}>
            Tu negocio <span className="serif italic" style={{ color: 'var(--green)' }}>siempre</span> bajo control.
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.55, color: 'var(--ink-3)', maxWidth: 380 }}>
            La IA es una herramienta, no un piloto automático. Vos seguís siendo el dueño de cada conversación.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {points.map(([t, d, tag], i) => (
            <div key={i} className="atd-card" style={{ padding: 22 }}>
              <div className="mono" style={{ fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>· {tag}</div>
              <div style={{ fontSize: 17, fontWeight: 500, margin: '10px 0 6px', lineHeight: 1.2 }}>{t}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FinalCTA() {
  return (
    <div className="atd" style={{ padding: '100px 60px', background: 'var(--green)', color: 'var(--on-green)', textAlign: 'center' }}>
      <span className="atd-pill mono" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', borderColor: 'transparent' }}>09 · empezá</span>
      <h2 className="display" style={{ fontSize: 96, margin: '20px auto 0', maxWidth: 1100, lineHeight: 0.95 }}>
        Tu próximo cliente<br /><span className="serif italic" style={{ color: 'var(--accent)' }}>ya te está escribiendo.</span>
      </h2>
      <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.75)', marginTop: 18, maxWidth: 560, marginInline: 'auto' }}>
        Que tu WhatsApp responda mejor. Empezá gratis, sin tarjeta, en menos de 5 minutos.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 32 }}>
        <button className="atd-btn accent lg">Crear mi asistente <Ico.arrow /></button>
        <button className="atd-btn ghost lg" style={{ color: 'var(--bg)', borderColor: 'rgba(255,255,255,0.25)' }}>Hablar con ventas</button>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="atd" style={{ padding: '40px 60px', background: 'var(--ink)', color: 'rgba(255,255,255,0.6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <Wordmark size={24} color="var(--bg)" />
      <span className="mono" style={{ fontSize: 11 }}>© 2026 atendé · hecho en Buenos Aires · WhatsApp es marca registrada de Meta</span>
    </div>
  );
}

// ─── DESKTOP LANDING (full assembly) ───────────────────────
function LandingDesktop({ heroVariant = 'A' }) {
  const Hero = heroVariant === 'B' ? HeroB : heroVariant === 'C' ? HeroC : HeroA;
  return (
    <div style={{ width: '100%', background: 'var(--bg)' }}>
      <Hero />
      <ProblemSection />
      <HowItWorks />
      <FeaturesGrid />
      <UseCases />
      <PricingSection />
      <TrustSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}

// ─── MOBILE LANDING ────────────────────────────────────────
function LandingMobile() {
  return (
    <div className="atd" style={{ width: '100%', background: 'var(--bg)' }}>
      {/* status bar */}
      <div className="atd-status"><span className="mono">9:41</span><span style={{ display: 'flex', gap: 6 }}><span>•••</span><span>📶</span><span>🔋</span></span></div>
      {/* nav */}
      <div style={{ padding: '8px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Wordmark size={24} />
        <button className="atd-btn primary sm">Empezar</button>
      </div>

      {/* Hero */}
      <div style={{ padding: '32px 20px 48px' }}>
        <span className="atd-pill"><span className="atd-dot" style={{ background: 'var(--accent)' }} />Beta abierta</span>
        <h1 className="display" style={{ fontSize: 56, lineHeight: 0.95, margin: '14px 0 14px' }}>
          Tu vendedor<br /><span className="serif italic" style={{ color: 'var(--green)' }}>por WhatsApp.</span>
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.45, color: 'var(--ink-3)', margin: 0 }}>
          Respondé consultas, captá clientes y vendé más sin estar todo el día pendiente del celular.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 22 }}>
          <button className="atd-btn primary lg" style={{ width: '100%' }}>Empezar ahora <Ico.arrow /></button>
          <button className="atd-btn ghost lg" style={{ width: '100%' }}>Ver cómo funciona</button>
        </div>

        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
          <MiniPhone w={260} h={520}>
            <PhoneChat items={sampleChat} />
          </MiniPhone>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'center', fontSize: 12, color: 'var(--muted)' }}>
          · Sin tarjeta &nbsp;·&nbsp; 7 días gratis
        </div>
      </div>

      {/* Problem */}
      <div style={{ padding: '40px 20px', background: 'var(--bg-grain)' }}>
        <span className="atd-pill mono">02 · el problema</span>
        <h2 className="display" style={{ fontSize: 40, margin: '12px 0 18px', lineHeight: 1 }}>
          Vender por WhatsApp <span className="serif italic" style={{ color: 'var(--accent)' }}>te consume.</span>
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            'Tardás en responder y los clientes compran en otro lado.',
            'Te hacen siempre las mismas preguntas.',
            'No sabés qué clientes están interesados.',
            'Todo queda desordenado en WhatsApp.',
            'De noche no respondés. Y ahí preguntan.',
          ].map((t, i) => (
            <div key={i} className="atd-card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', minWidth: 22 }}>0{i+1}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div style={{ padding: '40px 20px', background: 'var(--ink)', color: 'var(--bg)' }}>
        <span className="atd-pill mono" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', borderColor: 'transparent' }}>04 · cómo funciona</span>
        <h2 className="display" style={{ fontSize: 40, margin: '12px 0 18px', color: 'var(--bg)', lineHeight: 1 }}>
          En cinco <span className="serif italic" style={{ color: 'var(--accent)' }}>pasos.</span>
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['Registrá tu negocio','Elegí tu plan','Conectá WhatsApp','Aplicá tu plantilla','Tu asistente responde'].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="serif" style={{ fontSize: 36, color: 'var(--accent)', width: 40 }}>{i+1}</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{s}</div>
              <Ico.arrow style={{ marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div style={{ padding: '40px 20px' }}>
        <span className="atd-pill mono">07 · planes</span>
        <h2 className="display" style={{ fontSize: 40, margin: '12px 0 18px' }}>Pagás lo que <span className="serif italic">usás.</span></h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { n: 'Starter', p: '$0',      d: 'Para empezar a responder con IA.', tone: 'light' },
            { n: 'Growth',  p: '$24.900', d: 'Para vender más por WhatsApp.',    tone: 'dark', popular: true },
            { n: 'Pro',     p: '$59.900', d: 'Para negocios con más volumen.',   tone: 'light' },
          ].map(p => {
            const dark = p.tone === 'dark';
            return (
              <div key={p.n} style={{
                padding: 22, borderRadius: 20,
                background: dark ? 'var(--ink)' : 'var(--surface)',
                color: dark ? 'var(--bg)' : 'var(--ink)',
                border: dark ? 'none' : '1px solid var(--hairline)',
                position: 'relative',
              }}>
                {p.popular && <span style={{ position: 'absolute', top: -10, right: 18, padding: '4px 10px', background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: 999, fontSize: 11 }}>Más elegido</span>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div className="serif" style={{ fontSize: 32 }}>{p.n}</div>
                  <div className="serif" style={{ fontSize: 32 }}>{p.p}</div>
                </div>
                <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>{p.d}</div>
                <button className={`atd-btn ${dark ? 'accent' : 'primary'} lg`} style={{ width: '100%', marginTop: 18 }}>Elegir {p.n}</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '60px 24px', background: 'var(--green)', color: 'var(--on-green)', textAlign: 'center' }}>
        <h2 className="display" style={{ fontSize: 48, lineHeight: 0.95, margin: 0 }}>
          Tu próximo cliente<br /><span className="serif italic" style={{ color: 'var(--accent)' }}>ya te está escribiendo.</span>
        </h2>
        <button className="atd-btn accent lg" style={{ marginTop: 22 }}>Crear mi asistente <Ico.arrow /></button>
      </div>
    </div>
  );
}

Object.assign(window, { LandingDesktop, LandingMobile, HeroA, HeroB, HeroC, MiniPhone, PhoneChat, sampleChat });
