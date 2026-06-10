# Roadmap Mobile de Atendé

Estado al 9-jun-2026. Estrategia: **PWA primero, Capacitor después**.

## ✅ Ya implementado

- Manifest PWA (`src/app/manifest.ts`) + íconos 192/512/maskable/apple-touch.
- Service worker (`public/sw.js`): instalabilidad, fallback offline, handlers
  de `push` y `notificationclick` listos (deep link incluido).
- **Conexión por código de vinculación** además del QR: el usuario puede
  conectar WhatsApp DESDE EL MISMO CELULAR (pestaña "Con código" en Conectar).
- Deep link a conversación: `/app/conversations?c=<conversationId>`.
- Responder desde el celular: ya funciona (chat full-screen, endpoint seguro
  con outbox + JID correcto + auto-cambio a modo humano + bloqueo por trial
  vencido y por email no verificado).
- Sesión persistente 7 días (cookie httpOnly), logout en mobile (Más).

## 📲 Cómo instalar hoy (PWA)

Android/Chrome: abrir el dominio → menú ⋮ → "Agregar a pantalla de inicio".
iOS/Safari: botón compartir → "Agregar a inicio". Abre standalone, sin barra
de navegador.

## 🔔 FASE SIGUIENTE — Web Push (diseño listo, ~1 sesión de trabajo)

1. **Claves VAPID**: `npx web-push generate-vapid-keys` → env
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (Vercel) + `VAPID_PRIVATE_KEY` (Vercel y VPS
   del worker).
2. **Dependencia**: `web-push` (solo en worker/API, liviana).
3. **Migración** `028_push_subscriptions.sql`:
   ```sql
   create table push_subscriptions (
     id uuid primary key default gen_random_uuid(),
     business_id uuid not null references businesses(id) on delete cascade,
     user_id uuid not null,
     endpoint text not null unique,
     keys jsonb not null,          -- {p256dh, auth}
     created_at timestamptz default now()
   );
   ```
4. **API** `POST /api/push/subscribe` (sesión requerida): guarda la
   subscription del navegador. `DELETE` para revocar al hacer logout.
5. **Cliente**: tras login en mobile, pedir permiso →
   `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
   → POST a subscribe. UI: card en Más → "Notificaciones".
6. **Worker** (`handler.ts`, después de `insertMessage(convo.id, "user", ...)`):
   buscar subscriptions del business → `webpush.sendNotification` con payload
   `{ title: "Nuevo mensaje de {nombre}", body: texto recortado, url: "/app/conversations?c={id}", tag: convo.id }`.
   - Solo mensajes ENTRANTES (role user). Nunca los del negocio.
   - `tag` por conversación = las notificaciones se agrupan, sin spam.
   - Borrar subscriptions con error 404/410 (expiradas).
7. **Limitación iOS**: Web Push en iOS requiere iOS 16.4+ y que la PWA esté
   instalada en pantalla de inicio. En Android funciona siempre.

## 📦 FASE POSTERIOR — Capacitor (Play Store / App Store)

- Modo recomendado: **cargar la URL remota de Vercel** (`server.url` en
  `capacitor.config.ts`) — sin build estático, el deploy web actualiza la app.
- Pasos: `npm i @capacitor/core @capacitor/cli && npx cap init Atende
  com.atende.app && npx cap add android` (iOS requiere Mac + cuenta Apple).
- **Trabas conocidas a resolver antes de publicar**:
  1. *Mercado Pago en WebView*: el checkout debe abrirse en browser externo
     (`@capacitor/browser`), no en el WebView — política de MP y de las stores.
  2. *Push nativo*: reemplazar Web Push por FCM (Android) / APNs (iOS) vía
     `@capacitor/push-notifications`; la tabla push_subscriptions se reutiliza
     con un campo `platform`.
  3. *App Store review*: Apple rechaza apps que son "solo una web". Mitigación:
     push nativo + deep links + algún capability nativo (compartir, biometría
     para login). Play Store es laxo (TWA/WebView aceptado).
  4. *Cookies de sesión* en WebView remoto: funcionan (mismo dominio), pero
     probar logout/login en frío.

## Pruebas E2E pendientes (requieren deploy + dispositivo)

- Instalar PWA en Android y iOS → abrir desde home → login persistente.
- Conectar por código desde el MISMO celular del negocio (flujo completo).
- Conectar por QR desde desktop (no debe haber regresión).
- Responder desde el celular → llega al cliente → queda como "vos" en el hilo.
