# Agente WhatsApp híbrido

Dashboard `Next.js` para `Vercel` + base en `Supabase` + worker persistente `Baileys` para WhatsApp Web.

## Arquitectura

- `Vercel`: dashboard, login, API routes, conversaciones, Mi Negocio.
- `Supabase`: datos de negocio, catálogo, conversaciones, mensajes, suscripción, uso, estado de WhatsApp y outbox.
- `Worker persistente`: proceso Node separado que corre `Baileys`, escucha mensajes, llama a `OpenRouter` y envía respuestas.

`Baileys` no corre en `Vercel`, no usa cron y no usa Edge Functions.

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4o-mini
BUSINESS_ID=
WORKER_INSTANCE_NAME=primary
DASHBOARD_USER=admin
DASHBOARD_PASSWORD=
BAILEYS_AUTH_BASE_PATH=/data/baileys-auth
```

## Schema de Supabase

El schema base está en [supabase/schema.sql](/Users/roque/Desktop/Paginas%20%26%20app/whatsapp-agente/whatsapp-agente/supabase/schema.sql).

Aplicarlo desde el SQL Editor de Supabase antes del primer deploy.

## Desarrollo local

```bash
npm install
npm run dev
```

En otra terminal:

```bash
npm run start:worker
```

Abrir `http://localhost:3000`, iniciar sesión y escanear el QR.

## Backfill desde SQLite

Si vienes de la versión local con `SQLite`, primero deja cargado el schema en Supabase y luego ejecuta:

```bash
npm run backfill:sqlite
```

El script lee `data/messages.db`, migra:

- perfil del negocio
- productos
- conversaciones
- mensajes
- outbox pendiente
- estado inicial de la sesión

No migra `auth/`. Después del deploy del worker cloud hay que volver a escanear el QR una vez.

## Deploy del dashboard en Vercel

1. Crear proyecto en `Vercel` apuntando a este repo.
2. Cargar las variables de entorno del dashboard.
3. Deployar el dashboard con `next build` y `next start`.
4. Confirmar que las rutas `/api/*` responden sin depender de filesystem local.

## Deploy del worker persistente

Despliega el mismo repo como servicio separado en `VPS`, `EasyPanel`, `Coolify` o `Railway`.

Comando:

```bash
npm run start:worker
```

Requisitos:

- usar las mismas variables de entorno que el dashboard
- montar un volumen persistente en la ruta configurada en `BAILEYS_AUTH_BASE_PATH`
- mantener `BUSINESS_ID` y `WORKER_INSTANCE_NAME` iguales entre dashboard y worker

Archivos útiles:

- `nixpacks.toml`: build/start del dashboard
- `nixpacks.worker.toml`: start del worker

## Comportamiento actual

- `Mi Negocio` ya persiste en `Supabase`.
- conversaciones, mensajes, modos `IA/Humano`, outbox y estado de conexión ya salen de `Supabase`.
- el worker actualiza `whatsapp_sessions` con `QR`, estado, heartbeat y teléfono conectado.
- el botón de desconexión ya no toca disco en el dashboard; deja una orden persistida para que el worker haga logout.

## Validación local

Checks ejecutados sobre esta migración:

- `npx tsc --noEmit`
- `npm run build`
