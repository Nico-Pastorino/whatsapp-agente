# Handoff: Atendé — Asistente comercial por WhatsApp

## Overview

Atendé es una webapp SaaS para PyMEs y comercios independientes en LATAM que querés que vendan más por WhatsApp sin tener que estar pegado al teléfono. Permite conectar el WhatsApp del negocio, configurar un asistente con IA en menos de 10 minutos eligiendo entre plantillas pre-armadas (tienda de celulares, restaurante, peluquería, etc.), y dejarlo respondiendo conversaciones, recomendando productos y tomando pedidos.

Este bundle contiene **el sistema de diseño completo** (marca, paleta, tipografía, componentes), **la landing pública** (3 variantes de hero + página completa) y **el dashboard interno** (10 pantallas mobile + 2 pantallas desktop con sidebar).

---

## About the Design Files

Los archivos en `design/` son **referencias de diseño escritas en HTML+JSX (con React via Babel inline)** — prototipos que muestran la apariencia, el comportamiento y el copy buscados. **No son código de producción para copiar tal cual.**

La tarea del desarrollador es **recrear estos diseños en el entorno del proyecto destino** (Next.js, Remix, Astro, Vue, SwiftUI, native, etc.) usando los patrones, librerías y design tokens ya establecidos en ese codebase. Si todavía no hay codebase, recomiendo Next.js 14 + Tailwind + shadcn/ui (encajan bien con el estilo editorial-tech del diseño).

Ver `design/Atende - Sistema de Diseño.html` en un navegador para explorar todo en un canvas pan-and-zoom interactivo. El panel de Tweaks (esquina inferior derecha) permite alternar tema claro/oscuro, color de acento y variante de hero.

---

## Fidelity

**High-fidelity (hifi).** Colores, tipografías, espaciados, radios y copy son finales. Los placeholders de productos/avatares siguen siendo placeholders — al implementarse, conectarlos a datos reales o assets aportados por el cliente.

---

## Brand & Design Tokens

### Nombre del producto
**Atendé** — verbo en voseo rioplatense ("atender" → vos atendé). Conecta con la idea de "yo atiendo por vos" sin chocar con la marca WhatsApp.

### Wordmark
Texto serif italic ("Atendé") en `Instrument Serif` con un punto verde de acento al final. Ver `Wordmark` component en `brand.jsx`.

### Paleta — todas en `tokens.css`

**Light theme (default):**
| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#f4f1ea` | Fondo principal (warm cream) |
| `--bg-elev` | `#faf8f3` | Fondos elevados |
| `--surface` | `#ffffff` | Cards, inputs |
| `--surface-2` | `#efeae0` | Cards secundarias |
| `--ink` | `#0e1411` | Texto principal, botones primary |
| `--ink-2` | `#2a2f2c` | Texto secundario |
| `--ink-3` | `#5a615d` | Texto terciario |
| `--muted` | `#8a908c` | Texto de soporte / mono labels |
| `--hairline` | `rgba(14,20,17,0.08)` | Bordes finos |
| `--hairline-2` | `rgba(14,20,17,0.14)` | Bordes |
| `--hairline-3` | `rgba(14,20,17,0.22)` | Bordes prominentes |
| `--green` | `#1f6b4a` | Verde de marca (NO es el verde de WhatsApp) |
| `--green-soft` | `#3a9270` | Verde live/status |
| `--green-tint` | `#d9ead8` | Backgrounds suaves |
| `--green-ink` | `#0d3b2a` | Texto sobre tints |
| `--on-green` | `#f4f1ea` | Texto sobre verde sólido |
| `--accent` | `#ff6b4d` (coral, default) | Acento disruptivo |
| `--accent-soft` | `#ffe5dc` | Tints de acento |
| `--accent-ink` | `#7a2a17` | Texto sobre tints |
| `--on-accent` | `#0e1411` | Texto sobre acento sólido |
| `--human-tint` | `#fbe9c8` | Estado "modo humano" |

**Dark theme:** Ver `tokens.css` línea 35+ (`[data-theme="dark"]`). Mantiene los mismos roles, invierte ink/bg, y mantiene verde + acento más saturados.

**Acento alternativo (vía Tweak):** lime `#c5f23a`, violet `#7b5cff`, electric `#2c5cff`. Aplicado vía `[data-accent="..."]` en `<html>`.

### Tipografía

| Familia | Uso | Pesos |
|---|---|---|
| `Instrument Serif` | Display titulares, hero, números grandes (KPIs). Italic agrega carácter en "vos", "está", "atendé." | 400, 400 italic |
| `Geist` | Body, UI, labels, copy general | 400, 500, 600 |
| `Geist Mono` | Labels técnicos en uppercase, números de teléfono, breadcrumbs, timestamps | 400, 500 |

Importadas desde Google Fonts en el `<head>` del HTML.

**Reglas de uso:**
- Hero/section titles → `Instrument Serif`, 56–96px, line-height 0.95–1, letter-spacing -0.02em
- Body → `Geist` 14–16px, line-height 1.5
- Labels / monoespaciado → `Geist Mono` 11px uppercase, color `--muted`

### Spacing & radius

Radio: 10/12/14/18/22 (cards), 999 (pills, avatars). Sin "border-radius creep" — cada elemento tiene un radio intencional.
Spacing escala: 4, 8, 10, 12, 14, 16, 20, 22, 28, 32, 40 (margenes generosos en hero/landing).

### Iconografía

Set propio inline (`design/icons.jsx`). 32 íconos en viewBox 20×20, stroke 1.6, redondeados. **No se usa Lucide / Heroicons** — los íconos custom son parte del carácter visual. Reimplementarlos en el target codebase como SVG components.

---

## Screens / Views

### Sistema (sección `brand` en el canvas)
1. **Identidad** — wordmark, lockup, tone of voice
2. **Paleta** — swatches de luz/oscuro
3. **Tipografía** — escala completa
4. **Componentes** — botones, badges, inputs, cards, chat bubbles, iconografía

### Landing pública — Desktop (1280×N)
Componente `LandingDesktop` en `landing.jsx`. Secciones:

1. **Hero** — 3 variantes (todas implementadas, seleccionables vía Tweak):
   - **A · Editorial** — título serif grande a la izquierda, mockup de teléfono con conversación animada a la derecha
   - **B · Brutalist dark** — fondo `--ink`, tipografía masiva, bloques sólidos
   - **C · Conversacional** — chat de WhatsApp grande como héroe central
2. **Problema** — antes/después: bandeja saturada vs Atendé respondiendo solo
3. **Cómo funciona** — 3 pasos: conectar WhatsApp → elegir plantilla → activar
4. **Funciones** — grid 6 features: IA con tu info, multi-WhatsApp, pasaje a humano, plantillas, métricas, equipo
5. **Casos / rubros** — celulares, restaurante, peluquería, ropa, servicios, ecommerce
6. **Planes** — Starter / Growth / Pro (Growth highlighted)
7. **Confianza** — testimonios + logos placeholder
8. **CTA final + footer**

### Landing — Mobile (390×N)
Componente `LandingMobile`. Misma estructura, layout vertical, hero más compacto.

### Dashboard mobile (390×844 — diseño en 410×864 con bezel)
Todos en `mobile.jsx`. Tab bar inferior con 5 items: Chats, Negocio, **Atendé** (centro, destacado), Plan, Más.

1. **Centro (Home)** — saludo personalizado, KPIs (conversaciones hoy, pendientes, productos), checklist de onboarding, plantilla aplicada, conversaciones recientes
2. **Conversaciones** — lista con avatares, último mensaje, badge IA/humano, contador de no leídos, filtros
3. **Chat detail** — header con cliente + toggle IA/Humano, burbujas, sugerencia IA, input
4. **Empty state** — sin conversaciones aún, ilustración + CTA
5. **Mi negocio** — datos del negocio, horarios, info de respuesta
6. **Plantillas** — galería de templates (tienda celulares, restaurante, etc.) con la activa marcada
7. **Productos** — lista con foto/precio/stock, search, FAB para agregar
8. **Mi plan** — plan actual, uso, comparativa, upgrade CTA
9. **Equipo** — miembros, roles, invitar
10. **Conectar WhatsApp** — flujo QR + estado en vivo

### Dashboard desktop (1280×820)
Todos en `desktop.jsx`. Sidebar fijo izquierdo (240px) con navegación + estado de conexión + perfil.

1. **Centro · Desktop** — hero card oscura con IA status, KPIs en grid de 4, conversaciones recientes, panel lateral con onboarding checklist + plantilla activa + CTA Pro
2. **Inbox · 3 columnas** — lista de chats / conversación activa / panel cliente con sugerencias IA

---

## Interactions & Behavior

- **Onboarding checklist** en Home: progreso circular + items con checkmark animado al completar
- **Toggle IA / Humano** en chat: segmented control, al pasar a humano se notifica al equipo
- **Tab bar mobile**: el item central "Atendé" tiene background `--accent` y se eleva visualmente
- **Estado de conexión** en sidebar/header: dot verde animado (pulse) cuando WhatsApp está conectado
- **Sugerencias IA** en panel cliente: card con tinte coral suave, ícono spark
- **Tweaks panel**: toggle bottom-right en preview mode, persiste a través de `__edit_mode_set_keys`

### Animaciones / transiciones
- Pulse del dot live: 2s ease-in-out infinito
- Caret blink en inputs activos: 1s steps(2) infinito
- Hover en botones: brightness 1.05 + scale 1.01, 120ms ease
- Page/route transitions: fade + slide 8px, 200ms ease-out

### Estados
- **Hover** en cards: subtle lift (translateY -2px) + sombra suave
- **Active** sidebar item: bg `--ink`, color `--bg`
- **Disabled**: opacity 0.5, no pointer-events
- **Loading**: skeleton con shimmer warm-cream → surface-2
- **Empty states**: ilustración geométrica + título serif + CTA primary

---

## State Management (sugerido)

```ts
// Auth
user: { id, name, email, role: 'owner'|'admin'|'agent' }
business: { id, name, phone, whatsappStatus: 'connected'|'pending'|'disconnected' }
plan: 'starter' | 'growth' | 'pro'

// Conversations
conversations: Conversation[]  // { id, contact, lastMessage, mode: 'ia'|'human', unread, t }
activeConversationId: string | null

// AI
template: 'celulares' | 'restaurante' | 'peluqueria' | 'ropa' | 'servicios' | 'ecommerce' | null
products: Product[]
aiSuggestions: Suggestion[]  // per active conversation

// Onboarding
onboardingSteps: { connectWA, pickTemplate, addProducts, testChat, inviteTeam }
```

Datos mockeados en los componentes (ver `desktop.jsx` `chats[]`, `mobile.jsx`). Reemplazar con fetch a backend / WebSocket para conversaciones en tiempo real.

---

## Files

| Archivo | Contenido |
|---|---|
| `Atende - Sistema de Diseño.html` | Entry point. Abrir en navegador para ver todo |
| `tokens.css` | Todas las variables CSS (colores, fuentes, sombras, light/dark) |
| `icons.jsx` | Set de 32 íconos custom + `Avatar` component |
| `brand.jsx` | `Wordmark`, `BrandIdentity`, `BrandPalette`, `BrandType`, `BrandComponents` |
| `landing.jsx` | `HeroA/B/C`, `ProblemSection`, `HowItWorks`, `FeaturesGrid`, `UseCases`, `PricingSection`, `TrustSection`, `FinalCTA`, `Footer`, `LandingDesktop`, `LandingMobile`, `MiniPhone`, `PhoneChat` |
| `mobile.jsx` | `StatusBar`, `TabBar`, `PhoneShell` + 10 pantallas mobile |
| `desktop.jsx` | `Sidebar`, `Topbar`, `DesktopHome`, `DesktopInbox` |
| `canvas-app.jsx` | Composición final en `<DesignCanvas>` con artboards |
| `design-canvas.jsx`, `tweaks-panel.jsx` | Infraestructura del prototipo (no es necesario portarlas) |

---

## Notas para implementación

1. **No portar el design canvas ni los tweaks** — son andamios del prototipo, no del producto.
2. **Verde ≠ WhatsApp green.** El verde de Atendé (`#1f6b4a`) es más oscuro y cálido, intencionalmente distinto. Mantener esa diferencia.
3. **Voseo rioplatense** en toda la copy: "vos", "atendé", "configurá", "probá". Si se localiza a español neutro después, mantener el tono cercano.
4. **Mobile-first.** El brief lo pide explícito. Empezar por las 10 pantallas mobile, después el desktop.
5. **Los placeholders de productos/avatares** son intencionales. El cliente cargará datos reales — no inventar fotos.
6. **Accesibilidad:** los contrastes están verificados pero re-validar con herramienta del codebase. Hit targets mobile ≥ 44px (ya cumplido).
