# Propuesta V2 — Vinculación por código (pairing code) además del QR

Estado: **investigación / recomendación. NO implementado.** El MVP sigue funcionando con QR.

## ¿Es viable?

**Sí.** La versión instalada de Baileys es **6.7.22**, que expone:

```ts
sock.requestPairingCode(phoneNumber: string, customPairingCode?: string): Promise<string>
```

Esto permite vincular WhatsApp **sin escanear un QR**: el usuario ingresa su número, recibe un **código de 8 caracteres** y lo carga en su teléfono (WhatsApp → Dispositivos vinculados → Vincular con número de teléfono).

Esto resuelve justamente el caso incómodo de **conectar desde el mismo celular** donde está WhatsApp (que con QR es molesto).

## Cómo funcionaría (flujo propuesto)

1. En `/app/connect` (mobile), además de “abrir en otra pantalla”, ofrecer **“Conectar con código”**.
2. El usuario ingresa su número con código de país.
3. El **worker** (no Vercel) llama `sock.requestPairingCode(numero)` sobre una sesión nueva **antes** de que se registre, y devuelve el código.
4. El dashboard muestra el código de 8 dígitos + instrucciones.
5. El usuario lo ingresa en WhatsApp; al vincularse, llega `connection: "open"` igual que con QR.

## Requisitos técnicos y riesgos

- El `requestPairingCode` debe llamarse **en el worker** (donde vive Baileys), sobre una sesión recién creada y **antes** de tener credenciales (`!sock.authState.creds.registered`). Hay que pedirlo apenas se crea el socket.
- Hace falta un **canal nuevo dashboard → worker** para “pedí un código para este número”: una columna/acción en `whatsapp_sessions` (ej. `desired_action = 'request_pairing'` + `pairing_phone`) que el worker lea y responda escribiendo `pairing_code`. Reutiliza el mismo patrón que ya existe para `desired_action = 'disconnect'`.
- Hay que validar/normalizar el número (código de país, sin `+`, sin `0` inicial).
- Baileys recomienda **no** mezclar QR y pairing en la misma sesión: si se pide pairing, no imprimir/usar el QR para esa sesión.
- Algunos números/casos devuelven error o el código expira (~ algunos minutos) → manejar reintento y expiración.
- Multi-tenant: el código es por `business_id`; nunca confiar en el número que llega del frontend sin validar contra la sesión del negocio.

## Esfuerzo estimado

- **Worker:** medio. Tocar `client.ts`/`start-worker.ts` para soportar “pedir código” y persistir el resultado. Es justamente la zona sensible (Baileys), por eso queda para V2 con pruebas dedicadas.
- **Backend:** bajo. Una acción nueva en `whatsapp_sessions` (aditiva) + endpoint para disparar/leer.
- **Frontend:** bajo. Pantalla de número + mostrar código.

## Recomendación

Dejarlo para **V2**, detrás de la opción “Conectar con código” en `/app/connect`, **manteniendo el QR como camino principal**. Implementarlo cuando se pueda dedicar una ventana de pruebas al worker (sin tocar la lógica de JID, `remoteJid`, `last_inbound_jid` ni el outbox). El cambio mobile ya entregado (abrir en otra pantalla / copiar link / enviar por WhatsApp) cubre el problema en el MVP sin riesgo.
