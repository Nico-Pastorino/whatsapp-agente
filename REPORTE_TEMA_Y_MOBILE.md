# Reporte — Tema claro/oscuro/sistema + mobile + conexión WhatsApp

Fecha: 2026-06-02

## Resumen

Se agregó soporte profesional de **apariencia (claro / oscuro / sistema)** a toda la app, se mejoró la **consistencia visual** en ambos temas y se rehízo la **pantalla de conexión de WhatsApp** para que sea clara desde el celular. Todo con cambios seguros e incrementales: no se tocó la lógica de WhatsApp, worker, Baileys, JID, Mercado Pago ni login.

## Tarea 1 — Apariencia claro / oscuro / sistema ✅

**Cómo funciona**
- `ThemeProvider` (`src/components/ThemeProvider.tsx`): maneja la elección (claro/oscuro/sistema), la resuelve y la aplica seteando `data-theme` en `<html>`.
- **Persistencia en `localStorage`** (`atende-theme`). No se tocó backend (cumple la regla de “solo Supabase si ya existiera estructura clara”).
- **“Sistema”** sigue al dispositivo en vivo vía `matchMedia('(prefers-color-scheme: dark)')`.
- **Sin parpadeo**: un script inline en el layout fija el tema antes del primer pintado.
- La paleta oscura se definió **sobrescribiendo las mismas CSS variables** (`--bg`, `--ink`, `--surface`, etc.) bajo `:root[data-theme="dark"]`. Como casi todo el UI ya usa `var(--…)`, el tema se aplica en toda la app (landing, login y dashboard) sin editar cada componente.
- **Red de seguridad**: para las pocas clases Tailwind grises hardcodeadas (labels, loaders) se agregó un override solo-en-oscuro en `globals.css`, sin tener que tocar 15 archivos.
- Se ajustaron las dos “cards oscuras” destacadas (hero de Inicio y de Mi Plan) con variables dedicadas (`--feature-*`) para que se vean perfectas en ambos temas.

**Dónde se elige**
- Mobile: **Más → Apariencia** (selector de 3 opciones).
- Desktop: al pie del **menú lateral**.

**Archivos:** `ThemeProvider.tsx`, `ThemeToggle.tsx` (nuevos), `app/layout.tsx`, `globals.css`, `MoreScreen.tsx`, `DashboardSidebar.tsx`, `HomeScreen.tsx`, `PlanOverview.tsx`.

## Tarea 3 — Conexión WhatsApp mobile-aware ✅

`QRScreen.tsx` detecta pantalla chica (`max-width: 768px`) y adapta la experiencia. **No se tocó el polling ni la lógica de conexión.**

- **Desktop/tablet:** igual que antes — QR + instrucciones + estado.
- **Mobile:** pantalla clara “Conectá desde otra pantalla” con explicación, y botones:
  - **Copiar link de conexión**
  - **Enviar link por WhatsApp**
  - **Actualizar estado**
  - **Ver instrucciones**
  - **Ver el código QR igualmente** → muestra el QR con la advertencia: *“Necesitás escanear este código desde el teléfono donde tenés WhatsApp, no desde este mismo.”*
- El estado de conexión se sigue actualizando igual; cuando WhatsApp vincula, transiciona como siempre.

## Tarea 2 — Mobile-first y consistencia ✅ (incremental)

- La navegación mobile (bottom tab bar) y el split lista/detalle ya existían; se mantuvieron y ahora respetan el tema.
- Botones táctiles grandes (`atd-btn` 44–52px) en los flujos nuevos.
- Lenguaje siempre claro para el usuario final (sin términos técnicos): “Conectá tu WhatsApp”, “Tu asistente”, etc.
- Cards oscuras destacadas corregidas para oscuro.
- **Nota:** los pocos fondos pastel de error/aviso (ej. rojo/ámbar muy claros) se mantienen claros en modo oscuro; son legibles (texto oscuro) y es una diferencia estética menor. Quedan para un pulido futuro si se desea.

## Tarea 4 — Pairing code

Investigado y documentado aparte en **`PROPUESTA_PAIRING_CODE_V2.md`**. Resumen: Baileys 6.7.22 **sí** soporta `requestPairingCode`; se recomienda para V2 manteniendo el QR como camino principal. **No implementado** (toca la zona sensible del worker).

## Pruebas realizadas

- **Typecheck** (`tsc --noEmit`): **0 errores**.
- **Lint** (`next lint`): sin issues nuevos (solo warnings preexistentes).
- Revisión de límites server/client (el `ThemeProvider` cliente envuelve children server correctamente; script inline pre-hidratación estándar).

**Pendiente de QA visual** (requiere la app corriendo): probar claro/oscuro/sistema, recargar y verificar persistencia, y `/app/connect` en desktop vs mobile. Recomendado hacerlo con `npm run dev` o tras el deploy. La lógica de QR, estado de conexión, conversaciones y modo IA/humano no se modificó.

## Qué NO se tocó

WhatsApp/worker/Baileys, flujo QR (polling y estados), JID/`remoteJid`/`last_inbound_jid`/outbox, modo IA/humano, conversaciones, Mercado Pago, login/signup, y el backend (la preferencia de tema vive en el navegador). Multi-tenant intacto.
