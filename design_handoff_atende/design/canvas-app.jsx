// canvas-app.jsx — Main entry that assembles everything in a Design Canvas

const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "accent": "coral",
  "heroVariant": "A"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', t.theme);
    document.documentElement.setAttribute('data-accent', t.accent);
  }, [t.theme, t.accent]);

  return (
    <>
      <DesignCanvas>
        {/* ─── BRAND ─── */}
        <DCSection id="brand" title="Sistema · Atendé" subtitle="Marca, paleta, tipografía y componentes base">
          <DCArtboard id="b-identity"   label="Identidad"   width={1100} height={780}><BrandIdentity /></DCArtboard>
          <DCArtboard id="b-palette"    label="Paleta"      width={1100} height={780}><BrandPalette /></DCArtboard>
          <DCArtboard id="b-type"       label="Tipografía"  width={900}  height={780}><BrandType /></DCArtboard>
          <DCArtboard id="b-components" label="Componentes" width={1100} height={920}><BrandComponents /></DCArtboard>
        </DCSection>

        {/* ─── LANDING (DESKTOP) ─── */}
        <DCSection id="landing-desktop" title="Landing · Desktop" subtitle="3 variantes de hero + secciones completas">
          <DCArtboard id="l-heroA" label="Hero A · Editorial"        width={1280} height={720}><HeroA /></DCArtboard>
          <DCArtboard id="l-heroB" label="Hero B · Brutalist dark"   width={1280} height={720}><HeroB /></DCArtboard>
          <DCArtboard id="l-heroC" label="Hero C · Conversacional"   width={1280} height={720}><HeroC /></DCArtboard>
          <DCArtboard id="l-problem"  label="Problema"      width={1280} height={520}><ProblemSection /></DCArtboard>
          <DCArtboard id="l-how"      label="Cómo funciona" width={1280} height={520}><HowItWorks /></DCArtboard>
          <DCArtboard id="l-features" label="Funciones"     width={1280} height={680}><FeaturesGrid /></DCArtboard>
          <DCArtboard id="l-cases"    label="Casos / rubros" width={1280} height={680}><UseCases /></DCArtboard>
          <DCArtboard id="l-pricing"  label="Planes"        width={1280} height={620}><PricingSection /></DCArtboard>
          <DCArtboard id="l-trust"    label="Confianza"     width={1280} height={520}><TrustSection /></DCArtboard>
          <DCArtboard id="l-cta"      label="CTA + Footer"  width={1280} height={580}>
            <div><FinalCTA /><Footer /></div>
          </DCArtboard>
        </DCSection>

        {/* ─── LANDING FULL (one tall artboard) ─── */}
        <DCSection id="landing-full" title="Landing · Página completa" subtitle="Hero seleccionable vía Tweaks">
          <DCArtboard id="l-full" label={`Landing armada · Hero ${t.heroVariant}`} width={1280} height={5400}>
            <LandingDesktop heroVariant={t.heroVariant} />
          </DCArtboard>
          <DCArtboard id="l-mobile" label="Landing · Mobile" width={390} height={2400}>
            <LandingMobile />
          </DCArtboard>
        </DCSection>

        {/* ─── DASHBOARD MOBILE ─── */}
        <DCSection id="mobile" title="Dashboard · Mobile (390×844)" subtitle="9 pantallas — flujo completo">
          <DCArtboard id="m-home"      label="01 · Centro"             width={410} height={864}><MobileHome /></DCArtboard>
          <DCArtboard id="m-chats"     label="02 · Conversaciones"     width={410} height={864}><MobileChats /></DCArtboard>
          <DCArtboard id="m-chat"      label="03 · Chat detail"        width={410} height={864}><MobileChat /></DCArtboard>
          <DCArtboard id="m-empty"     label="04 · Empty state"        width={410} height={864}><MobileEmpty /></DCArtboard>
          <DCArtboard id="m-business"  label="05 · Mi negocio"         width={410} height={864}><MobileBusiness /></DCArtboard>
          <DCArtboard id="m-templates" label="06 · Plantillas"         width={410} height={864}><MobileTemplates /></DCArtboard>
          <DCArtboard id="m-products"  label="07 · Productos"          width={410} height={864}><MobileProducts /></DCArtboard>
          <DCArtboard id="m-plan"      label="08 · Mi plan"            width={410} height={864}><MobilePlan /></DCArtboard>
          <DCArtboard id="m-team"      label="09 · Equipo"             width={410} height={864}><MobileTeam /></DCArtboard>
          <DCArtboard id="m-connect"   label="10 · Conectar WhatsApp"  width={410} height={864}><MobileConnect /></DCArtboard>
        </DCSection>

        {/* ─── DASHBOARD DESKTOP ─── */}
        <DCSection id="dashboard" title="Dashboard · Desktop (1280×820)" subtitle="Vistas con sidebar fijo">
          <DCArtboard id="d-home"  label="Centro · Desktop"  width={1280} height={820}><DesktopHome /></DCArtboard>
          <DCArtboard id="d-inbox" label="Inbox · 3 columnas" width={1280} height={820}><DesktopInbox /></DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Apariencia">
          <TweakRadio  label="Tema"  value={t.theme}  options={[['light','Claro'],['dark','Oscuro']]} onChange={v => setTweak('theme', v)} />
          <TweakColor  label="Acento" value={t.accent}
            options={[
              { value: 'coral',    color: '#ff6b4d' },
              { value: 'lime',     color: '#c5f23a' },
              { value: 'violet',   color: '#7b5cff' },
              { value: 'electric', color: '#2c5cff' },
            ]}
            onChange={v => setTweak('accent', v)} />
        </TweakSection>
        <TweakSection title="Landing">
          <TweakRadio label="Variante de hero" value={t.heroVariant}
            options={[['A','A'],['B','B'],['C','C']]}
            onChange={v => setTweak('heroVariant', v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
