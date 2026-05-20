# Agente WhatsApp — Arquitectura híbrida comercial

Landing pública + dashboard privado en **Next.js/Vercel**, base de datos y auth en **Supabase**, y worker Baileys persistente en **VPS/EasyPanel/Coolify**.

```
┌──────────────┐     polling     ┌──────────────────┐
│   Browser    │ ──────────────► │  Vercel (Next.js) │
└──────────────┘                 └────────┬─────────┘
                                          │ Supabase JS
                                 ┌────────▼─────────┐
                                 │     Supabase      │
                                 │    (Postgres)     │
                                 └────────▲─────────┘
                                          │ Supabase JS
                                 ┌────────┴─────────┐
                                 │  Worker (VPS)     │
                                 │  Baileys 24/7     │
                                 └──────────────────┘
```

**Baileys NO corre en Vercel.** Vercel es serverless — no soporta procesos long-running.
Baileys vive en un VPS o servicio de containers con proceso persistente.

---

## Puesta en marcha comercial (en orden)

### Paso 1 — Crear proyecto en Supabase

1. Ir a https://supabase.com/dashboard y crear un nuevo proyecto.
2. Guardar la URL y las claves de API (las vas a necesitar en el paso 3).

### Paso 2 — Aplicar el schema SQL

1. En Supabase: **SQL Editor → New query**.
2. Copiar y pegar el contenido de `supabase/schema.sql`.
3. Hacer clic en **Run**.
4. Verificar que se crearon las tablas (sin errores).

### Paso 3 — Configurar variables de entorno locales

Editar `.env.local` con los valores reales:

```bash
# Supabase (Dashboard → Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini

# Landing / app web
NEXT_PUBLIC_DEMO_WHATSAPP_URL=https://wa.me/5491100000000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_WEBHOOK_SECRET=...

# Worker
BUSINESS_ID=uuid-del-negocio-para-el-worker
WORKER_INSTANCE_NAME=main
WHATSAPP_PROVIDER=baileys
BAILEYS_AUTH_BASE_PATH=./auth

# Bootstrap comercial
OWNER_EMAIL=owner@tu-negocio.com
OWNER_PASSWORD=una-contraseña-segura
BUSINESS_NAME=Mi Negocio
BUSINESS_SLUG=mi-negocio
```

### Paso 4 — Crear el primer usuario dueño y su negocio

```bash
npm run bootstrap:owner
```

Este script:
- crea o actualiza el usuario en `auth.users`
- crea o actualiza `profiles`
- crea o busca el negocio por `BUSINESS_SLUG`
- vincula el usuario como `owner` en `business_members`
- crea la `subscription` inicial en plan `pro`
- crea la fila de `whatsapp_sessions`
- imprime `user_id`, `business_id`, email y URL de login

Después de correrlo, copiá el `business_id` impreso y usalo como `BUSINESS_ID` del worker.

### Paso 5 — Instalar dependencias

```bash
npm install
```

### Paso 6 — Probar localmente

En dos terminales separadas:

```bash
# Terminal 1 — worker Baileys
npm run dev:worker

# Terminal 2 — dashboard Next.js
npm run dev
```

Abrir http://localhost:3000, iniciar sesión con las credenciales configuradas.
La landing pública vive en `/`, el login en `/login` y el dashboard en `/app`.
El QR aparece dentro de `/app/connect`.

---

## Deploy en producción

### Dashboard → Vercel

1. Crear proyecto en Vercel apuntando a este repo.
2. Agregar las variables de entorno (las mismas que `.env.local`, sin las de desarrollo).
3. Vercel detecta Next.js y hace el build automáticamente.
4. Verificar que `/api/connection/status` responde sin errores.

### Variables necesarias en Vercel

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
OPENAI_MODEL
NEXT_PUBLIC_DEMO_WHATSAPP_URL
NEXT_PUBLIC_APP_URL
WHATSAPP_PROVIDER=baileys
```

**No agregar** `BAILEYS_AUTH_BASE_PATH` en Vercel — el filesystem de Vercel no es persistente.

### Worker → VPS / EasyPanel / Coolify / Railway

El worker es el proceso que corre Baileys. Necesita:
- Un proceso **persistente** (no serverless).
- Un **volumen persistente** para la carpeta de auth de Baileys.

#### Opción A: EasyPanel / Coolify (recomendado)

1. Crear un nuevo servicio en EasyPanel/Coolify apuntando al mismo repo.
2. En la configuración del servicio, usar `nixpacks-worker.toml` como archivo de config.
3. Agregar las variables de entorno (las mismas del dashboard + `BAILEYS_AUTH_BASE_PATH`).
4. Crear un volumen persistente en `/data/baileys-auth`.
5. Setear `BAILEYS_AUTH_BASE_PATH=/data/baileys-auth`.
6. Deploy.

#### Opción B: VPS con Node.js

```bash
# Clonar el repo
git clone <repo-url> agente-whatsapp
cd agente-whatsapp

# Instalar dependencias
npm ci --include=dev

# Crear .env.local con las variables correctas

# Crear directorio de auth persistente
mkdir -p /data/baileys-auth

# Correr el worker (usar pm2 o similar para mantenerlo vivo)
pm2 start "npm run start:worker" --name agente-whatsapp-worker
pm2 save
```

#### Worker 24/7 con PM2 (recomendado)

Este repo ya incluye `ecosystem.worker.config.cjs` para dejar el worker siempre activo.

```bash
# 1) Instalar PM2 global (una sola vez)
npm i -g pm2

# 2) Crear archivo de entorno del worker
cp .env.worker.example .env.worker
# Editar .env.worker con valores reales (incluyendo BUSINESS_ID)

# 3) Iniciar worker administrado por PM2
cd /home/claw/whatsapp-agente
npm run pm2:worker:start

# 4) Ver estado y logs
npm run pm2:worker:status
npm run pm2:worker:logs

# 5) Guardar procesos para persistir reinicios del sistema
npm run pm2:worker:save
pm2 startup
```

`pm2 startup` te va a devolver un comando final con `sudo ...`. Ejecutalo tal cual para habilitar auto-arranque al reiniciar el servidor.

Comandos útiles:

```bash
npm run pm2:worker:restart
npm run pm2:worker:stop
npm run pm2:worker:delete
```

### Variables de entorno que necesita el worker

```bash
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
OPENAI_MODEL
BUSINESS_ID
WORKER_INSTANCE_NAME
WHATSAPP_PROVIDER=baileys
BAILEYS_AUTH_BASE_PATH=/data/baileys-auth
```

**No necesita** `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OWNER_EMAIL`, `OWNER_PASSWORD`, `NEXT_PUBLIC_DEMO_WHATSAPP_URL` ni `NEXT_PUBLIC_APP_URL`.

---

## Bootstrap comercial completo

### 1. Aplicar el schema

En Supabase → SQL Editor:

1. Ejecutar `supabase/schema.sql` en un proyecto nuevo.
2. Si el proyecto ya existía, aplicar también `supabase/migrations/006_commercial_app.sql`.

### 2. Crear el primer usuario dueño

Definir estas variables en `.env.local`:

```bash
OWNER_EMAIL=owner@tu-negocio.com
OWNER_PASSWORD=una-contraseña-segura
BUSINESS_NAME=Mi Negocio
BUSINESS_SLUG=mi-negocio
```

Luego correr:

```bash
npm run bootstrap:owner
```

El script es idempotente. Si lo corrés dos veces:
- no duplica el usuario
- no duplica el negocio
- no duplica la membresía
- no duplica la suscripción

## Trial, planes y Mercado Pago

- Las cuentas nuevas creadas desde `/signup` empiezan en `plan_code=growth`, `status=trial`, con 14 días de prueba.
- El plan pago solo se activa desde webhooks de Mercado Pago (`preapproval` autorizado o `payment` aprobado).
- Si el trial vence sin suscripción autorizada, `checkAccountAccess` bloquea APIs críticas y el worker no responde automáticamente.
- Aplicar `supabase/migrations/014_trial_recurrent_billing.sql` en proyectos existentes antes de deployar este flujo.
- Configurar el webhook de Mercado Pago hacia `NEXT_PUBLIC_APP_URL/api/webhooks/mercadopago` y guardar el secret en `MERCADOPAGO_WEBHOOK_SECRET`.

### 3. Asignar `BUSINESS_ID` al worker

Tomá el `business_id` que imprime `bootstrap:owner` y configurá:

```bash
BUSINESS_ID=el-business-id-impreso
```

Ese valor se usa solo en el worker Baileys por ahora.

---

## Estructura del proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── auth/login/        ← login con Supabase Auth
│   │   ├── auth/logout/       ← logout dashboard
│   │   ├── business/          ← perfil del negocio
│   │   ├── connection/
│   │   │   ├── status/        ← estado WhatsApp + QR PNG
│   │   │   └── disconnect/    ← desconectar sesión
│   │   ├── plan/              ← plan actual y uso mensual
│   │   ├── conversations/     ← lista + borrar
│   │   ├── messages/[id]/     ← historial + enviar (modo humano)
│   │   ├── mode/[id]/         ← cambiar AI/HUMAN
│   │   └── worker/status/     ← estado del worker (online, lastSeen)
│   ├── app/                   ← dashboard privado en /app
│   ├── login/                 ← página de login
│   └── page.tsx               ← landing pública
├── components/                ← UI React
└── lib/
    ├── data-access.ts         ← ÚNICA fuente de acceso a datos (Supabase)
    ├── db.ts                  ← re-exports de data-access.ts
    ├── supabase.ts            ← cliente Supabase (service role, server-side)
    ├── env.ts                 ← lectura de variables de entorno
    ├── app-session.ts         ← sesión httpOnly firmada para la app web
    ├── dashboard-auth.ts      ← resolver user + business_id
    ├── openai.ts / openrouter.ts
    ├── whatsapp/              ← interfaz de provider y provider Baileys
    └── baileys/
        ├── client.ts          ← conexión Baileys (solo corre en worker)
        └── handler.ts         ← procesamiento de mensajes entrantes
scripts/
├── env-loader.ts              ← carga .env.local en procesos non-Next
├── bootstrap-commercial-owner.ts ← crea owner + negocio + membership + subscription
├── start-worker.ts            ← entry point del worker Baileys
└── start-bot.ts               ← alias de start-worker.ts
supabase/
├── schema.sql                 ← DDL completo, ejecutar en Supabase SQL Editor
└── migrations/006_commercial_app.sql
```

---

## Cómo funciona el QR

```
1. Worker arranca → Baileys intenta conectar con sesión guardada
2. Si no hay sesión: genera QR → escribe qr_string en whatsapp_sessions
3. Dashboard polling /api/connection/status → lee qr_string de Supabase
4. Dashboard genera imagen PNG del QR y la muestra
5. Usuario escanea con el teléfono
6. WhatsApp confirma → Worker recibe "connection: open"
7. Worker actualiza status = 'connected' + phone en whatsapp_sessions
8. Dashboard ve status = 'connected' → transiciona al panel de conversaciones
```

---

## Cómo funciona el modo Humano (outbox)

Dashboard y worker son procesos separados → no comparten memoria.

```
1. Usuario escribe mensaje en dashboard (modo HUMAN)
2. POST /api/messages/[id] → inserta en messages + outbox_messages (sent=false)
3. Worker tiene setInterval cada 2s → lee outbox_messages WHERE sent=false
4. Worker envía por WhatsApp → marca sent=true en outbox_messages
```

---

## FAQ

**¿Por qué Baileys no puede correr en Vercel?**
Vercel es serverless: cada request es un proceso nuevo que termina. Baileys necesita
mantener una conexión WebSocket abierta 24/7 con los servidores de WhatsApp Web.

**¿Qué pasa si el worker se cae?**
El bot deja de responder. El dashboard sigue funcionando pero muestra
`workerOnline: false` en `/api/worker/status`. Los mensajes no se responden ni
se procesan hasta que el worker vuelve a conectarse.

**¿Cómo creo el primer acceso comercial?**
Ejecutando `supabase/schema.sql`, luego `npm run bootstrap:owner` con `OWNER_EMAIL`, `OWNER_PASSWORD`, `BUSINESS_NAME` y `BUSINESS_SLUG`.

**¿Cómo cambio el prompt de la IA?**
Desde el dashboard → Mi Negocio. Los cambios se guardan en Supabase y
el worker los lee en cada respuesta (sin reiniciar).

**¿Cómo agrego múltiples negocios?**
El schema ya tiene `business_id` en todas las tablas. Para la v2 multi-tenant:
crear múltiples filas en `businesses`, asignar un `BUSINESS_ID` diferente por
instancia de worker.
