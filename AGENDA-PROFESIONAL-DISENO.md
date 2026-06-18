# Agenda profesional Atendé — Diseño + plan de implementación
Fecha: 2026-06-18 · Regla de oro: no romper WhatsApp/Baileys/worker/QR/MP/auth/JID/outbox/dedupe/multi-tenant. Construir por capas, la validación SIEMPRE en backend.

---

## 1. Auditoría — cómo funciona hoy

- **Horarios:** un único textarea de texto libre (`business_settings.booking_config`). El comerciante escribe "Mar a Sáb de 10 a 19" y eso se le pasa a la IA como prosa. No hay estructura, días, intervalos ni zona horaria.
- **Disponibilidad:** no existe validación. `analyzeConversationAction` (IA) infiere `{customer_name, service, starts_at}` desde la charla y, con confianza ≥ 0.62, crea un `appointment` en estado `pending`. Un humano lo confirma desde el dashboard.
- **Modelo real actual:** "solicitud → confirma una persona". La IA NO promete disponibilidad (el prompt se lo prohíbe). Funciona, pero no es agenda profesional.
- **appointments:** tabla con `status` (pending/confirmed/cancelled/done), `source` (ai/human), `starts_at`, `service`, `customer_*`, `notes`. No tiene duración ni hora de fin.
- **Aviso al encargado:** sí (internal_notifications, evento `new_appointment`), por WhatsApp.
- **Recordatorios al cliente:** no existen.
- **Confirmar desde WhatsApp (1/2/3):** no existe; hoy se confirma desde el dashboard.
- **Planes:** la feature `appointments` ya está en Growth y Pro, NO en Starter. (Buen punto de partida.)

## 2. Problemas / riesgos

1. **Sin verdad de disponibilidad:** la IA puede "tomar" un turno un domingo, a las 3 AM o pisando otro. Hoy lo tapa el "lo confirma una persona", pero no escala ni da imagen profesional.
2. **Horario no estructurado:** imposible generar slots, validar o mostrar disponibilidad. El texto libre además infla el prompt.
3. **Sin recordatorios:** los no-show son el dolor #1 de los negocios por cita. Es la feature de mayor valor percibido y retención.
4. **Confirmación atada al dashboard:** contradice "el encargado vive en WhatsApp".
5. **Sin zona horaria explícita:** "a las 5" se interpreta con el reloj del server.

## 3. Decisión de arquitectura (la bisagra)

Dos modelos posibles:

- **A. Request → confirma humano (actual):** simple, sirve a todos los rubros, bajo riesgo. Pero no es "agenda real".
- **B. Disponibilidad real (Calendly/Fresha):** el backend genera slots y valida; la IA ofrece horarios concretos y nunca pisa ni sale de horario.

**Recomendación: B, pero con la red del modelo A.** El backend valida SIEMPRE (nunca la IA). La IA propone, el backend decide: `disponible / ocupado / fuera de horario / cerrado / bloqueado`. Si el negocio no cargó horarios, se cae con elegancia al modelo A (solicitud pendiente). Así ningún negocio queda peor que hoy y los que configuran horarios obtienen agenda real.

Principio duro: **la IA nunca asume disponibilidad. La fuente de verdad es el backend.**

## 4. Base de datos (aditivo, sin romper nada)

Nuevas/ampliadas (migración 034):

- **business_hours** — horario semanal estructurado, múltiples turnos por día:
  `id, business_id, weekday (0=Dom..6=Sáb), open_time time, close_time time, created_at`. Una fila por intervalo; sin filas para un día = cerrado.
- **schedule_exceptions** — feriados, vacaciones, bloqueos y horarios especiales:
  `id, business_id, date, kind ('closed'|'block'|'special'), start_time null, end_time null, reason`. `closed` = todo el día; `block` = rango puntual ocupado; `special` = reemplaza el horario de ese día.
- **business_settings** (+ columnas): `timezone` (default `America/Argentina/Buenos_Aires`), `slot_interval_minutes` (default 30), `default_duration_minutes` (default 30), `booking_lead_minutes` (antelación mínima), `booking_horizon_days` (cuántos días para adelante se puede reservar).
- **appointments** (+ columnas): `duration_minutes`, `ends_at` (para detectar solapamientos reales).

RLS: igual que el resto (service role en backend). Multi-tenant intacto (todo filtra por `business_id`).

## 5. Motor de disponibilidad (capa independiente de la IA)

`src/lib/availability.ts` — funciones PURAS y testeables (sin DB):

- `generateDaySlots(intervals, intervalMin, durationMin)` → lista de horarios candidatos del día.
- `isSlotFree(slot, durationMin, appointments, exceptions)` → bool.
- `getAvailableSlots({ date, weekdayIntervals, exceptions, appointments, config })` → slots libres.

El worker/endpoint sólo trae datos de Supabase y llama a estas funciones. Esto permite testear la lógica sin tocar nada vivo.

## 6. Flujo WhatsApp (objetivo)

**Cliente:** pide turno en lenguaje natural ("el lunes tipo 17", "mañana a la tarde") → la IA interpreta fecha/hora aproximada → backend devuelve slots libres → la IA ofrece 2-3 concretos ("Tengo 16:30 o 17:00, ¿cuál te queda?") → cliente elige → backend reserva `pending` → avisa al encargado.

**Encargado (sin entrar al dashboard):** recibe el aviso con
`Responder: 1 confirmar · 2 rechazar · 3 reprogramar`.
El worker interpreta la respuesta del encargado (detectada por ser su propio número) y actualiza el turno; el cliente recibe la confirmación automática.

Si no hay horarios cargados → cae al flujo actual (solicitud pendiente).

## 7. Recordatorios (alto valor comercial)

Job programado (reaprovecha el patrón de `internal_notifications` + un scheduler en el worker):
- **24 hs antes** (Growth) y **2 hs antes** (Pro), con confirmación incluida ("¿seguís pudiendo? 1 sí / 2 cancelar").
- Reduce no-shows → es el argumento de venta más fuerte para subir de plan.

## 8. Distribución recomendada por plan (optimizada para upgrade)

| Capacidad | Starter | Growth | Pro |
|---|---|---|---|
| Agenda / reservas | ❌ (empuja upgrade) | ✅ | ✅ |
| Horarios estructurados + validación backend | — | ✅ | ✅ |
| Reservas por mes | — | 100 | ilimitadas |
| Confirmar desde WhatsApp (1/2/3) | — | ✅ | ✅ |
| Recordatorios | — | 24 hs | 24 hs + 2 hs + personalizable |
| Reprogramación asistida | — | básica | ✅ |
| Bloqueos / feriados / vacaciones | — | ✅ | ✅ |
| Múltiples encargados / profesionales | — | 1 | varios |
| Estadísticas de reservas y no-shows | — | — | ✅ |

Lógica comercial: la agenda es el principal **driver de upgrade** desde Starter. Los **recordatorios 2 hs + multi-profesional + stats** son el salto Growth→Pro (lo que diferencia a un negocio que "vive de los turnos"). Mantiene 3 planes, sin Enterprise.

## 9. Plan de implementación por fases (riesgo creciente)

- **Fase 0 — Fundación (ESTA entrega):** migración 034 (DB) + `lib/availability.ts` + tests. No toca worker/IA → riesgo cero sobre el flujo vivo.
- **Fase 1 — Config de horarios (UX):** editor estructurado "Asistente → Horarios y Reservas" (días, turnos, intervalo, zona horaria, feriados). Escribe en las tablas nuevas.
- **Fase 2 — Validación en el flujo IA:** el worker consulta el motor antes de crear el turno; la IA ofrece slots reales. Cae al modelo actual si no hay horarios.
- **Fase 3 — Confirmación del encargado por WhatsApp (1/2/3)** + confirmación automática al cliente.
- **Fase 4 — Recordatorios** (scheduler) + **stats** (Pro).
- **Fase 5 — Gating por plan** de cada capacidad según la tabla de arriba.

Cada fase es independiente, reversible y se despliega sola.

---

## 10. Estado de implementación
- ✅ Fase 0 entregada en este commit (DB + motor + tests).
- ⏳ Fases 1-5: a confirmar alcance y orden.
