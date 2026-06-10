# QA Go-Live — Checklist obligatorio antes de vender

Correr completo en staging/producción con un número de WhatsApp de prueba y
Mercado Pago en sandbox. Marcar cada ítem. **No vender hasta que A, B y C estén en verde.**

## A. WhatsApp E2E

- [ ] Crear cuenta nueva (trial 14 días Growth, sin tarjeta).
- [ ] Conectar número de prueba escaneando QR.
- [ ] Enviar mensaje desde un celular cliente → llega al dashboard.
- [ ] La IA responde en el MISMO chat (verificar número del cliente).
- [ ] La respuesta de la IA aparece en el historial del dashboard.
- [ ] Pregunta con dato cargado (ej. horario) → responde directo, NO deriva.
- [ ] Pregunta sin dato cargado → consulta sin inventar, sigue activa, llega aviso "no supo responder" al encargado (si está configurado).
- [ ] "Quiero hablar con alguien" → deriva, modo pasa a HUMANO, llega aviso.
- [ ] Responder desde el dashboard en modo humano → llega al cliente y queda en el historial.
- [ ] Responder desde el celular conectado → queda en el historial sin duplicar.
- [ ] Pedir una reserva (nombre+fecha+personas) → queda Pendiente en Reservas/Turnos + aviso al encargado.
- [ ] Reiniciar el worker → la sesión reconecta sola.
- [ ] Cerrar sesión desde el teléfono (loggedOut) → la app ofrece QR nuevo.
- [ ] Dejar pasar >60s sin escanear → el QR se regenera.
- [ ] Dos conversaciones distintas → no se mezclan mensajes.

## B. Mercado Pago E2E (sandbox)

- [ ] Signup → estado trial visible en Mi Plan con días restantes.
- [ ] Vencer el trial manualmente (ajustar trial_ends_at en DB) → bloqueo operativo: pantalla "Tu prueba terminó", la IA no responde, datos intactos.
- [ ] Checkout Starter → MP cobra **$29.000**.
- [ ] Checkout Growth → MP cobra **$59.000**.
- [ ] Checkout Pro → MP cobra **$99.000**.
- [ ] Webhook procesa el pago → plan activo, acceso restaurado.
- [ ] Reenviar el mismo webhook → idempotente (no duplica activación ni pagos).
- [ ] Upgrade Starter→Growth y Growth→Pro con precio correcto.
- [ ] Cancelar plan → sigue activo hasta fin de período, luego bloquea.
- [ ] Reactivar plan cancelado.

## C. Precios sincronizados

- [ ] Landing muestra 29.000 / 59.000 / 99.000 con Growth "Más popular".
- [ ] Mi Plan y cards de upgrade muestran 29/59/99.
- [ ] `select code, price_monthly from plans;` → 29000 / 59000 / 99000.
- [ ] No aparece 49.000/89.000/149.000 ni $0 ni precios viejos en ninguna UI.
- [ ] Signup dice "14 días gratis" con Growth y "sin tarjeta".

## D. UI responsive

- [ ] Landing y dashboard en 390px, 430px, 768px y 1440px.
- [ ] Sin overflow horizontal en ninguna pantalla.
- [ ] Conversaciones en mobile: chat a pantalla completa, volver funciona.
- [ ] Planes bien proporcionados en mobile y desktop.
- [ ] /terminos y /privacidad cargan y están linkeadas (footer landing + signup).

## E. Pre-deploy

```bash
npm run build        # debe pasar sin errores
git status           # working tree limpio
git log --oneline -8 # revisar commits
git push origin main # deploy automático en Vercel
```

- [ ] Migración 026 aplicada en Supabase (SQL editor) O seed corrido: `npm run seed:plans`.
- [ ] Variables de entorno del worker en el VPS verificadas.
- [ ] Worker corriendo con restart automático (PM2/Docker `restart: always`).
