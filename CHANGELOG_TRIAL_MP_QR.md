# Cambios: Trial Starter + Mercado Pago + Auditoría QR/Baileys

Fecha: 2026-05-19
Alcance: cambios mínimos críticos. NO se tocó la lógica de envío de mensajes, JID, `last_inbound_jid`, ni los flujos de Baileys/worker.

---

## 1. Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/app/api/auth/signup/route.ts` | `TRIAL_PLAN_CODE = "starter"` (antes `"growth"`). Comentarios actualizados. |
| `src/middleware.ts` | Inyecta header `x-pathname` en todas las requests; sin lógica de DB (Edge runtime). |
| `src/app/app/layout.tsx` | Gate server-side: si `!access.canUseApp` redirige a `/app/plan`. Excepción: `/app/plan` queda libre para pagar. |
| `src/components/PlanOverview.tsx` | Pantalla de trial expirado rediseñada mobile-first con elección de **Starter / Growth / Pro**; textos "Growth" sustituidos por nombre dinámico del plan; CTA "Ver planes". |
| `src/components/ConnectionGate.tsx` | CTA del banner trial cambiado a "Ver planes" (antes decía "Activar {plan_name}" lo que sonaba raro con Starter). |
| `src/app/api/billing/create-checkout/route.ts` | Se agrega `notification_url` explícito al crear el preapproval; warning loud si `NEXT_PUBLIC_APP_URL` no está configurado. |

Total: **6 archivos**. Sin migraciones SQL obligatorias.

---

## 2. Explicación de cambios

### 2.1 Trial = Starter
El usuario nuevo entra en `subscriptions.status='trial'` con `plan_code='starter'` y `trial_ends_at = now + 14 días`. El campo `subscription_status` y `trial_starts_at` que vos mencionabas en el prompt no existen en la DB actual — se usan `status` y `trial_started_at`, decidimos mantenerlos para no migrar.

Funciones operativas durante el trial = lo que permita el plan Starter (`monthly_message_limit`, `monthly_ai_reply_limit`, `product_limit=10`, `users_limit=3`, etc., según `plans` table). El trial **NO** desbloquea Growth/Pro: cuando entra el reply de la IA, `canUseAssistant()` evalúa los límites del plan asignado (= starter) más el estado de la suscripción.

### 2.2 Bloqueo del trial vencido (defensa en capas)

Hay tres capas que ya bloquean correctamente cuando trial venció:

1. **Backend API operativo** — Las rutas con datos sensibles (`/api/business/*`, `/api/messages/*`, `/api/mode/*`, `/api/conversations/*`, `/api/contacts/*`, `/api/connection/*`, `/api/worker/status`) usan `withActiveDashboardBusinessContext` que **ya existía** y llama a `checkAccountAccess()`. Si `!canUseApp` → HTTP 403 con mensaje claro. **No se tocó.**
2. **Worker WhatsApp (Baileys)** — `lib/baileys/handler.ts:170` y `scripts/start-worker.ts:77` **ya** validan `checkAccountAccess()` antes de generar respuestas IA o enviar outbox. Si la cuenta está bloqueada, registra el motivo en logs y no responde. **No se tocó.** Importante: el cache de subscripción (`SUBSCRIPTION_CACHE_TTL_MS=60_000`) significa que el worker tarda hasta 60 segundos en reaccionar a un cambio de estado.
3. **UI (nuevo)** — El layout `/app/app/layout.tsx` ahora redirige al `/app/plan` cuando la cuenta no puede usar la app. Hasta ahora si entrabas a `/app/conversations` con trial vencido te veías un dashboard roto con la API devolviendo 403. Ahora, antes de renderizar la página operativa, se evalúa el acceso y si no podés usarla, redirect a `/app/plan`. **Las rutas no operativas (`/app/plan`, billing) quedan accesibles para pagar.**

### 2.3 Pantalla "Trial expirado"

El componente `OnboardingGuide` dentro de `PlanOverview.tsx` ahora muestra:

- Título: "Tu prueba terminó"
- Descripción: "Elegí un plan para seguir usando tu asistente de WhatsApp. Tus conversaciones, contactos y configuración se mantienen intactos."
- Tres cards (Starter / **Growth recomendado** / Pro) con precio, 4 features destacados y CTA "Elegir <Plan>"
- Mobile-first (grid colapsa a 1 columna)
- Banner amber si está en `pending_payment` (MP procesando)
- Link "¿Ya pagaste y no se activó? Actualizá la página"

### 2.4 Mercado Pago

**Auditoría completa hecha. Estado: sólido.** Aplicados solo fixes seguros:

- ✅ **`notification_url` explícito en preapproval** — Antes MP usaba el webhook configurado en su dashboard; ahora también lo enviamos en cada preapproval. Doble seguro.
- ✅ **Warning visible si falta `NEXT_PUBLIC_APP_URL`** — En prod sin esa var, `back_url`/`notification_url` apuntaban a `http://localhost:3000` silenciosamente. Ahora loggea `console.warn` para que sea visible.

**Lo que NO se tocó (ya estaba bien):**

- Firma del webhook (`x-signature` con HMAC-SHA256) — correcta y timing-safe.
- Idempotencia — el código actualiza por `external_reference` y `mp_preapproval_id`, los SET son naturalmente idempotentes (status='active' dos veces da el mismo resultado).
- Mapeo `preapproval.authorized` → `subscriptions.status='active'` con `plan_code=paymentRecord.plan_code` y `current_period_end=preapproval.next_payment_date` — correcto.
- Mapeo `payment.approved` → mismo flujo pero `current_period_end = now + 30d`.
- `markSubscriptionPastDueIfTrialExpired()` para cancelaciones — protege casos de borde sin bloquear cuentas durante trial.
- `withDashboardBusinessContext` (no `withActive`) en checkout — correcto, el usuario en trial vencido SÍ tiene que poder pagar.

### 2.5 QR / Baileys / Worker

**Auditoría completa. NO se tocó código (el código es bueno).** Hallazgos:

| Área | Estado |
|---|---|
| `useMultiFileAuthState` | ✅ Correcto |
| Reconexión automática | ✅ 5s normal, 15s para código 440 (connectionReplaced) |
| Loop prevention | ✅ `manualDisconnectInProgress` + `reconnectTimer` |
| Logout permanente | ✅ `DisconnectReason.loggedOut` no reconecta |
| Heartbeat | ✅ Cada 10s + en cada `connection.update` |
| Disconnect remoto | ✅ Polling cada 2s a `desired_action='disconnect'` |
| JID en respuestas IA | ✅ Usa `remoteJid` directo, rechaza fake senderPn que matchea LID local part (línea 129-134 `handler.ts`) |
| `last_inbound_jid` | ✅ Guardado correctamente vía `getOrCreateConversation({inboundJid: remoteJid})` |
| Outbox JID seleccion | ✅ `getBestOutgoingJidForConversation` separado del path IA, no toca remoteJid live |

**Causa probable nº 1 de inestabilidad de sesiones en prod:** `BAILEYS_AUTH_BASE_PATH` apuntando a un path NO persistente (filesystem efímero del container). Ver sección 4 (ENV).

---

## 3. Riesgos encontrados

### Alto
1. **`BAILEYS_AUTH_BASE_PATH` debe estar en volumen persistente.** Si está en `/tmp`, dentro del container sin volumen, o en cualquier path que el reinicio del worker borra, el usuario debe re-escanear el QR cada vez. En EasyPanel/Coolify: montar un volumen y apuntar la env ahí.
2. **`NEXT_PUBLIC_APP_URL` debe ser la URL real de producción** (ej. `https://app.atende.io`). Si no está, MP enviará webhooks a localhost y los pagos quedarán flotando. Ahora hay un warning loud, pero es responsabilidad operativa setearla.

### Medio
3. **Cache de suscripción de 60s en el worker.** Tras aprobar pago en MP, el worker puede tardar hasta 1 minuto en empezar a responder con IA. Aceptable para MVP, pero si querés que sea instantáneo habría que enviar una señal al worker (Redis pub/sub o columna `subscription_changed_at` + polling) — fuera de scope.
4. **No hay tabla de webhooks procesados** — si MP reenvía el mismo `event_id` 10 veces (lo hace cuando no recibe 200 OK), corremos las mismas updates 10 veces. Hoy es inocuo porque son SETs, pero si en el futuro se agregan operaciones no-idempotentes hay que crear `mp_webhook_events(event_id PK, processed_at)`.

### Bajo
5. **`subscriptions.plan_code` tiene default `'growth'`** (migración 014 lo cambió en su día). El signup setea `plan_code` explícitamente así que no se usa el default, pero está raro que diga `'growth'`. Opcional: migración para cambiar a `'starter'` (no urgente).
6. **`canUseApp` en middleware (Edge)**: descartado deliberadamente. La validación queda en el layout server (`/app/app/layout.tsx`). Trade-off: una request `/app/conversations` con trial vencido carga el componente server, fetcha la subscripción, y luego redirige. El usuario igual ve solo el spinner inicial y va a `/app/plan`.

---

## 4. Variables ENV necesarias (Producción)

### Web (Vercel u otro)
```
NEXT_PUBLIC_SUPABASE_URL        # https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   # eyJ...
SUPABASE_SERVICE_ROLE_KEY       # eyJ... (¡secret!)
NEXT_PUBLIC_APP_URL             # https://app.atende.io  ← CRÍTICO para MP
MERCADOPAGO_ACCESS_TOKEN        # APP_USR-...
MERCADOPAGO_WEBHOOK_SECRET      # secret del panel MP → Webhooks → Configuración
OPENROUTER_API_KEY              # sk-or-v1-...
```

### Worker WhatsApp (VPS / EasyPanel / Coolify)
```
NEXT_PUBLIC_SUPABASE_URL        # mismo que web
SUPABASE_SERVICE_ROLE_KEY       # mismo que web
BUSINESS_ID                     # uuid del negocio
WORKER_INSTANCE_NAME            # 'primary' o 'main' — debe matchear whatsapp_sessions.instance_name
BAILEYS_AUTH_BASE_PATH          # /data/baileys-auth  ← DEBE ser volumen persistente
OPENROUTER_API_KEY              # sk-or-v1-...
```

### En MP Dashboard (https://www.mercadopago.com.ar/developers/panel/app)
- Webhook URL: `https://app.atende.io/api/webhooks/mercadopago`
- Eventos: `payment` y `subscription` (preapproval)
- Webhook secret: el mismo que `MERCADOPAGO_WEBHOOK_SECRET`

---

## 5. Migraciones SQL

**Ninguna obligatoria.** El esquema actual ya soporta todo (status='trial', trial_ends_at, status='active', status='pending_payment', status='past_due', status='canceled').

**Opcional (limpieza cosmética, sin riesgo):**

```sql
-- Migración opcional: alinear el default de plan_code con el nuevo trial Starter.
-- No afecta cuentas existentes; solo cambia el default para nuevos inserts.
ALTER TABLE subscriptions ALTER COLUMN plan_code SET DEFAULT 'starter';
```

---

## 6. Pasos para deploy seguro

1. **Backup de la DB de prod** (`pg_dump` o snapshot de Supabase).
2. **Verificar que `NEXT_PUBLIC_APP_URL`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` están seteadas** en el host del web.
3. **Verificar que `BAILEYS_AUTH_BASE_PATH` apunta a un volumen persistente** en el VPS del worker. Ej. en EasyPanel: agregar mount `/data` → volumen, y dejar la env en `/data/baileys-auth`.
4. **Verificar webhook URL en panel MP** = `https://<NEXT_PUBLIC_APP_URL>/api/webhooks/mercadopago`.
5. Deploy del web (cambios son solo TS/JSX, no rompen al server, no requieren migración).
6. **NO reiniciar el worker** — los cambios no afectan al worker (handler.ts, baileys/client.ts, start-worker.ts intactos).
7. Verificar en logs del web que no salga el warning `[mp/checkout] NEXT_PUBLIC_APP_URL no configurado`.
8. (Opcional) Aplicar la migración cosmética de la sección 5.

**Rollback:** revertir el commit. Cero migración = cero estado en DB que limpiar.

---

## 7. Cómo probar

### A) Signup
1. Ir a `/signup`, crear cuenta nueva.
2. En Supabase (SQL editor):
   ```sql
   SELECT business_id, plan_code, status, trial_started_at, trial_ends_at
   FROM subscriptions
   ORDER BY created_at DESC LIMIT 1;
   ```
   Debe retornar: `plan_code='starter'`, `status='trial'`, `trial_ends_at ≈ now + 14d`.
3. Usuario debe entrar directo a `/app` (dashboard, no a `/app/plan`).
4. Debe poder ir a `/app/connect` y ver QR.

### B) Trial activo (banner)
- En cualquier vista del dashboard menos `/app/plan`, ver el banner verde "Estás usando tu prueba gratuita…" con CTA "Ver planes".

### C) Trial vencido
1. Forzar vencimiento:
   ```sql
   UPDATE subscriptions
   SET trial_ends_at = now() - interval '1 hour',
       updated_at = now()
   WHERE business_id = '<uuid>';
   ```
2. Si el worker está corrido, esperar hasta 60s (TTL cache) o reiniciarlo.
3. Login del usuario → debe ir directo a `/app/plan` (redirect del gate).
4. Intentar ir a `/app/conversations`, `/app/home`, etc. → redirect a `/app/plan`.
5. Enviar un mensaje WhatsApp al número conectado → en logs del worker debe aparecer `[bot] Cuenta bloqueada (trial_expired) — no respondo automáticamente`. El mensaje entrante **sí** se guarda en `conversations`/`messages` (esto es deliberado: no perdemos data).
6. Sesión WhatsApp NO se cierra. Conversaciones intactas. Catálogo intacto.

### D) Pago aprobado (sandbox MP)
1. En `/app/plan`, elegir un plan (Starter/Growth/Pro).
2. Verificar log: `[mp/checkout] preapproval created id=<id>` y `[mp/checkout] checkout_url=https://www.mercadopago.com.ar/subscriptions/...`.
3. Completar pago con tarjeta de test MP.
4. MP envía webhook a `/api/webhooks/mercadopago`. Verificar logs:
   - `[mp/webhook] received`
   - `[mp/webhook] event_type=preapproval event_id=<id>`
   - `[mp/webhook] subscription authorized business=<uuid>`
5. En DB:
   ```sql
   SELECT status, plan_code, paid_at, subscription_started_at, mercado_pago_preapproval_id
   FROM subscriptions WHERE business_id = '<uuid>';
   ```
   Debe estar `status='active'`, `plan_code=<elegido>`, `paid_at=now()`.
6. Worker se desbloquea (hasta 60s por cache). Usuario puede usar dashboard sin redirect.

### E) QR / Conexión / Reconexión worker
1. **QR inicial:** en `/app/connect`, ver QR. Log del worker: `[worker] QR generado — escanea desde el dashboard`. Scanear con WA del celular.
2. **Conectado:** Log: `[worker] Conectado como <phone>`. Status en `whatsapp_sessions.status='connected'`.
3. **Reconexión spontánea** (matar la red del celu unos segundos):
   - Log: `[worker] Conexión cerrada, código: 408` (o similar)
   - Log: `[bot] Reconectando en 5s...`
   - Vuelve a `connected` sin necesidad de QR.
4. **Reinicio del worker** (mientras está conectado):
   - `BAILEYS_AUTH_BASE_PATH` persistente: al reiniciar, conecta solo sin pedir QR.
   - `BAILEYS_AUTH_BASE_PATH` efímero: pide QR nuevo. **Esto es el síntoma de que el volumen no es persistente.**
5. **Disconnect desde dashboard:** botón "Desconectar" → log `[worker] Solicitud de desconexión desde el dashboard` → auth dir borrado → worker re-inicia → nuevo QR. Confirmar `whatsapp_sessions.status='disconnected'` y `desired_action='none'`.
6. **No responder al propio número:** enviar un mensaje desde el mismo número conectado. Log: `[wa/outgoing] conversation_id=<id> source=phone status=saved` (se guarda como mensaje humano, no se responde). Si por algún motivo el JID coincide con el propio, log: `[wa/incoming] prevented reply to own number jid=<jid>`.

### F) Multi-tenant
Ningún cambio afecta el aislamiento por `business_id`. Las queries siguen filtrando por `business_id`. `requireDashboardBusinessContext` sigue resolviendo desde la cookie de sesión.

---

## 8. Resumen de qué NO se rompió

✅ Worker WhatsApp — código intacto.
✅ Baileys — código intacto.
✅ Lógica de QR — código intacto.
✅ Lógica de `remoteJid` y `last_inbound_jid` — código intacto.
✅ Webhook MP firma y verificación — código intacto.
✅ Login/signup — solo se cambió el `TRIAL_PLAN_CODE`, el resto del flujo idéntico.
✅ Multi-tenant — código intacto.
✅ Conversaciones, contactos, mensajes — código intacto.
✅ Envío de mensajes (outbox processor) — código intacto.
