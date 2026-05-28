# Fixes pendientes — correr en orden

## Paso 1 — Terminal: commit y push del código

Abrí una terminal en la carpeta `whatsapp-agente/whatsapp-agente/` y corré:

```bash
# Eliminar lock de git (puede quedar bloqueado por editores)
rm -f .git/index.lock

# Stagear los cambios
git add src/app/api/auth/signup/route.ts \
        src/components/QRScreen.tsx \
        src/lib/data-access.ts \
        scripts/fix-business-alignment.mjs

# Commit
git commit -m "fix: alinear business_id/instance_name para QR y mejorar QRScreen"

# Push → Vercel va a redesplegar automáticamente
git push
```

---

## Paso 2 — Terminal: correr script de Supabase (arregla el QR)

En la misma carpeta (`whatsapp-agente/whatsapp-agente/`), corré:

```bash
node scripts/fix-business-alignment.mjs
```

Este script:
- Encuentra tu `business_id` real (el que usa tu usuario en el dashboard)
- Crea la fila correcta en `whatsapp_sessions` con `instance_name="main"`
- Te dice exactamente qué valor poner en Railway como `BUSINESS_ID`

Guardá el `business_id` que imprime → lo necesitás para el Paso 3.

---

## Paso 3 — Railway: actualizar BUSINESS_ID

1. Andá a [railway.app](https://railway.app) → tu proyecto → el servicio worker
2. Clic en **Variables**
3. Buscá la variable `BUSINESS_ID`
4. Cambiá su valor al UUID que mostró el script del Paso 2
5. Railway va a redesplegar automáticamente

Con esto el worker escribe el QR en la fila correcta y el dashboard lo puede leer.

---

## Paso 4 — Vercel: agregar variables de MercadoPago

Ve a [vercel.com](https://vercel.com) → tu proyecto → **Settings → Environment Variables**

Agregá estas dos variables (en los 3 entornos: Production, Preview, Development):

| Variable | Valor |
|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | Tu token de MP (empieza con `APP_USR-` en prod o `TEST-` en sandbox) |
| `NEXT_PUBLIC_APP_URL` | `https://tu-dominio.vercel.app` (la URL de tu app en Vercel) |

Después de agregar las variables → **Redeploy** el proyecto en Vercel.

### ¿Dónde obtengo el token de MercadoPago?

1. Andá a [mercadopago.com.ar/developers](https://www.mercadopago.com.ar/developers)
2. Clic en **Mis aplicaciones** → tu app → **Credenciales de producción**
3. Copiá el **Access token** (empieza con `APP_USR-`)

> Para pruebas usá las credenciales de sandbox (`TEST-...`) desde **Credenciales de prueba**.

---

## Paso 5 — Verificar que todo funciona

1. **QR**: Andá al dashboard → Conectar. Debería aparecer el QR dentro de ~30s
2. **Pago**: En Mi Plan → botón "Ver planes" o "Mejorar" → debería redirigir a MercadoPago
3. **Webhook**: Configurá en MP Dashboard que el webhook apunte a `https://tu-dominio.vercel.app/api/webhooks/mercadopago`

---

## Resumen de qué se arregló en el código

| Archivo | Cambio |
|---|---|
| `src/app/api/auth/signup/route.ts` | `instance_name` usa `WORKER_INSTANCE_NAME` en lugar de estar hardcodeado como `"primary"` |
| `src/components/QRScreen.tsx` | Aviso de QR expirado, mensaje de soporte más amigable |
| `src/lib/data-access.ts` | Ventana de `worker_online` extendida de 15s a 30s |
| `scripts/fix-business-alignment.mjs` | Script de diagnóstico para sincronizar Supabase con Railway |
