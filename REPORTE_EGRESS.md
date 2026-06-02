# Reporte de Egress — Supabase (plan Free)

Fecha: 2026-06-01

## Diagnóstico (lo que vi en el panel)

- **Egress usado: 10.05 GB** de **5 GB** incluidos en Free → **exceso 5.05 GB**.
- **Cached egress: 0 GB** (nada se servía desde caché).
- El consumo era bajo (~100–300 MB/día) hasta el **28 de mayo** y **saltó a ~2 GB/día desde el 29–30 de mayo**.
- **API Gateway: 84.574 requests en 60 min** (~1.400/min, ~23/seg) → ~2 millones/día.
- Endpoint #1 por lejos: **`GET /rest/v1/whatsapp_sessions?select=status,qr_string,phone,...`** (el resto de endpoints tenían conteos de 2 dígitos).

## Causa raíz

El **worker** (corre 24/7) consultaba `whatsapp_sessions` en Supabase **en cada iteración de varios loops, por cada negocio gestionado (~12)**:

- Loop de outbox cada **2s** → leía estado de conexión + hacía heartbeat (write) por negocio.
- Loop de avisos internos cada **4s** → leía estado de conexión por negocio.
- Watcher de desconexión cada **2s** → leía `desired_action` por negocio.

Cuenta: ~75.000 requests/hora solo del worker, que coincide casi exacto con los 84.574 observados. **El worker era ~90% del tráfico.** El dashboard sumaba más cuando quedaba abierto (polling de conversaciones cada 5s y de mensajes cada 2s, sin pausar en pestañas ocultas).

## Correcciones aplicadas (en código)

**Worker (`scripts/start-worker.ts`, `src/lib/baileys/client.ts`):**
- El estado de conexión ahora se lleva **en memoria** (`isSessionConnected`) — el worker ya sabe si está conectado por los eventos de Baileys. **Se eliminó por completo la lectura de `whatsapp_sessions` en los loops de outbox y avisos** (era el endpoint #1).
- Se **quitó el heartbeat redundante** que corría cada 2s dentro del loop de outbox (queda el heartbeat dedicado).
- Intervalos más espaciados: outbox **2s→5s**, avisos **4s→10s**, watcher de desconexión **2s→20s**, heartbeat **10s→15s** (sigue dentro de la ventana de 30s).

**Dashboard (`ConnectionGate.tsx`, `ConversationPanel.tsx`, `QRScreen.tsx`):**
- **Pausa de polling cuando la pestaña no está visible** (`document.hidden`) — clave para dashboards dejados abiertos.
- Intervalos más espaciados: estado de conexión **15s→30s**, conversaciones **5s→12s**, plan **60s→120s**, mensajes **2s→5s**, QR **2s→3s**.
- Ruta de mensajes: payload **100→50** mensajes por refresco.

> No se tocó la lógica de JID, envío/recepción de mensajes, outbox de WhatsApp, ni el flujo de QR/conexión. Las respuestas de la IA se siguen enviando inline (no dependen del intervalo de outbox; ese intervalo solo afecta el envío manual desde el dashboard, donde 5s es imperceptible).

## Impacto esperado

- Requests del worker: de **~80.000/h a ~10.000/h** (≈ **‑87 %**).
- Dashboard: ~0 cuando no está en foco; mucho menos cuando está abierto.
- Egress proyectado: de **~2 GB/día** a aproximadamente **~0,25–0,4 GB/día**.

Esto debería dejarte **en o cerca del límite Free de 5 GB/mes**, sobre todo si no quedan dashboards abiertos 24/7.

## Para que tome efecto (deploy)

1. **Worker** (VPS/Railway/PM2): redeploy/reiniciar — es donde está el mayor ahorro.
2. **Dashboard** (Vercel): push/redeploy.

La métrica de egress en Supabase **se actualiza cada ~1 hora**; vas a ver la baja a lo largo del día siguiente al deploy.

## Si necesitás bajar aún más (escala futura)

El polling del worker crece de forma lineal con la cantidad de negocios conectados. Para escalar manteniéndote en Free:
- Subir más los intervalos (outbox 8–10s, avisos 15s).
- Mover el outbox y el watcher de desconexión a **Supabase Realtime** (push en vez de polling) — elimina casi todo el polling restante.
- Mantener `qr_string` fuera de las lecturas frecuentes (ya no se leen en los loops).
