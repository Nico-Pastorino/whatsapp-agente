// brand.jsx — Brand artboards: identity, palette, type, components, icons

function Wordmark({ size = 64, color = 'var(--ink)' }) {
  return (
    <div style={{
      fontFamily: 'Instrument Serif, serif', fontSize: size,
      letterSpacing: '-0.025em', lineHeight: 0.9,
      color, display: 'inline-flex', alignItems: 'baseline',
    }}>
      atend
      <span style={{ position: 'relative', display: 'inline-block' }}>
        é
        <span style={{
          position: 'absolute', top: -size * 0.04, right: -size * 0.18,
          width: size * 0.16, height: size * 0.16, borderRadius: '50%',
          background: 'var(--accent)',
        }} />
      </span>
    </div>
  );
}

function Swatch({ name, hex, varName, fg }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        height: 96, borderRadius: 14, background: `var(${varName})`,
        border: '1px solid var(--hairline)',
        display: 'flex', alignItems: 'flex-end', padding: 10,
      }}>
        <span className="mono" style={{ fontSize: 11, color: fg || 'var(--ink)', opacity: .7 }}>{varName}</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 13 }}>{name}</div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{hex}</div>
    </div>
  );
}

function BrandIdentity() {
  return (
    <div className="atd" style={{
      width: '100%', height: '100%', padding: 56,
      background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 32,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 56, right: 56 }}>
        <span className="atd-pill mono">b·01 · marca</span>
      </div>

      <div style={{ marginTop: 40 }}>
        <div className="mono" style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          producto / 2026
        </div>
        <Wordmark size={180} />
        <div className="serif italic" style={{ fontSize: 28, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.1 }}>
          Tu vendedor automático por WhatsApp.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 32, marginTop: 24 }}>
        <div className="atd-card" style={{ padding: 28 }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>concepto</div>
          <h3 className="serif" style={{ fontSize: 32, lineHeight: 1.1, margin: '8px 0 14px' }}>
            Un asistente <span className="italic">invisible</span> que trabaja por tu negocio.
          </h3>
          <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink-3)', margin: 0 }}>
            "Atendé" es la acción. La marca es un imperativo amable, rioplatense, directo.
            La <span className="italic serif" style={{ fontSize: 17 }}>é</span> con tilde lleva
            un punto de color: el acento gráfico es el acento del idioma — pequeña personalidad
            que aparece en el favicon, el cursor del input y el indicador de IA activa.
          </p>
        </div>

        <div className="atd-card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>alternativas</div>
          <div>
            <Wordmark size={56} /><span className="mono" style={{ marginLeft: 12, fontSize: 12, color: 'var(--muted)' }}>recomendado</span>
          </div>
          <div style={{
            fontFamily: 'Instrument Serif, serif', fontSize: 56, letterSpacing: '-0.025em',
            color: 'var(--ink)', display: 'inline-flex', alignItems: 'baseline',
          }}>
            respond<span style={{ position: 'relative' }}>é
              <span style={{ position: 'absolute', top: -2, right: -10, width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)' }} />
            </span>
            <span className="mono" style={{ marginLeft: 12, fontSize: 12, color: 'var(--muted)' }}>plan B</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>
            Ambos son verbos imperativos en español rioplatense. "Atendé" cubre todo el ciclo
            (responder + vender + cuidar al cliente). "Respondé" es más estrecho pero más concreto.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 12 }}>
        {[
          ['Mobile-first real', 'Diseñado primero para 390px. El desktop es una expansión, no la fuente.'],
          ['Editorial + app', 'Serif italic en gestos clave; sans precisa para la UI. Ni frío, ni infantil.'],
          ['Acento idioma', 'La copy usa "vos / contá / cargá". Cercanía sin perder profesionalismo.'],
          ['Verde propio', 'Un verde profundo, no el de WhatsApp. Lo nuestro: bosque, no neón.'],
        ].map(([t, d]) => (
          <div key={t} style={{ padding: 16, borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8 }}>·</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{t}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink-3)' }}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BrandPalette() {
  return (
    <div className="atd" style={{ width: '100%', height: '100%', padding: 48, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <span className="atd-pill mono">b·02 · paleta</span>
        <h2 className="serif" style={{ fontSize: 40, margin: '12px 0 6px', lineHeight: 1 }}>
          Crema, bosque, <span className="italic">y un acento que rompe.</span>
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: 0, maxWidth: 560 }}>
          Base cálida de papel, verde profundo para identidad y el acento como única licencia.
          Las cuatro variantes de acento son intercambiables sin tocar el resto del sistema.
        </p>
      </div>

      <div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase' }}>core</div>
        <div style={{ display: 'flex', gap: 14 }}>
          <Swatch name="Cream" hex="#f3f0ea" varName="--bg" />
          <Swatch name="Surface" hex="#ffffff" varName="--surface" />
          <Swatch name="Ink" hex="#0c1410" varName="--ink" fg="#fff" />
          <Swatch name="Forest" hex="#0d3b2e" varName="--green" fg="#fff" />
          <Swatch name="Forest tint" hex="#dee9e2" varName="--green-tint" />
          <Swatch name="Accent" hex="dynamic" varName="--accent" fg="var(--on-accent)" />
        </div>
      </div>

      <div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase' }}>acentos · intercambiables</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            ['Coral', '#ff6b4d', 'coral'],
            ['Lima', '#c5f23a', 'lime'],
            ['Violeta', '#7b5cff', 'violet'],
            ['Eléctrico', '#2c5cff', 'electric'],
          ].map(([n, h, v]) => (
            <div key={v} data-accent={v} style={{ padding: 16, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--hairline)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: 12, background: h }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{n}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{h}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <span className="atd-pill" style={{ background: h, color: v === 'lime' ? '#1a2400' : '#fff', borderColor: 'transparent' }}>·</span>
                <span className="atd-pill" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)', borderColor: 'transparent' }}>tint</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="atd-card" style={{ padding: 20 }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>regla</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: '8px 0 0' }}>
            <strong>El acento aparece una vez por pantalla.</strong> Es la "una cosa" que mira el usuario:
            CTA principal, badge de IA activa, o el punto del logo. Nunca dos.
          </p>
        </div>
        <div className="atd-card" style={{ padding: 20 }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>regla</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: '8px 0 0' }}>
            <strong>Verde para identidad, no para acción.</strong> Marca al producto y a los chats.
            Las acciones primarias son tinta sobre crema (más legibles, menos ruido cromático).
          </p>
        </div>
      </div>
    </div>
  );
}

function BrandType() {
  return (
    <div className="atd" style={{ width: '100%', height: '100%', padding: 48, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <span className="atd-pill mono">b·03 · tipografía</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18 }}>
        <div className="atd-card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="serif" style={{ fontSize: 88, lineHeight: 0.9, letterSpacing: '-0.02em' }}>
              Aa <span className="italic">Aa</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>display + headlines</div>
              <div style={{ fontSize: 18, fontWeight: 500 }}>Instrument Serif</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Regular · Italic</div>
            </div>
          </div>
          <p className="serif" style={{ fontSize: 28, lineHeight: 1.15, margin: '14px 0 0', color: 'var(--ink-2)' }}>
            "Tu próximo cliente <span className="italic">ya te está escribiendo.</span>"
          </p>
        </div>

        <div className="atd-card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 88, lineHeight: 0.9, letterSpacing: '-0.02em', fontWeight: 500 }}>Aa</div>
            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>UI · body · botones</div>
              <div style={{ fontSize: 18, fontWeight: 500 }}>Geist</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>400 · 500 · 600</div>
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              ['Display 56', 56, 500, 'Vendé sin estar.'],
              ['Heading 28', 28, 500, 'Conectá WhatsApp'],
              ['Body 15', 15, 400, 'Tu asistente responde 24/7 con la información de tu negocio.'],
            ].map(([n, s, w, t]) => (
              <div key={n}>
                <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{n}</div>
                <div style={{ fontSize: s, fontWeight: w, lineHeight: 1.1, marginTop: 4 }}>{t}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="atd-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="mono" style={{ fontSize: 36 }}>Aa</div>
            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>etiquetas · datos · meta</div>
              <div style={{ fontSize: 16, fontWeight: 500 }} className="mono">Geist Mono</div>
            </div>
          </div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>
            01 · ia activa &nbsp;·&nbsp; 02 · 1.247 mensajes &nbsp;·&nbsp; 03 · plan growth
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandComponents() {
  return (
    <div className="atd" style={{ width: '100%', height: '100%', padding: 40, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <span className="atd-pill mono">b·04 · componentes</span>

      {/* Buttons */}
      <div className="atd-card" style={{ padding: 22 }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12 }}>botones</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="atd-btn primary lg">Empezar ahora <Ico.arrow /></button>
          <button className="atd-btn primary">Crear mi asistente</button>
          <button className="atd-btn green">Conectar WhatsApp</button>
          <button className="atd-btn accent">Mejorar a Pro</button>
          <button className="atd-btn ghost">Ver cómo funciona</button>
          <button className="atd-btn sm ghost">Editar</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Badges */}
        <div className="atd-card" style={{ padding: 22 }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12 }}>badges & estados</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="atd-pill green"><span className="atd-dot live" />WhatsApp conectado</span>
            <span className="atd-pill"><Ico.spark /> IA activa</span>
            <span className="atd-pill" style={{ background: 'var(--human-tint)', color: '#7c5a1a', borderColor: 'transparent' }}><Ico.user /> Modo humano</span>
            <span className="atd-pill accent">Disponible en Growth</span>
            <span className="atd-pill dark">Pro</span>
            <span className="atd-pill">2 nuevas</span>
          </div>
        </div>

        {/* Inputs */}
        <div className="atd-card" style={{ padding: 22 }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12 }}>inputs</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ height: 44, borderRadius: 14, border: '1px solid var(--hairline-2)', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10, background: 'var(--surface)' }}>
              <Ico.search /><span style={{ color: 'var(--muted)', fontSize: 14 }}>Buscar conversaciones, productos…</span>
            </div>
            <div style={{ height: 44, borderRadius: 14, border: '1.5px solid var(--ink)', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10, background: 'var(--surface)' }}>
              <span style={{ fontSize: 14 }}>tienda@ejemplo.com</span>
              <span style={{ width: 1.5, height: 16, background: 'var(--accent)', marginLeft: 'auto', animation: 'blink 1s steps(2) infinite' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Cards & chat */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 16 }}>
        <div className="atd-card" style={{ padding: 22 }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12 }}>cards · plan</div>
          <div style={{ padding: 18, borderRadius: 18, background: 'var(--ink)', color: 'var(--bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div className="serif" style={{ fontSize: 32 }}>Growth</div>
              <span className="atd-pill" style={{ background: 'var(--accent)', color: 'var(--on-accent)', borderColor: 'transparent' }}>Tu plan</span>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>Para vender más por WhatsApp.</div>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              {['3 usuarios', '100 productos', '5 plantillas', 'Mensajes IA ilimitados'].map(x => (
                <div key={x} style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'rgba(255,255,255,0.85)' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 999, background: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-accent)' }}>
                    <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10.5L8 14l8-8" /></svg>
                  </span>{x}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="atd-card" style={{ padding: 22 }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12 }}>chat · burbujas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="atd-bub in">¿Tienen el iPhone 14 disponible?</div>
            <div className="atd-bub out">¡Hola! Sí, tenemos en negro y azul. Precio $1.299.000 o 12 cuotas de $108.250.<div className="meta"><Ico.spark style={{ width: 12, height: 12 }}/> ia · 14:02</div></div>
            <div className="atd-bub in">¿Hacen envíos?</div>
          </div>
        </div>
      </div>

      {/* Iconography */}
      <div className="atd-card" style={{ padding: 22 }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12 }}>iconografía · trazos finos, geométricos, rotuladores</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 6 }}>
          {['chat','bolt','shop','user','users','spark','search','bell','qr','lock','plus','arrow','cog','book','calendar','tag','send','mic','shield','layers'].map(k => (
            <div key={k} style={{ height: 56, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}>
              {React.createElement(Ico[k])}
              <span className="mono" style={{ fontSize: 9, color: 'var(--muted)' }}>{k}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}

Object.assign(window, { BrandIdentity, BrandPalette, BrandType, BrandComponents, Wordmark });
