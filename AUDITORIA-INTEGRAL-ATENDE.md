# Auditoría Integral — Atendé (Bot de Ventas por WhatsApp)

> Reporte técnico-comercial consolidado por una célula de auditoría de 5 roles: Product Manager, Arquitecto de Mensajería (Baileys/Meta), Ingeniero de Datos y Pagos, QA Automation y CRO Conversacional.
> Fecha: junio 2026 · Stack real: **Next.js + Vercel · Supabase/Postgres · Worker Baileys (WhatsApp Web, no oficial) · OpenAI/Whisper · Mercado Pago**.

---

## Aclaración de stack (importante para leer este informe)

El producto **no** usa la WhatsApp Business **Cloud API** de Meta: corre sobre **Baileys** (WhatsApp Web multi-device, librería no oficial). Esto cambia las reglas del juego respecto a un bot "oficial":

- No hay plantillas aprobadas (HSM), ni ventana formal de servicio de 24 h, ni botones/listas interactivas confiables, ni rate limits oficiales. **Todo es texto plano.**
- El riesgo dominante es el **baneo del número** del cliente, sin aviso ni apelación.
- La pasarela es **Mercado Pago** (no Stripe). El estado vive en **Postgres/Supabase** (no Redis).

Este informe audita lo que **realmente existe**, no un bot idealizado.

---

## TL;DR — Los 6 riesgos que hay que atacar primero

| # | Riesgo | Área | Severidad | Esfuerzo |
|---|--------|------|-----------|----------|
| 1 | **Pago cobrado sin plan activado** (webhook MP no atómico + early-return de idempotencia) | Datos/Pagos | 🔴 Crítica | Medio |
| 2 | **Doble worker sobre el mismo número** (sin lock distribuido) → corrupción de sesión y ban | Comunicaciones | 🔴 Crítica | Medio |
| 3 | **Respuestas de IA que se pierden** (no van por outbox; se persisten y facturan aunque no se envíen) | Comunicaciones/QA | 🔴 Crítica | Medio |
| 4 | **Worker sin handlers globales de error + LLM sin timeout** → buffer "congelado" y proceso caído | QA | 🔴 Crítica | Bajo |
| 5 | **Dedup e idempotencia sin constraints únicos en DB** (mensajes y pagos) | Datos | 🟠 Alta | Bajo |
| 6 | **El bot informa pero no vende** (cero CTA, promos inertes, hot-lead desaprovechado) | Comercial | 🟠 Alta | Bajo |

Los puntos 4, 5 y 6 son **bajo esfuerzo / alto impacto**: deberían entrar en el primer sprint.

---

# 1. Visión de Producto (Product Manager)

## Diagnóstico general de la experiencia

Atendé tiene una **base sólida de MVP multi-tenant**: aislamiento por `business_id`, dedup, debounce de mensajes, outbox con reintentos, RLS activado, y una capa anti-alucinación bien pensada. La dirección de producto reciente ("productos y servicios como núcleo de la inteligencia", links externos desactivados) es correcta y ya está implementada.

Pero el producto tiene **tres brechas entre lo que promete y lo que entrega**:

1. **Promete "tu vendedor automático" y entrega "tu informador automático".** Toda la maquinaria de IA está optimizada para *resolver sin mentir*, no para *cerrar ventas*. No hay una sola instrucción que empuje el próximo paso. (Ver Sección 5.)
2. **Promete confiabilidad de un producto comercial y corre sobre infraestructura no oficial (Baileys).** El riesgo de ban es existencial y hoy no está mitigado ni comunicado contractualmente. (Ver Sección 3.)
3. **Cobra suscripción pero el flujo de pago puede cobrar sin activar.** El bug del webhook (Sección 2) es el de mayor impacto en confianza y churn temprano.

## Hoja de ruta priorizada (impacto / esfuerzo)

### Sprint 1 — "No perder plata ni clientes" (crítico, mayormente bajo esfuerzo)
- Atomicidad/idempotencia del webhook MP (pago↔plan) — *Sección 2*.
- Handlers globales de proceso + timeout en OpenAI/Whisper — *Sección 4*.
- Unique index en `messages(business_id, external_message_id)` y en `payments.mp_payment_id` — *Sección 2*.
- Rutear las respuestas de IA por el outbox (reintentos) — *Sección 3*.
- Bloque "EMPUJÁ LA VENTA" en `ai-rules.ts` + activar promos/destacados — *Sección 5*.

### Sprint 2 — "Higiene anti-ban y resiliencia"
- Lock distribuido por negocio + `numReplicas=1` + plan de contingencia de ban — *Sección 3*.
- Backoff exponencial en reconexión; delays/jitter + `sendPresenceUpdate` en envíos — *Sección 3*.
- Recovery de buffers de debounce al reiniciar; transcripción de audio diferida — *Secciones 3 y 4*.
- Sanitizar el contenido del **usuario** antes del LLM (anti-inyección real) — *Sección 4*.

### Sprint 3 — "Vender más y pulir"
- Respuesta de cierre específica para `hot_lead` — *Sección 5*.
- Guiones de objeción/cross-sell por rubro en `business-templates.ts` — *Sección 5*.
- Manejo de todos los tipos de media (imagen/ubicación/sticker/doc) — *Sección 4*.
- `incrementUsage` atómico; dejar de invalidar el cache de subscription por mensaje — *Sección 2*.

## KPIs sugeridos para validar las mejoras
- **Tasa de respuesta efectiva** (mensajes del cliente que reciben respuesta enviada / total) → mide los bugs de pérdida de mensajes.
- **Conversión a "dato capturado"** (conversaciones donde el bot obtuvo nombre/contacto) → mide el giro a venta.
- **Tasa de activación post-pago** (suscripciones activas / pagos aprobados) → mide el bug del webhook.
- **Uptime de sesión por número** y **tasa de re-vinculación de QR** → mide salud de Baileys.

---

# 2. Auditoría de Infraestructura y Datos (Database & Integration Architect)

## 2.1 Pagos Mercado Pago

> **🔴 CRÍTICA — Pago cobrado sin plan activado.** `src/app/api/webhooks/mercadopago/route.ts:206-260`.
> El `payments.update(status:'approved')` y el `subscriptions.update(status:'active')` **no son atómicos**. Si Supabase falla entre ambos, el catch devuelve 500 y MP reintenta; pero en el reintento `payments.status` ya es `approved`, entra al **early-return de idempotencia** (`:208-211`) y **nunca reintenta la activación de la suscripción**. Resultado: cliente cobrado, plan nunca activado.
> **Fix:** mover ambos updates a una transacción/RPC de Supabase, o no marcar `payments=approved` hasta que la suscripción quede activa, o condicionar la idempotencia a que la suscripción esté efectivamente activa.

> **🟠 ALTA — Idempotencia sin constraint único en DB.** `payments.mp_payment_id` solo tiene un índice **no único** (`schema.sql:306-308`). Dos webhooks concurrentes (MP reintenta agresivo) pueden leer ambos `status != approved` y ambos extender `current_period_end`/`paid_at`.
> **Fix:** `unique (mp_payment_id) where mp_payment_id is not null` + `pg_advisory_xact_lock(hashtext(business_id))` (mismo patrón que la migración 030 de productos), o una tabla `processed_webhook_events(event_id pk)`.

> **🟡 MEDIA — La validación de monto no aplica en la rama `preapproval authorized`.** `:114-135`. Un preapproval autorizado con monto distinto activa el plan igual (la validación solo está en `handlePaymentEvent:236-243`).
> **Fix:** comparar `preapproval.auto_recurring.transaction_amount` contra `payments.amount` antes de activar.

> **🟡 MEDIA — `payment` y `preapproval` pisan el período mutuamente.** Ambos eventos ponen `active` y recalculan `current_period_end` con fórmulas distintas (`next_payment_date` vs `now+30d`). No hay doble cobro, sí inconsistencia de fecha de fin.
> **Fix:** una única fuente de verdad del período (preapproval); que el evento `payment` solo registre `paid_at`.

> **🟢 BAJA — `getAppUrl` cae a `localhost:3000`** si falta `NEXT_PUBLIC_APP_URL`/`VERCEL_URL` (`create-checkout:18-29`): en prod genera `notification_url`/`back_url` rotos.
> **Fix:** fallar (throw) en `NODE_ENV==='production'`.

**Lo que está bien (no tocar):** firma HMAC con `timingSafeEqual`, rechazo 401 sin secret/firma, retorno 500 para forzar reintento ante fallo transitorio, validación de monto con tolerancia ±1, rate-limit en checkout.

## 2.2 Gestión de estado de conversación

> **🟠 ALTA — Race: el auto-retorno HUMAN→AI pisa un handoff humano concurrente.** `src/lib/baileys/handler.ts:496-503`. El handler lee `mode`/`human_last_activity`, decide "stale" y hace `setMode("AI")` **sin cláusula condicional**. Entre la lectura y el write, un agente puede responder desde el dashboard; el `setMode` lo sobrescribe y la IA vuelve a hablar por encima del humano.
> **Fix:** aplicar el cambio condicional en el UPDATE (`.eq("mode","HUMAN").lt("human_last_activity", threshold)`) — ya existe en `returnInactiveConversationsToAI`; reusar esa función en la ruta inline del handler.

> **🟡 MEDIA — `insertMessage` hace dos writes no atómicos** (mensaje + `last_message_at`, `data-access.ts:2793-2810`). Si el segundo falla, se desordena la bandeja. **Fix:** trigger `AFTER INSERT` en `messages`.

## 2.3 Stock / inventario

> **🟢 INFORMATIVO — No hay sobreventa porque no hay inventario numérico.** `products.stock_status` es un enum categórico (`available|unavailable|on_demand`); no hay cantidad ni descuento de stock, y los pagos son de **suscripción SaaS**, no de productos del catálogo. El escenario "dos clientes, último producto" **no aplica hoy**. Si en el futuro se venden unidades reales, faltaría `stock_qty integer` con decremento atómico (`UPDATE ... SET stock_qty = stock_qty - 1 WHERE stock_qty > 0`) y/o reservas con expiración.

## 2.4 Eficiencia de queries y concurrencia

> **🟠 ALTA — Dedup de inbound es check-then-insert no atómico.** `handler.ts:271-279`. Sin `unique` sobre `(business_id, external_message_id)` (los índices de la migración 005 son **no únicos**), dos entregas del mismo `messageId` (reconexión Baileys, retry) pueden duplicar mensaje + uso + respuesta. **Fix:** unique index parcial + `insert ... on conflict do nothing`.

> **🟡 MEDIA — `incrementUsage` es read-modify-write (lost update).** `data-access.ts:834-851`. Inbounds simultáneos del mismo negocio pierden incrementos → conteo subestimado. **Fix:** incremento atómico vía RPC (`set x = x + 1`).

> **🟢 BAJA — `incrementUsage` invalida el cache de subscription en cada mensaje** (`:848`, además con un log de copy-paste erróneo "cancel_at_period_end"). Anula el cache de 60 s en conversaciones activas → un SELECT extra por mensaje. **Fix:** no invalidar subscription al tocar usage.

> **✅ Resuelto y destacado:** el **límite de productos** ya tiene backstop transaccional con `pg_advisory_xact_lock` (migración 030). La validación de app queda solo para UX. Bien hecho.

**Constraints únicos existentes (bien):** `businesses.slug`, `business_members(business_id,user_id)`, `contact_identities`, `conversations(business_id,contact_id)`, `usage_monthly`, `whatsapp_sessions(business_id,instance_name)`. **Faltan:** `payments.mp_payment_id` y `messages.external_message_id`.

---

# 3. Estabilidad de Comunicaciones (WhatsApp / Baileys)

## 3.1 Riesgo existencial: Baileys no oficial

> **🔴 CRÍTICA — Stack no oficial para un producto que cobra.** Toda la capa (`client.ts`, `handler.ts`, `start-worker.ts`). Implica: ban del número sin aviso, sin SLA, riesgo correlacionado entre tenants (una actualización de WhatsApp puede tumbar a todos), y patrones "robóticos" que aceleran el baneo. `grep` confirma **cero** uso de `sendPresenceUpdate`/`presenceSubscribe`/`delay`.
> **Mitigaciones presentes:** `markOnlineOnConnect:false`, `syncFullHistory:false`, dedup de reply idéntico. **Faltan:** cap diario por número, jitter humano entre envíos, presencia ("escribiendo…"), warm-up de números nuevos, plan de contingencia ante ban.

## 3.2 Doble sesión / resiliencia

> **🔴 CRÍTICA — Riesgo de doble worker sobre el mismo número.** `getActiveBusinessIdsForWorker` (`data-access.ts:3255`) **no filtra por `instance_name`**: devuelve todos los negocios activos. Si un deploy/rollback deja dos instancias del worker (o se escala a 2 réplicas), ambas levantan sesión Baileys para el mismo `business_id` sobre el mismo auth dir → conflicto de credenciales, 440 mutuo y casi seguro ban. `railway.json` no fija `numReplicas:1`.
> **Fix:** lock de adopción por negocio en Supabase (columna `owned_by_instance` + heartbeat; un worker solo gestiona negocios con lock libre/vencido) + `numReplicas=1`.

> **🔴 CRÍTICA — Reconexión con código 440 (`connectionReplaced`) puede entrar en loop.** `client.ts:257-272` + `start-worker.ts:84-117`. Delays fijos (15s/5s) sin límite de intentos ni backoff: si alguien abre WhatsApp Web del mismo número, el worker reconecta y "roba" la sesión en ping-pong indefinido, degradando el número.
> **Fix:** backoff exponencial con tope (5s→…→5min) + contador; ante 440 repetido, dejar `disconnected` y avisar al dueño.

> **🔴 CRÍTICA — Respuestas de IA que se pierden y se facturan igual.** El handler inserta el mensaje `assistant` (`handler.ts:623`), contabiliza uso y avisa al dueño **antes** de enviar (`handler.ts:722`), y el envío de IA **no pasa por el outbox** (a diferencia del envío humano). Si `sock.sendMessage` falla, se persiste y factura una respuesta que el cliente nunca recibió.
> **Fix:** rutear TODA salida de IA por el outbox (insertar→enviar con reintentos→confirmar), o como mínimo enviar primero y persistir/contabilizar solo tras confirmación.

## 3.3 Procesamiento de mensajes

> **🟠 ALTA — Buffers de debounce en memoria se pierden ante reinicio.** `handler.ts:91`. Mensajes encolados en la ventana de debounce (hasta 8–20 s) que coincidan con un deploy/OOM/crash **nunca se responden** (ya están guardados como `user`, pero el timer murió). **Fix:** al reconectar, barrer conversaciones con último mensaje `user` sin `assistant` posterior y re-encolar.

> **🟠 ALTA — Audios procesados de forma síncrona en `messages.upsert`.** `handler.ts:284-285`. La transcripción (descarga media + Whisper) corre dentro del loop del batch, antes del debounce → serializa, bloquea y puede perder el audio si la sesión se reconecta. **Fix:** persistir el inbound primero y transcribir en etapa diferida/cola.

> **🟠 ALTA — Sin rate limiting / delay en el envío.** Outbox (hasta 20 ítems cada 5 s) y respuestas de IA hacen `sendMessage` instantáneo en ráfaga, sin jitter ni presencia. Patrón detectable → acelera el ban. **Fix:** delay aleatorio 1–4 s, `sendPresenceUpdate('composing')`, cap por minuto/hora.

## 3.4 Otros (Media/Baja)

- **🟡 Desconexión remota borra el auth dir** y fuerza re-escaneo de QR (`start-worker.ts:266-292`): el botón "disconnect" no distingue "pausar IA" de "desvincular número". **Fix:** separar ambas acciones.
- **🟡 Mismatch `instance_name`**: docs dicen `primary`, código default `main` (`env.ts`). Si se configura mal, el dashboard ve "offline" eterno. **Fix:** unificar default y validar al arranque.
- **🟢 Mapeo de mimetype de audio** incompleto pero cubierto por fallback; **🟢 texto de audio fallido** se persiste como mensaje de usuario con un prompt interno (contamina el historial).

---

# 4. Robustez del Código (QA Automation)

## Hallazgo transversal crítico
> **🔴 El worker no tiene `process.on('unhandledRejection')` ni `uncaughtException`** (`start-worker.ts:323-324` solo cubre SIGINT/SIGTERM). Como casi todos los writes de DB hacen `throw`, un fallo de Supabase en el momento equivocado **mata el proceso multi-tenant entero**. Sumado a que el cliente OpenAI **no tiene timeout** (`openrouter.ts:20-23`), un cuelgue deja el buffer en `processing=true` para siempre → conversación "congelada".

## Matriz de casos de prueba fallidos (selección priorizada)

| # | Caso | Comportamiento actual | Sev. | Archivo:línea | Fix |
|---|------|------------------------|------|---------------|-----|
| 1 | Imagen/sticker/ubicación/doc **sin caption** | Se ignora en silencio: el cliente queda sin respuesta y no se registra | 🟠 Alta | `handler.ts:206-215` | Texto sintético por tipo ("[el cliente compartió su ubicación]") y persistir inbound |
| 6 | **LLM cae / timeout** en `generateReply` | Sin try/catch y sin timeout: cliente sin respuesta, inbound "comido", buffer colgado | 🔴 Crítica | `handler.ts:599-602`, `openrouter.ts:20-23` | `timeout`+`maxRetries` en cliente OpenAI; try/catch + reply de cortesía; reencolar |
| 7 | LLM responde vacío | Manda `"No pude generar una respuesta."` **al cliente final** y lo persiste | 🟡 Media | `openrouter.ts:160-163` | Tratar como error (no enviar, reencolar o handoff) |
| 11 | Mensaje larguísimo (50k chars) | No se trunca el contenido del usuario antes del LLM → 400 de context-length (cae en #6) | 🟡 Media | `handler.ts:349` | Truncar a N chars al ingresar (como hace `/assistant/test`) |
| 13 | **Inyección de prompt del cliente** | `sanitizeForPrompt` solo cubre el contexto del negocio; los mensajes `user` van crudos al LLM | 🟠 Alta | `openrouter.ts:142-145,239-242` | Pasar los `history[].content` de rol user por el sanitizer |
| 16 | **Buffer congelado** | Si `generateReply` cuelga sin resolver, el `finally` nunca corre → ese chat no responde nunca más | 🟠 Alta | `handler.ts:441-475` | Timeout duro + `Promise.race` con watchdog |
| 18/19 | DB cae al guardar inbound / registrar uso | Sin catch local: inbound perdido o **nunca se llama `scheduleBufferedReply`** (cliente sin respuesta) | 🟠 Alta | `handler.ts:349-350` | Reintentos en writes críticos; métricas con `.catch()` no bloqueante |
| 21 | **MP cae entre `payments.update` y `subscriptions.update`** | Pago cobrado, plan nunca activado (ver Sección 2.1) | 🔴 Crítica | `mercadopago/route.ts:206-260` | Transacción/RPC o idempotencia condicionada a subscription activa |
| 23 | Webhook con `amount` esperado = 0/null | Se **saltea** la validación de monto y activa el plan | 🟡 Media | `mercadopago/route.ts:236-243` | Tratar `expectedAmount<=0` como error de config, no como bypass |
| 30 | `sock.sendMessage` falla al final del flush | Se persiste y contabiliza una respuesta que nunca se envió | 🟠 Alta | `handler.ts:722-728` | Enviar primero / vía outbox; persistir tras confirmación |

## Recomendaciones generales de control de excepciones
1. **Handlers globales de proceso** en el worker (prioridad 1).
2. **Timeout obligatorio** en cliente OpenAI/Whisper (`timeout:30000, maxRetries:2`) + watchdog en `processBufferedReply`.
3. **Las métricas nunca bloquean la respuesta** (`recordInboundMessageUsage`, `recordAiReplyUsage`… con `.catch(()=>{})`).
4. **No vaciar el buffer hasta confirmar éxito**; reencolar items en el `catch`.
5. **Unificar el envío de IA sobre el outbox** (reintentos gratis).
6. **Sanitizar siempre el contenido del usuario** antes del LLM.
7. **Manejar todos los tipos de media**, no solo audio.
8. **Atomicidad/idempotencia real** en el webhook de MP.
9. **`req.json().catch(...)`** en todos los endpoints con body; truncar longitudes de entrada.
10. **Visibilidad**: loguear parseos fallidos, replies descartados por dedup y buffers congelados (>X s).

---

# 5. Optimización Comercial (Conversational CRO)

## Diagnóstico: el bot informa, no vende
La capa de reglas (`ai-rules.ts`) está optimizada para *resolver sin mentir*, pero **no hay una sola instrucción que empuje el cierre**. Peor: cuando `analyzeConversationAction` detecta `hot_lead` (`openrouter.ts:228`), al cliente se le responde con el **LLM genérico** (`handler.ts:599-600`); el `hot_lead` solo dispara una **notificación interna al dueño**. El pico de intención de compra se responde con tono informativo. Ahí se pierde la venta.

### Fricciones principales
- **Objetivo = "resolver consultas", no "cerrar"** (`ai-rules.ts:38`).
- **Cero CTA**: la regla anti-robotismo (`ai-rules.ts:98`) desalienta ofrecimientos al cierre → el bot responde y se queda callado.
- **Promo activa inerte**: se carga en el contexto (`ai-context.ts:112-124`) pero ninguna regla ordena usarla.
- **"Precio no cargado" enfría el lead** sin capturar nombre/contacto.
- **Sin manejo de "está caro", sin cross-sell, sin anclaje de precio, sin prueba social.**

## Cambios concretos de código (alto ROI primero)

1. **(`openrouter.ts`/`handler.ts`) Respuesta de cierre para `hot_lead`** — *el de mayor impacto*. Que `analyzeConversationAction` devuelva un `customer_reply` orientado al cierre también para `hot_lead` (hoy solo cubre handoff/appointment). `handler.ts:594` ya usa ese `customer_reply`, así que es solo cambio de prompt.
2. **(`ai-rules.ts`) Bloque "EMPUJÁ LA VENTA"** (insertar antes del cierre del prompt):
   ```
   EMPUJÁ LA VENTA (cuando hay interés de compra):
   - Cerrá SIEMPRE con un próximo paso concreto (reservar, pedir un dato, ofrecer envío/retiro). Una acción por mensaje.
   - Si hay promo activa cargada y aplica, mencionala con su fecha de fin si la tiene. NUNCA inventes fechas ni descuentos.
   - Si hay precio de lista y precio promo, mostrá los dos para que se vea el ahorro (anclaje).
   - Cross-sell: cuando el cliente confirma interés, ofrecé UN complementario del catálogo (solo ítems cargados).
   - Objeción "está caro": no discutas; reconocé, reenmarcá el valor cargado y ofrecé la opción más económica que exista.
   - Prueba social: solo si el ítem es destacado podés decir "es de los más pedidos". Nunca inventes reseñas.
   ```
3. **(`ai-rules.ts:98`) Matizar la regla anti-ofrecimiento:** diferenciar "despedida hueca = no" de "CTA que avanza = sí".
4. **(`ai-context.ts:113`) Marcar promos como accionables:** `"(Usá estas promos para incentivar la compra cuando el cliente muestre interés. No inventes ninguna.)"`.
5. **(`ai-context.ts:107`) Pista de cross-sell en Destacados.**
6. **(`business-templates.ts`) Guiones por rubro:** sumar 1–2 ejemplos de cierre con CTA y 1 de objeción de precio; acortar los `welcomeMessage` largos.

> **Importante:** ninguna de estas palancas debilita el anti-alucinación — todas se atan a datos ya cargados en el contexto (precio, promo, `promotion_ends_at`, `is_featured`, stock). La regla dura de no inventar se mantiene intacta.

## Textos exactos recomendados (rioplatense, formato WhatsApp)

**Saludo inicial**
```
¡Hola! 👋 ¿Qué estás buscando? Te paso precios y disponibilidad al toque.
```
**Presentación de producto (anclaje + CTA)**
```
El [producto] sale $[precio]. Ahora con promo a $[promo] 🙌
¿Te lo reservo o querés que te pase otra opción?
```
**"¿Cuánto sale?"**
```
Sale $[precio] 💳 Aceptamos [medios de pago].
¿Lo querés para retirar o con envío?
```
**"¿Cuánto sale?" sin precio cargado (captura el lead)**
```
Dejame confirmarte el precio justo así no te paso cualquier cosa.
¿A qué nombre lo anoto y te lo confirmo por acá en un rato?
```
**"Está caro" (reencuadre, sin discutir)**
```
Te entiendo. En ese precio entra [beneficio/garantía cargada].
Si querés ajustarlo al presupuesto, tengo opciones desde $[precio menor]. ¿Te paso?
```
**Cierre / cómo comprar**
```
Buenísimo. Para cerrarlo te pido: nombre y si es envío o retiro.
Con eso lo dejo reservado y coordinamos el pago 🙌
```
**Derivación a humano (sin emojis)**
```
Dame un momento que lo paso con alguien del equipo para que te lo cierre bien.
```
**Seguimiento de lead caliente (UN solo mensaje, en la conversación ya abierta)**
```
¡Hola [nombre]! Quedó pendiente lo del [producto].
¿Lo cerramos hoy? Te lo dejo reservado y listo 🙌
```

## Cómo simular "opciones" sin botones (canal texto)
Baileys es texto plano. Simular interactividad con **listas numeradas cortas** y pedir que respondan el número. Usar solo con 2–4 opciones que desbloquean el siguiente paso (envío/retiro, medio de pago, modelo, horario); nunca para una respuesta directa ni en reclamos.
```
¿Cómo preferís?
1️⃣ Envío a domicilio
2️⃣ Retiro en el local
Respondé 1 o 2 y seguimos 🙌
```

## Nota anti-ban sobre follow-up
**No** implementar follow-up automático masivo desde Baileys (mensajería no solicitada = ban). El `hot_lead` ya notifica al dueño: que el **humano** mande el seguimiento, o limitarlo a **1 solo mensaje** dentro de la conversación ya abierta y solo a quien ya escribió.

---

## Anexo — Inventario de archivos auditados
`scripts/start-worker.ts` · `src/lib/baileys/{client,handler}.ts` · `src/lib/whatsapp/*` · `src/lib/openrouter.ts` · `src/lib/ai-context.ts` · `src/lib/ai-rules.ts` · `src/lib/system-prompt.ts` · `src/lib/business-templates.ts` · `src/lib/data-access.ts` · `src/lib/rate-limit.ts` · `supabase/schema.sql` + `supabase/migrations/*` · `src/app/api/webhooks/mercadopago/route.ts` · `src/app/api/billing/create-checkout/route.ts` · `src/app/api/messages/[conversationId]/route.ts` · `src/app/api/connection/*` · `railway.json` · `ecosystem.worker.config.cjs`.

*Auditoría de solo lectura. Ningún archivo de la app fue modificado para generar este informe.*
