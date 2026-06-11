# Reporte — Sección Equipo (permisos por rol) y Mercado Pago

Fecha: 11 jun 2026

## 1. Mercado Pago: "no me deja continuar al comprar un plan"

**No es un bug de la app.** Se probó el flujo completo en producción (atende-agente.vercel.app):

1. `/app/plan` → "Ver planes" crea el checkout correctamente (`/api/billing/create-checkout` → preapproval de MP) y redirige a Mercado Pago. ✅
2. En MP se puede elegir medio de pago (dinero disponible / tarjetas). ✅
3. En "Confirmá tu suscripción" el botón **Confirmar queda deshabilitado**. ❌

**Causa:** la sesión de Mercado Pago del navegador es la MISMA cuenta que cobra.
En la respuesta del checkout de MP: `collector_id = 154655408` y `payer_id = 154655408`
(`same_users: true`). **Mercado Pago no permite pagarte a vos mismo** y, en lugar de
mostrar un error, deshabilita el botón silenciosamente.

**Cómo probar el pago de verdad:**
- Con otra cuenta real de MP (otro mail/celular), o
- Con usuarios de prueba de MP (credenciales TEST + cuentas comprador/vendedor de prueba:
  https://www.mercadopago.com.ar/developers/es/docs/your-integrations/test/accounts)

Un cliente real (cuenta distinta) puede pagar sin problema.

## 2. Equipo: acceso por rol

**Problema:** el backend ya restringía las APIs por rol, pero la UI mostraba TODAS las
secciones a todos los roles. Un Operador veía "Mi negocio", "Mi plan", "Conectar",
"Métricas", "Equipo"… y al usarlas recibía errores 403.

**Decisión de producto (definida con Nicolás):**

| Sección            | Dueño | Admin | Operador |
|--------------------|:-----:|:-----:|:--------:|
| Inicio             | ✅    | ✅    | ✅       |
| Conversaciones     | ✅    | ✅    | ✅       |
| Reservas / Turnos  | ✅    | ✅    | ✅       |
| Mi negocio         | ✅    | ✅    | ❌       |
| Productos/servicios| ✅    | ✅    | ❌       |
| Equipo             | ✅    | ✅    | ❌       |
| Métricas           | ✅    | ✅    | ❌       |
| Mi plan (pagos)    | ✅    | ❌    | ❌       |
| Conectar WhatsApp  | ✅    | ❌    | ❌       |
| Ayuda y soporte    | ✅    | ✅    | ✅       |

**Cambios implementados:**

- `src/lib/role-access.ts` (NUEVO): fuente única de qué vistas ve cada rol, labels y
  descripciones de roles en español, y mapeo ruta→vista.
- `src/app/app/layout.tsx`: gate por ROL en el servidor. Si un Operador/Admin navega por
  URL a una sección que no le corresponde, se lo redirige a su home (`/app/conversations`
  para Operador, `/app/home` para Admin). Excepción anti-loop: con cuenta inactiva,
  cualquier rol puede VER `/app/plan` (sin acciones de pago).
- `src/components/DashboardSidebar.tsx`: navegación filtrada por rol; botón de
  desconectar WhatsApp visible solo para el Dueño.
- `src/components/MobileTabBar.tsx`: tabs por rol (para Admin/Operador entra "Turnos"
  en lugar de Plan/Negocio).
- `src/components/MoreScreen.tsx`: items de "Más" filtrados por rol.
- `src/components/PlanOverview.tsx`: si un no-dueño llega a Plan (cuenta vencida),
  ve un mensaje claro ("la facturación la gestiona el Dueño") en vez de botones de
  pago que devolverían 403.
- `src/components/TeamManagement.tsx`: opción "Agent" → "Operador" (estaba en inglés),
  descripciones de roles unificadas con role-access.ts, y al cambiar el rol de un
  miembro se muestra qué va a poder hacer antes de guardar.
- Páginas `/app/*`: ahora pasan el rol real de la sesión a la UI (`ConnectionGate`).

**Nota:** el rol se valida SIEMPRE en el servidor (layout + APIs). El filtrado de la UI
es UX, no seguridad — la seguridad ya estaba y se mantiene.

**Archivo extra:** `tsconfig.check.json` — config para correr
`npx tsc --noEmit -p tsconfig.check.json` sobre `src/` sin los types generados de `.next`.
