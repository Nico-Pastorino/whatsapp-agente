# Agente WhatsApp — Arquitectura híbrida

Dashboard en **Vercel** + base de datos en **Supabase** + worker Baileys en **VPS/EasyPanel/Coolify**.

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

## Pasos para poner en marcha (en orden)

### Paso 1 — Crear proyecto en Supabase

1. Ir a https://supabase.com/dashboard y crear un nuevo proyecto.
2. Guardar la URL y las claves de API (las vas a necesitar en el paso 3).

### Paso 2 — Aplicar el schema SQL

1. En Supabase: **SQL Editor → New query**.
2. Copiar y pegar el contenido de `supabase/schema.sql`.
3. Hacer clic en **Run**.
4. Verificar que se crearon las tablas (sin errores).

### Paso 3 — Configurar variables de entorno

Editar `.env.local` con los valores reales:

```bash
# Supabase (Dashboard → Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenRouter (https://openrouter.ai/keys)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4o-mini

# Dejar vacío por ahora — lo llena el bootstrap
BUSINESS_ID=

# Worker (dejar como está para desarrollo local)
WORKER_INSTANCE_NAME=main
BAILEYS_AUTH_BASE_PATH=./auth

# Dashboard (tu usuario y contraseña para el login)
DASHBOARD_USER=admin
DASHBOARD_PASSWORD=tu_contraseña_aqui
```

### Paso 4 — Bootstrap inicial

```bash
npm run bootstrap:supabase
```

Este script:
- Crea el negocio inicial en Supabase.
- Genera un `BUSINESS_ID` y lo agrega a `.env.local` automáticamente.
- Crea la fila en `whatsapp_sessions`.
- Crea la suscripción inicial (plan: starter).

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

El dashboard muestra el QR generado por el worker.
Escanear desde WhatsApp → Dispositivos vinculados → Vincular dispositivo.

---

## Deploy en producción

### Dashboard → Vercel

1. Crear proyecto en Vercel apuntando a este repo.
2. Agregar las variables de entorno (las mismas que `.env.local`, sin las de desarrollo).
3. Vercel detecta Next.js y hace el build automáticamente.
4. Verificar que `/api/connection/status` responde sin errores.

Variables necesarias en Vercel:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY
OPENROUTER_MODEL
BUSINESS_ID
WORKER_INSTANCE_NAME
DASHBOARD_USER
DASHBOARD_PASSWORD
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

Variables de entorno que necesita el worker:
```
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY
OPENROUTER_MODEL
BUSINESS_ID
WORKER_INSTANCE_NAME
BAILEYS_AUTH_BASE_PATH=/data/baileys-auth
```

**No necesita** `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DASHBOARD_USER` ni `DASHBOARD_PASSWORD`.

---

## Estructura del proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── auth/login/        ← login dashboard
│   │   ├── auth/logout/       ← logout dashboard
│   │   ├── business/          ← perfil del negocio
│   │   ├── connection/
│   │   │   ├── status/        ← estado WhatsApp + QR PNG
│   │   │   └── disconnect/    ← desconectar sesión
│   │   ├── conversations/     ← lista + borrar
│   │   ├── messages/[id]/     ← historial + enviar (modo humano)
│   │   ├── mode/[id]/         ← cambiar AI/HUMAN
│   │   └── worker/status/     ← estado del worker (online, lastSeen)
│   ├── login/                 ← página de login
│   └── page.tsx               ← dashboard principal
├── components/                ← UI React
└── lib/
    ├── data-access.ts         ← ÚNICA fuente de acceso a datos (Supabase)
    ├── db.ts                  ← re-exports de data-access.ts
    ├── supabase.ts            ← cliente Supabase (service role, server-side)
    ├── env.ts                 ← lectura de variables de entorno
    ├── auth.ts                ← HMAC session token
    ├── openrouter.ts          ← llamadas al LLM
    ├── system-prompt.ts       ← prompt base de fallback
    └── baileys/
        ├── client.ts          ← conexión Baileys (solo corre en worker)
        └── handler.ts         ← procesamiento de mensajes entrantes
scripts/
├── env-loader.ts              ← carga .env.local en procesos non-Next
├── bootstrap-supabase.ts      ← setup inicial de datos en Supabase
├── start-worker.ts            ← entry point del worker Baileys
└── start-bot.ts               ← alias de start-worker.ts
supabase/
└── schema.sql                 ← DDL completo, ejecutar en Supabase SQL Editor
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

**¿Cómo cambio el prompt de la IA?**
Desde el dashboard → Mi Negocio. Los cambios se guardan en Supabase y
el worker los lee en cada respuesta (sin reiniciar).

**¿Cómo agrego múltiples negocios?**
El schema ya tiene `business_id` en todas las tablas. Para la v2 multi-tenant:
crear múltiples filas en `businesses`, asignar un `BUSINESS_ID` diferente por
instancia de worker.
