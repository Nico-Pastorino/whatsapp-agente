# Reporte de mejoras — Atende / Agente WhatsApp

Fecha: 2026-06-01

## 1. Resumen ejecutivo

**Qué encontré.** Atende ya era una app sólida y bien arquitecturada (multi-tenant
correcto, lógica de JID de WhatsApp correcta, billing por Mercado Pago funcionando).
Los problemas eran de **producto y experiencia**, no de cimientos: onboarding duplicado
y desincronizado, Centro de control no accionable, falta de un control explícito de
tono, ausencia de una pantalla para "probar el asistente", inbox sin estados
comerciales, conversaciones de escritorio sin panel del cliente, lenguaje técnico
filtrado en la UI y navegación que llevaba al inbox vacío en vez del onboarding.

**Qué mejoré.** Implementé 4 bloques completos, todos sin tocar flujos críticos:
1. Navegación y lenguaje.
2. Centro de control accionable + onboarding unificado.
3. Inbox comercial + panel lateral del cliente.
4. Tono de respuesta explícito + pantalla "Probar asistente".

**Impacto comercial.** El usuario nuevo ahora entra a un Centro de control que le dice
exactamente qué hacer, puede elegir el tono de su asistente y probarlo en segundos
antes de conectar WhatsApp, y el equipo ve de un vistazo qué clientes están interesados,
preguntan precio o quieren reservar. Es una experiencia mucho más vendible y "premium",
manteniendo intacto todo lo que ya funcionaba.

## 2. Archivos modificados

**Nuevos:**
- `supabase/migrations/024_response_tone.sql` — migración aditiva del tono.
- `src/lib/onboarding.ts` — fuente única del checklist de entrenamiento + tonos.
- `src/lib/conversation-insights.ts` — derivación de señales comerciales (cliente).
- `src/app/api/assistant/test/route.ts` — endpoint de prueba del asistente (solo lectura).
- `src/components/AssistantTester.tsx` — sandbox de prueba (bottom sheet, mobile-first).
- `src/components/ConversationClientPanel.tsx` — panel lateral del cliente (desktop).

**Modificados:**
- `supabase/schema.sql` — agrega `response_tone` a `business_settings` (para instalaciones nuevas).
- `src/lib/data-access.ts` — `BusinessProfile.response_tone` + lectura/escritura.
- `src/app/api/business/route.ts` — acepta y valida `response_tone`.
- `src/lib/openrouter.ts` — el prompt de la IA usa el tono configurado.
- `src/app/app/page.tsx` — `/app` redirige al Centro de control (`/app/home`).
- `src/app/app/layout.tsx` — el bloqueo de trial vencido ahora cubre `agenda` y `stats`.
- `src/components/MoreScreen.tsx` — saca "Mi Negocio" (estaba duplicado con la tab Negocio).
- `src/components/HomeScreen.tsx` — Centro de control accionable.
- `src/components/BusinessConfig.tsx` — tono + probar asistente + checklist unificado.
- `src/components/ConversationList.tsx` — chips de señal comercial en la lista.
- `src/components/ConnectionGate.tsx` — layout de 3 columnas + texto sin jerga técnica.

## 3. Cambios de UX/UI

- **Centro de control (Inicio):** saludo real (sin "Vos"), tarjeta de estado del
  asistente, **próxima acción recomendada** dinámica (prioriza conversaciones que
  necesitan atención), accesos rápidos, checklist de activación con porcentaje y
  deep-links, y tarjetas de actividad con números reales.
- **Inbox:** chips comerciales en cada conversación ("Quiere reservar", "Pregunta
  precio", "Interesado") además de "Necesita atención".
- **Conversaciones (desktop):** tercera columna con datos del cliente, estado,
  señal comercial y una sugerencia de acción. Se muestra en pantallas anchas (`lg`);
  en mobile la experiencia lista/chat queda igual.
- **Mi negocio:** control de **Tono de respuesta** con 4 presets, botón **Probar
  asistente**, y un checklist coherente con el del Inicio.
- **Lenguaje:** se eliminó "worker" y el estado crudo ("qr"/"connecting") de la
  pantalla de conexión.

## 4. Cambios funcionales

- **Tono de respuesta** persistido y aplicado al prompt de la IA.
- **Probar asistente:** nuevo endpoint `POST /api/assistant/test` que genera una
  respuesta con la configuración guardada (datos, catálogo, tono, FAQ) **sin** enviar
  nada por WhatsApp ni guardar mensajes. Respeta el estado de cuenta (trial/plan) por backend.
- **Onboarding unificado:** `buildAssistantChecklist()` es la única definición; la usan
  Inicio y Mi negocio (antes había dos checklists con lógica distinta y frágil).
- **Bloqueo de trial vencido** extendido a `agenda` y `stats` (antes quedaban accesibles a nivel navegación).
- **Entrada al dashboard** corregida hacia el Centro de control.

## 5. Bugs corregidos

- Centro de control mostraba "conversaciones pendientes" siempre en `0` (hardcodeado) → ahora usa el conteo real de `needs_attention`.
- Checklist de "Mi negocio" detectaba "horarios"/"tono" con regex sobre texto libre (frágil y engañoso) → ahora usa campos explícitos.
- "Mi Negocio" aparecía duplicado (tab + menú "Más").
- Texto técnico ("worker", estado crudo) visible para el usuario final.
- Login/entrada caía en el inbox vacío en lugar del onboarding.

## 6. Riesgos detectados (no introducidos por estos cambios)

- El bloqueo de trial depende del header `x-pathname` del middleware; si fallara,
  las APIs siguen protegidas por backend (defensa en profundidad ya existente).
- El modo Humano vuelve a IA tras inactividad (by-design); conviene comunicarlo mejor
  en una próxima iteración.
- Las señales comerciales del inbox son **derivadas del último mensaje del cliente**
  (heurística liviana en el front), no del análisis persistido de la IA. Es seguro y
  útil; la versión "persistida" queda recomendada (ver sección 9).

## 7. Pruebas realizadas

- **Typecheck:** `tsc --noEmit` → **exit 0** (sin errores de tipos).
- **Lint:** `next lint` → **exit 0** (solo warnings preexistentes, ninguno nuevo bloqueante).
- **Build:** `next build` arranca y compila sin errores tempranos (el build completo se
  ejecuta en el deploy de Vercel, su flujo normal).
- **Límites server/client:** verificado que ningún componente cliente importa la capa de
  servidor (solo `import type`, que se borra en compilación) y que los módulos
  compartidos no usan `server-only`.
- **Revisión manual de flujos críticos:** no se tocó worker, Baileys, handler/JID,
  `remoteJid`, `last_inbound_jid`, outbox, webhook de Mercado Pago, login/signup,
  proveedor/modelo de IA ni el flujo de QR.

> Nota: las pruebas de runtime (signup real, QR, pago) requieren Supabase + worker + MP
> en vivo; no se pueden ejecutar en este entorno. Quedan recomendadas en staging (sección 9).

## 8. Qué NO toqué (para no romper)

Worker, Baileys, `handler.ts` (lógica de JID y respuesta al `remoteJid` real),
`last_inbound_jid`, outbox/deduplicación, webhook de Mercado Pago, login/signup,
sistema de suscripciones, **precios** (se mantienen 29/59/99k por tu decisión),
variables de entorno, arquitectura general y rutas críticas.

## 9. Recomendado para la próxima iteración

- **Persistir las señales comerciales**: ya tenés `analyzeConversationAction()` en el
  handler detectando `hot_lead` / `appointment_request`. Con una columna `lead_status`
  (aditiva) y un write seguro y envuelto en try/catch en el handler, el inbox mostraría
  la clasificación real de la IA en vez de la heurística de texto.
- **Marcar "atendida"** desde el panel del cliente (endpoint para limpiar `needs_attention`).
- Comunicar en la UI el auto-retorno de modo Humano → IA.
- Estados vacíos/skeletons en Agenda y Métricas.
- Pruebas de runtime en staging: signup→trial, QR, pago MP, CRUD catálogo, prueba IA.

## 10. Migración SQL — IMPORTANTE

**Hay que correr una migración antes (o junto) del deploy de este código.**

**Cuál:** `supabase/migrations/024_response_tone.sql`

**Por qué:** agrega la columna `response_tone` a `business_settings`. El código nuevo
la lee en `getBusinessProfile`. Si se deploya el código **sin** correr la migración,
`/api/business` devolvería error (columna inexistente).

**Orden:** es la última migración (024), después de las existentes. No depende de datos.

**Cómo correrla:** Supabase → SQL Editor → New query → pegar el contenido del archivo → Run.
Es idempotente (`add column if not exists ... default ''`): se puede correr más de una vez sin riesgo.

**Cómo verificar que salió bien:**

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'business_settings' and column_name = 'response_tone';
```

Debe devolver una fila con `response_tone | text | ''::text`. Después, en el dashboard:
Mi negocio → elegir un tono → Guardar → recargar → el tono queda seleccionado.
