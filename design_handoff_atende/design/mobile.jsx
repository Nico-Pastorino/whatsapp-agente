// mobile.jsx — Mobile dashboard screens (390x844)

const W = 390, H = 844;

function StatusBar({ dark }) {
  return (
    <div className="atd-status" style={{ color: dark ? 'var(--bg)' : 'var(--ink)' }}>
      <span className="mono">9:41</span>
      <span style={{ display: 'flex', gap: 6, fontSize: 12 }}>
        <span>•••</span><span>📶</span><span>🔋</span>
      </span>
    </div>
  );
}

function TabBar({ active = 'home' }) {
  const tabs = [
    ['chats', 'Chats', Ico.chat],
    ['business', 'Negocio', Ico.shop],
    ['home', 'Atendé', Ico.spark],
    ['plan', 'Plan', Ico.layers],
    ['more', 'Más', Ico.menu],
  ];
  return (
    <div className="atd-tabbar">
      {tabs.map(([k, l, ic]) => (
        <div key={k} className={`tab ${active === k ? 'active' : ''}`}>
          <div className="ic" style={k === 'home' ? { background: 'var(--accent)', color: 'var(--on-accent)' } : undefined}>{React.createElement(ic)}</div>
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}

function PhoneShell({ children, label, active }) {
  return (
    <div style={{ width: W, background: 'var(--ink)', borderRadius: 44, padding: 10, boxShadow: '0 30px 80px -20px rgba(0,0,0,0.3)' }}>
      <div style={{ position: 'relative', background: 'var(--bg)', borderRadius: 36, height: H, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', width: 110, height: 30, borderRadius: 999, background: 'var(--ink)', zIndex: 5 }} />
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <StatusBar />
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>{children}</div>
          <TabBar active={active} />
        </div>
      </div>
    </div>
  );
}

function PageHeader({ title, sub, action }) {
  return (
    <div style={{ padding: '12px 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <div>
        {sub && <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 2 }}>{sub}</div>}
        <h1 className="serif" style={{ fontSize: 32, margin: 0, lineHeight: 1, letterSpacing: '-0.02em' }}>{title}</h1>
      </div>
      {action}
    </div>
  );
}

// ─── HOME (Centro de control) ─────────────────────────────
function MobileHome() {
  return (
    <PhoneShell active="home">
      <div style={{ padding: '12px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>buen día,</div>
          <div className="serif" style={{ fontSize: 22, lineHeight: 1 }}>Lucía 👋</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="atd-av" style={{ width: 36, height: 36 }}><Ico.bell /></div>
          <Avatar initials="LM" size={36} bg="var(--green)" fg="var(--on-green)" />
        </div>
      </div>

      {/* Hero status card */}
      <div style={{ margin: '0 20px 14px', padding: 18, borderRadius: 22, background: 'var(--ink)', color: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'var(--accent)', opacity: 0.18, filter: 'blur(20px)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              <span className="atd-dot live" />WhatsApp conectado
            </div>
            <div className="serif" style={{ fontSize: 30, lineHeight: 1.1, margin: '8px 0 4px' }}>
              Tu asistente está <span className="italic" style={{ color: 'var(--accent)' }}>vendiendo.</span>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>14 chats hoy · 3 esperan respuesta humana</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 16 }}>
          {[['IA', 'activa'], ['Plan', 'Growth'], ['Plantilla', 'Tienda']].map(([k,v])=>(
            <div key={k} style={{ padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.06)' }}>
              <div className="mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Onboarding checklist */}
      <div style={{ margin: '0 20px 14px', padding: 16, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--hairline)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Configurá tu negocio</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>3 de 5 listo</div>
          </div>
          <div style={{ position: 'relative', width: 38, height: 38 }}>
            <svg viewBox="0 0 36 36" width="38" height="38" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--hairline-2)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray={`${0.6 * 94} 94`} strokeLinecap="round" />
            </svg>
            <span className="mono" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>60%</span>
          </div>
        </div>
        {[
          ['Conectá WhatsApp', true],
          ['Elegí una plantilla', true],
          ['Cargá productos', true],
          ['Probá una conversación', false],
          ['Invitá a tu equipo', false],
        ].map(([t, done], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? '1px dashed var(--hairline-2)' : 'none' }}>
            <span style={{ width: 18, height: 18, borderRadius: 999, background: done ? 'var(--green)' : 'transparent', border: done ? 'none' : '1.5px solid var(--hairline-3)', color: 'var(--on-green)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {done && <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M4 10.5L8 14l8-8" /></svg>}
            </span>
            <span style={{ fontSize: 13.5, color: done ? 'var(--muted)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none' }}>{t}</span>
            {!done && <Ico.arrow style={{ marginLeft: 'auto', color: 'var(--muted)' }} />}
          </div>
        ))}
      </div>

      {/* Quick stats */}
      <div style={{ padding: '0 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[
          { k: 'Productos', v: '12 / 100', s: 'Plan Growth', tone: 'light' },
          { k: 'Conv. pendientes', v: '3', s: 'Esperan respuesta', tone: 'accent' },
        ].map((s, i) => (
          <div key={i} style={{ padding: 14, borderRadius: 16, background: s.tone === 'accent' ? 'var(--accent)' : 'var(--surface)', color: s.tone === 'accent' ? 'var(--on-accent)' : 'var(--ink)', border: '1px solid var(--hairline)' }}>
            <div className="mono" style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase' }}>{s.k}</div>
            <div className="serif" style={{ fontSize: 28, lineHeight: 1, marginTop: 6 }}>{s.v}</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{s.s}</div>
          </div>
        ))}
      </div>

      <div style={{ paddingBottom: 90 }} />
    </PhoneShell>
  );
}

// ─── CHATS LIST ───────────────────────────────────────────
function MobileChats() {
  const chats = [
    { name: 'Marina G.',  last: 'Sí, a Caballito.',                 t: '14:02', mode: 'ia',    unread: 0, tag: 'pendiente' },
    { name: 'Diego F.',   last: '¿Tienen el negro talle 42?',         t: '13:48', mode: 'ia',    unread: 2 },
    { name: 'Catalina',   last: 'Hola, quería una consulta',          t: '13:22', mode: 'human', unread: 1 },
    { name: '+54 9 11 …', last: 'Pago realizado, gracias!',           t: '12:55', mode: 'ia',    unread: 0 },
    { name: 'Tomás R.',   last: 'Ah perfecto, lo paso a buscar',      t: '11:30', mode: 'human', unread: 0 },
    { name: 'Belén',      last: 'Audio · 0:14',                       t: '10:12', mode: 'ia',    unread: 0 },
    { name: 'Mauro',      last: 'Te paso transferencia',              t: 'ayer',  mode: 'ia',    unread: 0 },
    { name: 'Florencia',  last: 'Bárbaro, gracias!',                  t: 'ayer',  mode: 'ia',    unread: 0 },
  ];
  return (
    <PhoneShell active="chats">
      <PageHeader title="Conversaciones" sub="inbox · 14 hoy" action={<button className="atd-btn ghost sm" style={{ padding: 0, width: 36, borderRadius: 12 }}><Ico.search /></button>} />

      <div style={{ padding: '8px 20px 10px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {[
          ['Todas', '14', true],
          ['Pendientes', '3', false],
          ['IA', '11', false],
          ['Humano', '3', false],
        ].map(([n, c, on]) => (
          <span key={n} className="atd-pill" style={{ background: on ? 'var(--ink)' : 'var(--surface)', color: on ? 'var(--bg)' : 'var(--ink-2)', borderColor: on ? 'transparent' : 'var(--hairline-2)', flexShrink: 0 }}>
            {n} <span style={{ opacity: 0.6 }}>{c}</span>
          </span>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {chats.map((c, i) => (
          <div key={i} style={{ padding: '12px 20px', display: 'flex', gap: 12, alignItems: 'center', borderTop: i ? '1px solid var(--hairline)' : 'none' }}>
            <div style={{ position: 'relative' }}>
              <Avatar initials={c.name.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()} size={42}
                bg={c.mode === 'human' ? 'var(--human-tint)' : 'var(--green-tint)'}
                fg={c.mode === 'human' ? '#7c5a1a' : 'var(--green-ink)'} />
              {c.mode === 'ia' && <span style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 999, background: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-accent)', border: '2px solid var(--bg)' }}>
                <svg width="8" height="8" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2.5l1.7 4.8 4.8 1.7-4.8 1.7L10 15.5 8.3 10.7 3.5 9l4.8-1.7L10 2.5z" /></svg>
              </span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 14.5, fontWeight: 500 }}>{c.name}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{c.t}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                <span style={{ fontSize: 13, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.last}</span>
                {c.unread ? <span className="atd-badge" style={{ marginLeft: 8 }}>{c.unread}</span> : null}
                {c.tag === 'pendiente' && <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent)', marginLeft: 8 }} />}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ paddingBottom: 90 }} />
    </PhoneShell>
  );
}

// ─── CHAT DETAIL ──────────────────────────────────────────
function MobileChat() {
  return (
    <PhoneShell active="chats">
      {/* header */}
      <div style={{ padding: '8px 16px 10px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--hairline)' }}>
        <span style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5l-5 5 5 5" /></svg>
        </span>
        <Avatar initials="MG" size={38} bg="var(--green-tint)" fg="var(--green-ink)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Marina G.</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--green-soft)' }}>respondiendo con IA</div>
        </div>
        <Ico.dot3 />
      </div>

      {/* mode toggle */}
      <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'center' }}>
        <div className="atd-seg" style={{ width: '100%', justifyContent: 'space-between' }}>
          <button className="on" style={{ flex: 1 }}><Ico.spark style={{ width: 14, height: 14 }} /> IA</button>
          <button style={{ flex: 1 }}>Humano</button>
        </div>
      </div>

      {/* messages */}
      <div style={{ flex: 1, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
        <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', margin: '6px 0' }}>· hoy ·</div>
        <div className="atd-bub in">Hola! ¿Tienen iPhone 14 en negro? 📱</div>
        <div className="atd-bub out">¡Hola Marina! Sí, tenemos en negro y azul.<br />Precio $1.299.000 o 12 cuotas de $108.250. ¿Lo querés con envío?<div className="meta"><Ico.spark style={{ width: 10, height: 10 }} /> ia · 14:02</div></div>
        <div className="atd-bub in">Sí, a Caballito.</div>
        <div className="atd-bub out">Perfecto. Llega mañana sin cargo. Te paso el link de pago.<div className="meta"><Ico.spark style={{ width: 10, height: 10 }} /> ia · 14:02</div></div>
        <div className="atd-bub out" style={{ background: 'var(--ink)', color: 'var(--bg)' }}>https://atende.app/p/8FX2K<div className="meta" style={{ color: 'rgba(255,255,255,0.5)' }}>14:02 ✓✓</div></div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="atd-pill" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)', borderColor: 'transparent', fontSize: 11 }}><Ico.spark style={{ width: 10, height: 10 }} /> Sugerencia: ofrecer protector de pantalla</span>
        </div>
      </div>

      {/* composer */}
      <div style={{ padding: '10px 14px 14px', borderTop: '1px solid var(--hairline)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico.plus /></div>
        <div style={{ flex: 1, minHeight: 36, padding: '8px 14px', borderRadius: 18, background: 'var(--surface-2)', border: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--muted)' }}>Tomá el chat o sugerí…</div>
        <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico.mic /></div>
      </div>
      <div style={{ paddingBottom: 90 }} />
    </PhoneShell>
  );
}

// ─── MI NEGOCIO ───────────────────────────────────────────
function MobileBusiness() {
  const sections = [
    { t: 'Datos básicos', d: 'Nombre, rubro, descripción', open: true },
    { t: 'Horarios',      d: 'Lun a Sáb · 10:00 – 20:00' },
    { t: 'Ubicación',     d: 'Av. Corrientes 1234, CABA' },
    { t: 'Qué ofrece',    d: 'Productos, servicios, métodos de pago' },
    { t: 'Datos para la IA', d: 'Tono, frases clave, restricciones' },
    { t: 'Mensajes automáticos', d: 'Bienvenida, fuera de horario, despedida' },
  ];
  return (
    <PhoneShell active="business">
      <PageHeader title="Mi negocio" sub="01 · configuración" />
      <div style={{ padding: '8px 20px 14px' }}>
        <div className="atd-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="atd-imgph" style={{ width: 56, height: 56, borderRadius: 14 }}>logo</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 500 }}>Celulandia BA</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tienda de celulares · CABA</div>
          </div>
          <button className="atd-btn ghost sm">Editar</button>
        </div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 90, overflow: 'auto' }}>
        {sections.map((s, i) => (
          <div key={i} className="atd-card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{s.t}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{s.d}</div>
              </div>
              <span style={{ color: 'var(--muted)' }}>
                {s.open ? <Ico.minus /> : <Ico.plus />}
              </span>
            </div>
            {s.open && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--hairline-2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="atd-kv"><span className="k">Nombre</span><span className="v">Celulandia BA</span></div>
                <div className="atd-kv"><span className="k">Rubro</span><span className="v">Tienda de celulares</span></div>
                <div className="atd-kv"><span className="k">Descripción</span><span className="v">Celulares nuevos y usados, accesorios, servicio técnico.</span></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </PhoneShell>
  );
}

// ─── PLANTILLAS ───────────────────────────────────────────
function MobileTemplates() {
  const items = [
    { t: 'Tienda de celulares', e: '📱', plan: 'Starter', applied: true },
    { t: 'Indumentaria',         e: '👕', plan: 'Starter' },
    { t: 'Peluquería',           e: '💇', plan: 'Growth', locked: true },
    { t: 'Restaurante',          e: '🍝', plan: 'Growth', locked: true },
    { t: 'Eventos / boliche',    e: '🎵', plan: 'Pro',    locked: true },
    { t: 'Servicios',            e: '🔧', plan: 'Starter' },
  ];
  return (
    <PhoneShell active="business">
      <PageHeader title="Plantillas" sub="02 · por rubro" />
      <div style={{ padding: '4px 20px 12px' }}>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>Configurá el asistente en un click. Cada plantilla incluye respuestas, frases clave y tono recomendados.</p>
      </div>
      <div style={{ padding: '0 20px 90px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto', flex: 1 }}>
        {items.map((it, i) => (
          <div key={i} className="atd-card" style={{ padding: 16, position: 'relative', overflow: 'hidden', opacity: it.locked ? 0.85 : 1 }}>
            {it.applied && <span style={{ position: 'absolute', top: 12, right: 12, padding: '3px 8px', background: 'var(--green-tint)', color: 'var(--green-ink)', borderRadius: 999, fontSize: 10, fontWeight: 500 }}>aplicada</span>}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: it.locked ? 'var(--surface-2)' : 'var(--green-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{it.e}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{it.t}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>24 respuestas · 8 frases clave</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  {it.locked
                    ? <span className="atd-pill accent"><Ico.lock /> Disponible en {it.plan}</span>
                    : <span className="atd-pill"><Ico.check /> Plan {it.plan}</span>}
                  <button className={`atd-btn ${it.locked ? 'accent' : 'primary'} sm`} style={{ marginLeft: 'auto' }}>
                    {it.applied ? 'Editar' : it.locked ? `Mejorar` : 'Usar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PhoneShell>
  );
}

// ─── PRODUCTOS ────────────────────────────────────────────
function MobileProducts() {
  const products = [
    { t: 'iPhone 14 128GB', sub: 'Negro · Azul · Rojo', p: '$1.299.000', on: true,  e: '📱' },
    { t: 'Samsung A54',     sub: 'Negro · Lima',         p: '$540.000',   on: true,  e: '📱' },
    { t: 'AirPods Pro',     sub: 'Blanco',                p: '$320.000',   on: true,  e: '🎧' },
    { t: 'Cargador 20W',    sub: 'Tipo C',                p: '$22.000',    on: false, e: '🔌' },
    { t: 'Funda transparente', sub: 'Varios modelos',    p: '$8.500',     on: true,  e: '📦' },
  ];
  return (
    <PhoneShell active="business">
      <PageHeader title="Productos" sub="03 · catálogo · 12 / 100" />
      <div style={{ padding: '4px 20px 10px', display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, height: 38, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--hairline-2)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
          <Ico.search /><span style={{ fontSize: 13, color: 'var(--muted)' }}>Buscar</span>
        </div>
        <button className="atd-btn ghost sm" style={{ width: 38, padding: 0, borderRadius: 12 }}><Ico.layers /></button>
      </div>

      <div style={{ flex: 1, padding: '0 20px 100px', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
        {products.map((p, i) => (
          <div key={i} className="atd-card" style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="atd-imgph" style={{ width: 56, height: 56, borderRadius: 12 }}>{p.e}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{p.t}</span>
                <span className="mono" style={{ fontSize: 13 }}>{p.p}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{p.sub}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: p.on ? 'var(--green)' : 'var(--muted)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: p.on ? 'var(--green)' : 'var(--muted)' }} />{p.on ? 'activo' : 'pausado'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FAB */}
      <div style={{ position: 'absolute', bottom: 96, right: 20, width: 56, height: 56, borderRadius: 999, background: 'var(--accent)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-3)' }}>
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M10 4v12M4 10h12" /></svg>
      </div>
    </PhoneShell>
  );
}

// ─── MI PLAN ──────────────────────────────────────────────
function MobilePlan() {
  return (
    <PhoneShell active="plan">
      <PageHeader title="Mi plan" sub="04 · uso & upgrade" />
      <div style={{ padding: '4px 20px 100px', overflow: 'auto', flex: 1 }}>
        {/* current */}
        <div style={{ padding: 20, borderRadius: 22, background: 'var(--ink)', color: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'var(--accent)', opacity: 0.2, filter: 'blur(20px)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="atd-pill" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--bg)', borderColor: 'transparent' }}>Tu plan</span>
            <span className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>activo · vence 12 feb</span>
          </div>
          <div className="serif" style={{ fontSize: 56, lineHeight: 1, marginTop: 16 }}>Growth</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Para vender más por WhatsApp.</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button className="atd-btn accent sm" style={{ flex: 1 }}>Mejorar a Pro</button>
            <button className="atd-btn ghost sm" style={{ color: 'var(--bg)', borderColor: 'rgba(255,255,255,0.2)' }}>Cancelar</button>
          </div>
        </div>

        {/* usage */}
        <div className="atd-card" style={{ padding: 16, marginTop: 12 }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 10 }}>uso del plan</div>
          {[
            ['Usuarios', 2, 3],
            ['Productos', 12, 100],
            ['Plantillas activas', 1, 5],
            ['Mensajes IA', '1.247', '∞'],
          ].map(([k, a, b], i) => {
            const pct = typeof a === 'number' && typeof b === 'number' ? a / b : 0.4;
            return (
              <div key={i} style={{ padding: '10px 0', borderTop: i ? '1px dashed var(--hairline-2)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span>{k}</span>
                  <span className="mono">{a} / {b}</span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, pct * 100)}%`, height: '100%', background: pct > 0.8 ? 'var(--accent)' : 'var(--green)' }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="atd-card" style={{ padding: 16, marginTop: 12, background: 'var(--accent-soft)', borderColor: 'transparent' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--accent)', color: 'var(--on-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Ico.spark /></span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent-ink)' }}>Probá Pro 14 días</div>
              <div style={{ fontSize: 12, color: 'var(--accent-ink)', opacity: 0.8, marginTop: 2 }}>Multi-WhatsApp, métricas avanzadas y soporte prioritario.</div>
            </div>
          </div>
        </div>
      </div>
    </PhoneShell>
  );
}

// ─── EQUIPO ───────────────────────────────────────────────
function MobileTeam() {
  const team = [
    { n: 'Lucía Méndez',  e: 'lucia@celulandia.ar', r: 'Owner',  on: true },
    { n: 'Mateo López',    e: 'mateo@celulandia.ar', r: 'Admin',  on: true },
    { n: 'Sofía B.',       e: 'sofia@celulandia.ar', r: 'Agente', on: false, pending: true },
  ];
  return (
    <PhoneShell active="more">
      <PageHeader title="Equipo" sub="05 · 2 de 3 usuarios" action={<button className="atd-btn primary sm">Invitar</button>} />
      <div style={{ padding: '8px 20px 100px', flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {team.map((m, i) => (
            <div key={i} className="atd-card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar initials={m.n.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{m.n}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.e}</div>
              </div>
              <span className="atd-pill" style={m.pending ? { background: 'var(--human-tint)', color: '#7c5a1a', borderColor: 'transparent' } : undefined}>
                {m.pending ? 'invitada' : m.r}
              </span>
            </div>
          ))}
        </div>

        <div className="atd-card" style={{ padding: 16, marginTop: 14, background: 'var(--surface-2)', borderStyle: 'dashed' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Ico.copy />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Link de invitación</span>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>atende.app/inv/4FK9P</span>
            <button className="atd-btn sm ghost">Copiar</button>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '10px 0 0' }}>Compartilo por donde quieras. Pueden aceptar con cualquier email.</p>
        </div>
      </div>
    </PhoneShell>
  );
}

// ─── CONECTAR WHATSAPP (QR) ───────────────────────────────
function MobileConnect() {
  return (
    <PhoneShell active="more">
      <PageHeader title="Conectar" sub="06 · WhatsApp + atendé" />
      <div style={{ padding: '8px 20px 100px', textAlign: 'center', flex: 1 }}>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '0 auto 18px', maxWidth: 280 }}>
          Escaneá este código desde WhatsApp en tu celular para conectar tu asistente.
        </p>
        <div className="atd-card" style={{ padding: 20, display: 'inline-block' }}>
          <div style={{ width: 220, height: 220, borderRadius: 14, background: 'var(--surface-2)', position: 'relative', overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', gridTemplateRows: 'repeat(20, 1fr)', gap: 1, padding: 8 }}>
            {Array.from({ length: 400 }).map((_, i) => (
              <div key={i} style={{ background: Math.random() > 0.55 ? 'var(--ink)' : 'transparent' }} />
            ))}
            {/* corner squares */}
            {[[8,8,'tl'],[8,8,'tr'],[8,8,'bl']].map(([w,h,k], i) => (
              <div key={i} style={{ position: 'absolute', top: i === 2 ? 'auto' : 8, bottom: i === 2 ? 8 : 'auto', left: i === 1 ? 'auto' : 8, right: i === 1 ? 8 : 'auto', width: 44, height: 44, border: '6px solid var(--ink)', background: 'var(--surface-2)' }}>
                <div style={{ inset: 8, position: 'absolute', background: 'var(--ink)' }} />
              </div>
            ))}
            {/* atendé dot center */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 32, height: 32, borderRadius: 999, background: 'var(--accent)', border: '6px solid var(--surface-2)' }} />
          </div>
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 14 }}>el código vence en 00:42</div>
        <div className="atd-card" style={{ marginTop: 16, padding: 16, textAlign: 'left' }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>cómo escanear</div>
          {['Abrí WhatsApp en tu celular','Tocá Configuración → Dispositivos','Tocá "Vincular dispositivo"','Apuntá la cámara a este código'].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: 13 }}>
              <span className="mono" style={{ color: 'var(--accent)' }}>0{i+1}</span>{s}
            </div>
          ))}
        </div>
      </div>
    </PhoneShell>
  );
}

// ─── EMPTY STATES ────────────────────────────────────────
function MobileEmpty() {
  return (
    <PhoneShell active="chats">
      <PageHeader title="Conversaciones" sub="inbox" />
      <div style={{ padding: 24, textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ width: 96, height: 96, borderRadius: 30, background: 'var(--green-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, position: 'relative' }}>
          <Ico.chat />
          <span style={{ position: 'absolute', top: -8, right: -8, width: 30, height: 30, borderRadius: 999, background: 'var(--accent)', color: 'var(--on-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>+</span>
        </div>
        <h3 className="serif" style={{ fontSize: 28, margin: '0 0 8px' }}>
          Todavía no <span className="italic">hay chats.</span>
        </h3>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', maxWidth: 260, margin: 0 }}>
          Conectá WhatsApp para que tu asistente empiece a recibir conversaciones.
        </p>
        <button className="atd-btn primary lg" style={{ marginTop: 20 }}>Conectar WhatsApp <Ico.arrow /></button>
        <button className="atd-btn ghost sm" style={{ marginTop: 8 }}>Ver una conversación de ejemplo</button>
      </div>
    </PhoneShell>
  );
}

Object.assign(window, {
  MobileHome, MobileChats, MobileChat, MobileBusiness, MobileTemplates,
  MobileProducts, MobilePlan, MobileTeam, MobileConnect, MobileEmpty,
});
