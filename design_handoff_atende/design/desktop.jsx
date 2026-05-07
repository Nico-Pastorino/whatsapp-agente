// desktop.jsx — Desktop dashboard screens (1280x820)

function Sidebar({ active = 'home' }) {
  const items = [
    ['home',      'Centro',         Ico.spark],
    ['chats',     'Conversaciones', Ico.chat,   '14'],
    ['business',  'Mi negocio',     Ico.shop],
    ['templates', 'Plantillas',     Ico.layers],
    ['products',  'Productos',      Ico.tag,    '12'],
    ['team',      'Equipo',         Ico.users],
    ['plan',      'Mi plan',        Ico.briefcase],
    ['settings',  'Ajustes',        Ico.cog],
  ];
  return (
    <aside style={{ width: 240, background: 'var(--bg)', borderRight: '1px solid var(--hairline)', padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ padding: '6px 12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Wordmark size={26} />
        <span className="atd-pill mono" style={{ fontSize: 10, height: 22 }}>Growth</span>
      </div>
      <div style={{ padding: '8px 12px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span className="atd-dot live" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500 }}>WhatsApp conectado</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>+54 911 5678 1234</div>
        </div>
      </div>
      {items.map(([k, l, Icon, badge]) => {
        const on = k === active;
        return (
          <div key={k} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '9px 12px', borderRadius: 10,
            background: on ? 'var(--ink)' : 'transparent',
            color: on ? 'var(--bg)' : 'var(--ink-2)',
            fontSize: 13.5,
          }}>
            <Icon /><span style={{ flex: 1 }}>{l}</span>
            {badge && <span className="mono" style={{ fontSize: 11, opacity: 0.6 }}>{badge}</span>}
          </div>
        );
      })}
      <div style={{ marginTop: 'auto', padding: '10px 12px', borderTop: '1px solid var(--hairline)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <Avatar initials="LM" size={32} bg="var(--green)" fg="var(--on-green)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>Lucía Méndez</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Owner</div>
        </div>
        <Ico.dot3 />
      </div>
    </aside>
  );
}

function Topbar({ title, sub, right }) {
  return (
    <div style={{ padding: '20px 32px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--hairline)' }}>
      <div>
        {sub && <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>{sub}</div>}
        <h1 className="serif" style={{ fontSize: 36, margin: '4px 0 0', letterSpacing: '-0.02em' }}>{title}</h1>
      </div>
      {right}
    </div>
  );
}

function DesktopHome() {
  return (
    <div className="atd" style={{ display: 'flex', height: '100%', background: 'var(--bg)' }}>
      <Sidebar active="home" />
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Topbar
          sub="centro de control · martes 6 may"
          title={<>Buen día, <span className="italic">Lucía.</span></>}
          right={<div style={{ display: 'flex', gap: 10 }}>
            <button className="atd-btn ghost sm"><Ico.bell /> 3</button>
            <button className="atd-btn primary sm"><Ico.plus /> Nuevo producto</button>
          </div>}
        />
        <div style={{ flex: 1, overflow: 'auto', padding: 28, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: 28, borderRadius: 22, background: 'var(--ink)', color: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -50, right: -50, width: 240, height: 240, borderRadius: '50%', background: 'var(--accent)', opacity: 0.18, filter: 'blur(40px)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>
                    <span className="atd-dot live" />WhatsApp conectado · IA activa
                  </div>
                  <div className="serif" style={{ fontSize: 56, lineHeight: 0.95, letterSpacing: '-0.02em', maxWidth: 540 }}>
                    Tu asistente está <span className="italic" style={{ color: 'var(--accent)' }}>vendiendo.</span>
                  </div>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', marginTop: 10, maxWidth: 460 }}>
                    14 conversaciones hoy · 3 esperan respuesta humana · 47 nuevos contactos esta semana.
                  </p>
                </div>
                <button className="atd-btn accent sm">Ir al inbox <Ico.arrow /></button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { k: 'Conv. hoy',    v: '14',     s: '+3 desde ayer', tone: 'light' },
                { k: 'Pendientes',   v: '3',      s: 'Esperan humano', tone: 'accent' },
                { k: 'Productos',    v: '12/100', s: 'Plan Growth',    tone: 'light' },
                { k: 'Mensajes IA',  v: '1.247',  s: 'Este mes',       tone: 'light' },
              ].map((s, i) => (
                <div key={i} className="atd-card" style={{ padding: 18, background: s.tone === 'accent' ? 'var(--accent)' : 'var(--surface)', color: s.tone === 'accent' ? 'var(--on-accent)' : 'var(--ink)' }}>
                  <div className="mono" style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase' }}>{s.k}</div>
                  <div className="serif" style={{ fontSize: 36, lineHeight: 1, marginTop: 6 }}>{s.v}</div>
                  <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 4 }}>{s.s}</div>
                </div>
              ))}
            </div>
            <div className="atd-card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>conversaciones recientes</div>
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Ver todas →</span>
              </div>
              {[
                ['Marina G.', 'Sí, a Caballito.',                '14:02', 'ia'],
                ['Diego F.',  '¿Tienen el negro talle 42?',       '13:48', 'ia',    2],
                ['Catalina',  'Hola, quería una consulta',        '13:22', 'human', 1],
                ['Tomás R.',  'Ah perfecto, lo paso a buscar',    '11:30', 'human'],
              ].map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: i ? '1px dashed var(--hairline-2)' : 'none', alignItems: 'center' }}>
                  <Avatar initials={c[0].split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()} size={36}
                    bg={c[3] === 'human' ? 'var(--human-tint)' : 'var(--green-tint)'}
                    fg={c[3] === 'human' ? '#7c5a1a' : 'var(--green-ink)'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c[0]}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c[1]}</div>
                  </div>
                  <span className="atd-pill" style={{ fontSize: 10, height: 22, background: c[3] === 'human' ? 'var(--human-tint)' : 'var(--green-tint)', color: c[3] === 'human' ? '#7c5a1a' : 'var(--green-ink)', borderColor: 'transparent' }}>{c[3]}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', width: 40, textAlign: 'right' }}>{c[2]}</span>
                  {c[4] && <span className="atd-badge">{c[4]}</span>}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="atd-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>configuración</div>
                  <div style={{ fontSize: 16, fontWeight: 500, marginTop: 2 }}>Configurá tu negocio</div>
                </div>
                <div style={{ position: 'relative', width: 44, height: 44 }}>
                  <svg viewBox="0 0 36 36" width="44" height="44" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="18" cy="18" r="15" fill="none" stroke="var(--hairline-2)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray={`${0.6 * 94} 94`} strokeLinecap="round" />
                  </svg>
                  <span className="mono" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>3/5</span>
                </div>
              </div>
              {['Conectá WhatsApp','Elegí una plantilla','Cargá productos','Probá una conversación','Invitá a tu equipo'].map((t, i) => {
                const done = i < 3;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? '1px dashed var(--hairline-2)' : 'none' }}>
                    <span style={{ width: 18, height: 18, borderRadius: 999, background: done ? 'var(--green)' : 'transparent', border: done ? 'none' : '1.5px solid var(--hairline-3)', color: 'var(--on-green)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {done && <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M4 10.5L8 14l8-8" /></svg>}
                    </span>
                    <span style={{ fontSize: 13, color: done ? 'var(--muted)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none' }}>{t}</span>
                    {!done && <Ico.arrow style={{ marginLeft: 'auto', color: 'var(--muted)' }} />}
                  </div>
                );
              })}
            </div>
            <div className="atd-card" style={{ padding: 20, background: 'var(--green)', color: 'var(--on-green)' }}>
              <div className="mono" style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase' }}>plantilla aplicada</div>
              <div className="serif" style={{ fontSize: 28, marginTop: 8, lineHeight: 1.05 }}>Tienda de celulares</div>
              <p style={{ fontSize: 12.5, opacity: 0.8, marginTop: 6, lineHeight: 1.45 }}>
                Tu asistente responde precios, stock, cuotas, envíos y garantía con la información cargada.
              </p>
              <button className="atd-btn ghost sm" style={{ marginTop: 14, color: 'var(--bg)', borderColor: 'rgba(255,255,255,0.25)' }}>Editar respuestas</button>
            </div>
            <div className="atd-card" style={{ padding: 20, background: 'var(--accent-soft)', borderColor: 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--accent)', color: 'var(--on-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Ico.spark /></span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent-ink)' }}>Probá Pro 14 días</div>
                  <div style={{ fontSize: 12, color: 'var(--accent-ink)', opacity: 0.85, marginTop: 4 }}>Multi-WhatsApp, métricas avanzadas y soporte prioritario.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function DesktopInbox() {
  const chats = [
    { name: 'Marina G.', last: 'Sí, a Caballito.',          t: '14:02', mode: 'ia',    active: true },
    { name: 'Diego F.',  last: '¿Tienen el negro talle 42?', t: '13:48', mode: 'ia',    unread: 2 },
    { name: 'Catalina',  last: 'Hola, quería una consulta',  t: '13:22', mode: 'human', unread: 1 },
    { name: 'Tomás R.',  last: 'Ah perfecto, lo paso a buscar', t: '11:30', mode: 'human' },
    { name: 'Belén',     last: 'Audio · 0:14',                t: '10:12', mode: 'ia' },
    { name: 'Mauro',     last: 'Te paso transferencia',       t: 'ayer',  mode: 'ia' },
  ];
  return (
    <div className="atd" style={{ display: 'flex', height: '100%', background: 'var(--bg)' }}>
      <Sidebar active="chats" />
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 320, borderRight: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 18px 12px' }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>inbox · 14 hoy</div>
            <h1 className="serif" style={{ fontSize: 28, margin: '4px 0 14px', letterSpacing: '-0.02em' }}>Conversaciones</h1>
            <div style={{ height: 38, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--hairline-2)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
              <Ico.search /><span style={{ fontSize: 13, color: 'var(--muted)' }}>Buscar</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              {[['Todas',true],['Pendientes',false],['IA',false],['Humano',false]].map(([n, on]) => (
                <span key={n} className="atd-pill" style={{ fontSize: 11, height: 24, background: on ? 'var(--ink)' : 'var(--surface)', color: on ? 'var(--bg)' : 'var(--ink-2)', borderColor: on ? 'transparent' : 'var(--hairline-2)' }}>{n}</span>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {chats.map((c, i) => (
              <div key={i} style={{ padding: '10px 16px', display: 'flex', gap: 10, alignItems: 'center', borderTop: i ? '1px solid var(--hairline)' : 'none', background: c.active ? 'var(--surface)' : 'transparent', borderLeft: c.active ? '3px solid var(--accent)' : '3px solid transparent' }}>
                <Avatar initials={c.name.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()} size={38}
                  bg={c.mode === 'human' ? 'var(--human-tint)' : 'var(--green-tint)'}
                  fg={c.mode === 'human' ? '#7c5a1a' : 'var(--green-ink)'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>{c.name}</span>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{c.t}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.last}</span>
                    {c.unread && <span className="atd-badge" style={{ marginLeft: 6 }}>{c.unread}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-elev)' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar initials="MG" size={42} bg="var(--green-tint)" fg="var(--green-ink)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>Marina G.</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--green-soft)' }}>respondiendo con IA · +54 911 4567 8901</div>
            </div>
            <div className="atd-seg">
              <button className="on"><Ico.spark style={{ width: 12, height: 12 }} /> IA</button>
              <button>Humano</button>
            </div>
            <button className="atd-btn ghost sm">Ver cliente</button>
          </div>
          <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', margin: '6px 0' }}>· hoy ·</div>
            <div className="atd-bub in">Hola! ¿Tienen iPhone 14 en negro? 📱</div>
            <div className="atd-bub out">¡Hola Marina! Sí, tenemos en negro y azul.<br />Precio $1.299.000 o 12 cuotas de $108.250. ¿Lo querés con envío?<div className="meta">ia · 14:02</div></div>
            <div className="atd-bub in">Sí, a Caballito.</div>
            <div className="atd-bub out">Perfecto. Llega mañana sin cargo. Te paso el link de pago.<div className="meta">ia · 14:02</div></div>
          </div>
          <div style={{ padding: '14px 24px 18px', borderTop: '1px solid var(--hairline)', display: 'flex', gap: 10, alignItems: 'center' }}>
            <Ico.paper />
            <div style={{ flex: 1, minHeight: 40, padding: '10px 14px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--hairline-2)', fontSize: 13, color: 'var(--muted)' }}>Tomá el chat o sugerí…</div>
            <button className="atd-btn primary sm"><Ico.send /> Enviar</button>
          </div>
        </div>

        <div style={{ width: 280, borderLeft: '1px solid var(--hairline)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>cliente</div>
          <Avatar initials="MG" size={56} bg="var(--green-tint)" fg="var(--green-ink)" />
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>Marina G.</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>+54 911 4567 8901</div>
          </div>
          <div className="atd-card" style={{ padding: 14 }}>
            <div className="atd-kv"><span className="k">Primera vez</span><span className="v">hoy 14:01</span></div>
            <div className="atd-kv"><span className="k">Mensajes</span><span className="v">5</span></div>
            <div className="atd-kv"><span className="k">Etiquetas</span><span className="v">interesado</span></div>
          </div>
          <div className="atd-card" style={{ padding: 14, background: 'var(--accent-soft)', borderColor: 'transparent' }}>
            <div style={{ fontSize: 12, color: 'var(--accent-ink)', fontWeight: 500, display: 'flex', gap: 8, alignItems: 'center' }}><Ico.spark /> Sugerencia IA</div>
            <p style={{ fontSize: 12.5, color: 'var(--accent-ink)', margin: '8px 0 0', lineHeight: 1.5 }}>Ofrecer protector de pantalla y funda. Marina está cerrando compra.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { DesktopHome, DesktopInbox, Sidebar, Topbar });
