# Auditoría técnica y de seguridad — Atende / Agente WhatsApp

Fecha: 2026-06-02 · Criterio: lanzamiento comercial. Primero estabilidad, después features.

## Resumen ejecutivo

La app tiene una **base de seguridad mayormente buena** a nivel aplicación: sesión firmada httpOnly, `business_id` resuelto siempre desde la sesión (nunca del frontend), permisos de equipo validados por rol y por negocio, webhook de Mercado Pago con verificación de firma, y secretos bien manejados (nada commiteado, nada logueado). **Pero hay un hueco crítico a nivel base de datos: las tablas de Supabase NO tienen RLS habilitado.** Hoy el modelo depende 100% de que la capa API sea la única puerta; si la anon key se expone (es pública por diseño), se cae toda la separación multi-tenant. Eso hay que cerrarlo antes de vender.

---

## 1) Riesgos CRÍTICOS

### C1 — Supabase sin Row Level Security (RLS) en ninguna tabla
- **Hallazgo:** 0 policies y 0 `enable row level security` en `supabase/schema.sql` y migraciones. Las tablas (`businesses`, `conversations`, `messages`, `subscriptions`, `whatsapp_sessions`, `outbox_messages`, etc.) quedan accesibles para los roles `anon`/`authenticated` vía la API REST de Supabase.
- **Impacto:** si la anon key (que es **pública por diseño**) se usa en el front, se filtra o alguien la obtiene, un atacante podría **leer y modificar datos de todos los negocios** (conversaciones, clientes, suscripciones) salteándose toda la autorización de la app. Hoy la anon key NO está en el bundle del cliente (solo se usa server-side para login), lo que reduce la exposición inmediata — pero la seguridad no debe depender de mantener "secreta" una clave que el modelo de Supabase asume pública.
- **Estado:** ✅ **APLICADO Y VERIFICADO EN PRODUCCIÓN** (migración `supabase/migrations/025_enable_rls_all_tables.sql`, corrida en Supabase el 2026-06-02). Verificación en vivo:
  - Como rol `anon`: `businesses=0, conversations=0, messages=0` → **bloqueado** (cuando en realidad hay 12 / 9 / 187).
  - Como rol `service_role` (el que usa la app): `businesses=12, conversations=9, messages=187` → **sigue viendo todo** (bypass de RLS). La app y el worker funcionan igual.
  - `select tablename from pg_tables where schemaname='public' and rowsecurity=false;` → 0 filas (todas con RLS).

---

## 2) Riesgos MEDIOS

### M1 — Secreto de sesión inconsistente entre app y middleware *(corregido)*
- `lib/app-session.ts` firmaba con `APP_SESSION_SECRET ?? SUPABASE_SERVICE_ROLE_KEY`, pero `middleware.ts` verificaba **solo** con `SUPABASE_SERVICE_ROLE_KEY`. El propio `.env.example` recomienda setear `APP_SESSION_SECRET` → si lo hacían, el middleware rechazaba **todas** las sesiones (caída total del acceso).
- **Estado:** **corregido** — el middleware ahora resuelve el secreto igual que la app. Recomendación: setear un `APP_SESSION_SECRET` dedicado (largo y aleatorio) en Vercel, así la firma de sesión deja de depender del service role key.

### M2 — Falta rate limit en endpoints sensibles / de costo
- Solo `auth/login` tiene rate limit (5/min/IP, en memoria). **Sin límite**: `auth/signup` (alta masiva de cuentas/negocios), `billing/create-checkout` (crea preapprovals en MP), `messages/[id]` POST (encola outbox), y `assistant/test` (consume OpenAI → costo directo).
- **Impacto:** abuso, costos de IA, ruido en MP, creación masiva de cuentas.
- **Recomendación (no aplicado aún):** rate limit por usuario/negocio. En Vercel serverless el límite en memoria es por instancia (débil); lo correcto es un store compartido (Upstash Redis o una tabla en Supabase con ventana de tiempo). Queda como propuesta porque hacerlo bien excede un cambio puntual.

### M3 — PII en logs del worker
- El handler loguea `remoteJid`, `participant` y teléfonos derivados (`[wa/incoming] derivedPhone=...`). Son logs del operador (no públicos), pero para un producto comercial que maneja datos de clientes, conviene reducir/enmascarar PII en producción (ej. `LOG_LEVEL` y truncar números). No expone secretos.

### M4 — Signup sin verificación de email
- `auth/signup` crea el usuario con `email_confirm: true` (sin verificación). Permite registrarse con emails ajenos y abre la puerta a abuso de trials. Aceptable para MVP, pero recomendado agregar verificación o al menos rate limit (ver M2) antes de escalar.

---

## 3) Riesgos BAJOS

- **B1 — Token de sesión legible (no cifrado):** el payload (user id + email) es base64 firmado, no cifrado. Es httpOnly, así que JS no lo lee; el contenido no es secreto. Aceptable; si se quiere, migrar a JWE/cifrado.
- **B2 — QR en logs del worker:** `client.ts` imprime el QR como ASCII en el log del worker (operador). No es público, pero idealmente desactivarlo en prod.
- **B3 — Sesión sin rotación/refresh:** TTL fijo de 7 días, sin rotación. Estándar y aceptable.
- **B4 — CSRF:** no hay tokens CSRF, pero la cookie es `sameSite=lax`, que mitiga CSRF en POST cross-site. Suficiente para el modelo actual.

---

## 4) Qué está BIEN implementado

- **Sesión:** cookie httpOnly, `secure` en producción, `sameSite=lax`, HMAC-SHA256 con `timingSafeEqual`, expiración validada. Sin datos sensibles en localStorage (solo la preferencia de tema).
- **Multi-tenant:** el `business_id` se resuelve **siempre desde la sesión** (`requireDashboardBusinessContext`) contra `business_members`; nunca se confía en el frontend. Todas las queries de datos filtran por `business_id`.
- **Permisos de equipo:** `assertCanManageTeam(role)` bloquea por rol; lookups scopeados por `business_id`; admin no puede tocar owners; no se puede dejar el negocio sin owner. Sin escalada cross-negocio.
- **APIs:** protegidas por middleware (401 a `/api` sin sesión) + wrappers `withDashboardBusinessContext` / `withActiveDashboardBusinessContext`. Errores genéricos al usuario (sin stack traces); inputs validados/normalizados.
- **Service role:** solo server-side; nunca referenciado en componentes cliente. Anon key tampoco está en el bundle del cliente.
- **Mercado Pago:** webhook con verificación de firma HMAC (`timingSafeEqual`), **falla cerrado** si no hay secreto, y el plan se activa **solo** con `preapproval authorized` / `payment approved`. No se puede activar plan desde el frontend. Upgrade validado con `canUpgradeTo`.
- **Trial / límites:** alta nueva → trial 14 días con capacidades **Growth**; `checkAccountAccess` bloquea uso operativo al vencer; el **worker no responde** si la cuenta no tiene acceso (validado en backend, no solo front). No se borran datos al vencer/cancelar.
- **Worker / Baileys:** auth por negocio en `BAILEYS_AUTH_BASE_PATH/<business_id>/<instance>` (carpetas separadas, sin mezcla); responde solo a negocios con acceso; lógica de JID intacta (responde al `remoteJid` real, respeta `last_inbound_jid`, rechaza `@lid` como número). **No se tocó.**
- **Prompt injection:** `openrouter.ts` separa claramente system / contexto de negocio / mensaje del cliente, sanitiza los campos del negocio (`sanitizeForPrompt`), limita longitudes, e instruye a no revelar instrucciones internas. El contexto se arma **solo con datos del propio negocio** → un cliente no puede extraer datos de otro negocio.
- **Secretos:** nada commiteado (`.gitignore` cubre `.env*`, `/auth/`, `/data/`, `*.log`); ningún `console.log` imprime valores de secretos, QR string, cookies ni tokens (solo nombres de variables).

---

## 5) Qué corregir ANTES de vender

1. ~~Aplicar la migración de RLS~~ ✅ **HECHO Y VERIFICADO** en Supabase.
2. **Deploy** (commit + push → Vercel) para que tomen efecto: fix del middleware (M1), headers de seguridad y rate limits (ya en código).
3. **Setear `APP_SESSION_SECRET`** dedicado en Vercel (largo y aleatorio) tras el deploy del middleware.
4. Confirmar en Supabase/Vercel que `MERCADOPAGO_WEBHOOK_SECRET` está configurado (si no, el webhook rechaza todo y no se activan pagos).

## 6) Qué puede quedar para después

- Rate limit con store compartido (M2).
- Verificación de email en signup (M4).
- Reducir PII en logs del worker (M3) y apagar QR en logs de prod (B2).
- Cifrado del token de sesión (B1) y rotación (B3).
- Pairing code (ver sección 7).

---

## 7) Pairing code — ¿viable con la versión actual de Baileys?

**Sí, es viable.** La versión instalada es **@whiskeysockets/baileys 6.7.22**, que expone `sock.requestPairingCode(phoneNumber, customPairingCode?)`. Permite conectar por **código de 8 dígitos** sin QR — ideal para conectar desde el mismo celular.

**Recomendación:** implementarlo en V2 **detrás de la feature flag `ENABLE_WHATSAPP_PAIRING_CODE`**, manteniendo el QR como método principal/fallback. Requiere:
- Llamar `requestPairingCode` en el **worker** (antes de registrarse), no en Vercel.
- Un canal dashboard→worker (acción `request_pairing` + `pairing_phone` en `whatsapp_sessions`, reutilizando el patrón de `desired_action`).
- **Rate limit** por negocio (p. ej. 3 códigos / 15 min), validar sesión + permisos + `business_id`, normalizar el número (formato internacional sin símbolos), **no loguear el código**, no guardarlo más de lo necesario.
- Manejo de errores (rate limit de WhatsApp, código inválido, sesión existente) con fallback claro a QR.

Detalle técnico completo en `PROPUESTA_PAIRING_CODE_V2.md`. **No implementado** en esta pasada porque toca la zona sensible del worker y amerita su propia ventana de pruebas (la consigna pide estabilidad primero).

> Nota: en mobile ya se entregó (sesión anterior) la experiencia "conectá desde otra pantalla" + copiar/enviar link, que resuelve el problema del QR en el celular sin riesgo. El pairing code es la mejora natural sobre eso.

---

## 8) Cambios aplicados en esta pasada

1. **RLS habilitado en todas las tablas** (C1) — migración `025_enable_rls_all_tables.sql` **corrida y verificada en producción**.
2. `src/middleware.ts` — resolución de secreto de sesión consistente con `app-session.ts` (M1). **Aplicado** (pendiente deploy).
3. `next.config.ts` — **headers de seguridad** (X-Content-Type-Options, X-Frame-Options SAMEORIGIN, Referrer-Policy, Permissions-Policy). **Aplicado** (pendiente deploy).
4. **Rate limit** (helper `src/lib/rate-limit.ts`) en `auth/signup` (por IP), `billing/create-checkout` y `assistant/test` (por negocio) — M2 parcial. **Aplicado** (pendiente deploy). Nota: en serverless el límite es por instancia; para algo robusto, store compartido (queda recomendado).

Nada de esto toca WhatsApp/worker/Baileys/JID/outbox/Mercado Pago/login/trial/multi-tenant. Verificado con `tsc --noEmit` (0 errores) y `next lint` (sin issues nuevos).

## 9) Archivos tocados

- `supabase/migrations/025_enable_rls_all_tables.sql` (nuevo, **aplicado en Supabase**).
- `src/middleware.ts` (fix de secreto).
- `next.config.ts` (headers de seguridad).
- `src/lib/rate-limit.ts` (nuevo helper).
- `src/app/api/auth/signup/route.ts`, `src/app/api/billing/create-checkout/route.ts`, `src/app/api/assistant/test/route.ts` (rate limit).
- `AUDITORIA_SEGURIDAD.md` (este informe).

## 10) Pruebas

- **Hechas:** `tsc --noEmit` → 0 errores; `next lint` → sin issues nuevos. Revisión manual de todas las rutas en `src/app/api` (auth, business, connection, plan, conversations, messages, mode, worker/status, team/*, webhooks/mercadopago, billing, apply-template, items).
- **Recomendadas antes de vender:**
  - `npm run build` (deploy).
  - Acceso sin sesión a APIs privadas → debe dar 401 (middleware).
  - Usuario A no puede ver/editar datos del negocio de B (con RLS activo, verificar también que la anon key no devuelva filas).
  - Login / signup / logout / dashboard privado.
  - `/app/connect` (QR) en desktop y mobile; estado de conexión actualiza.
  - Envío en modo humano; cambio IA/humano.
  - Trial vencido bloquea uso; plan activo habilita.
  - Webhook MP con firma inválida → 401; con evento aprobado (mock) → activa plan.
  - Verificar que no se imprimen secretos en logs (worker + dashboard).

### Migraciones — cómo aplicar la de RLS

1. Supabase → SQL Editor → New query → pegar `supabase/migrations/025_enable_rls_all_tables.sql` → Run.
2. Verificar (no debe devolver filas):
   ```sql
   select tablename from pg_tables
   where schemaname='public' and rowsecurity=false;
   ```
3. Probar la app inmediatamente: login, dashboard, conversaciones, enviar en modo humano. Como el service role hace bypass de RLS, **todo debe seguir funcionando igual**.
4. Si algo fallara (no debería), revertir con `alter table public.<tabla> disable row level security;`.
