# Auditoría Atendé — FASE 1 (Diagnóstico)
Fecha: 2026-06-18 · Alcance: frontend, backend, worker WhatsApp, IA, Supabase, MercadoPago, seguridad, negocio.
Regla aplicada: **ante la duda, no tocar. Primero analizar.** Este documento NO contiene cambios de código; es el diagnóstico para decidir qué implementar.

---

## 0. Conclusión ejecutiva

Atendé **no es un MVP**: es un producto maduro y bien diseñado. Gran parte de lo que el pedido planteaba "construir" **ya existe y está bien hecho**. Reconstruirlo sería tirar plata y arriesgar estabilidad.

Lo que realmente mueve la aguja para vender a cientos de negocios son **5 correcciones concretas** (no un rediseño):

1. **Modelo de IA y precisión** — el default es `gpt-4o-mini`; es el sospechoso #1 de "responde como ChatGPT / inventa".
2. **Tope de catálogo a 50 ítems** en el prompt — rompe el plan Pro (hasta 1000 productos) y contradice "cuantos más productos, mejor".
3. **Escalado del worker** — todo el anti-duplicado y el buffer viven en memoria de **un solo** proceso. Hoy funciona (1 réplica); a escala es el mayor riesgo arquitectónico.
4. **Memoria en conversaciones largas** — el resumen sólo se actualiza a veces; chats largos de FAQ pueden perder contexto más allá de 20 mensajes.
5. **Plantillas premium incompletas** — faltan ~6 rubros del listado y profundidad de "vendedor".

---

## 1. Qué YA está implementado y sólido (no rehacer)

| Pedido original | Estado real | Dónde |
|---|---|---|
| Agente 8 — Agrupar mensajes ("manda 5, responder 1 vez") | ✅ Hecho. Buffer con debounce 8s + tope máx., agrupa y responde una sola vez | `baileys/handler.ts` (`scheduleBufferedReply`, `flushBufferedReply`, `AI_REPLY_DEBOUNCE_MS`) |
| Agente 7 — Dedupe / fallos / orden | ✅ Dedupe por `external_message_id` + guard de grupo en proceso (`processingGroupIds`) + flag `processing` | `handler.ts` 273-280, 443-477 |
| Agente 6 — Control de calidad / no inventar | ✅ Bloque anti-alucinación duro, detección de placeholders ("$X", "consultar", "[completar]") | `ai-rules.ts`, `ai-context.ts` (`isPlaceholderText`) |
| Agente 3 — Jerarquía de fuentes | ✅ Orden explícito: catálogo > reglas/negocio > FAQs > externas > historial. "Ante conflicto gana el catálogo" | `ai-rules.ts` (ORDEN DE RESOLUCIÓN) |
| Agente 4 — Motor de ventas | ✅ Objetivo de venta, detección de señales de compra, manejo de objeción de precio, cross-sell, anclaje, captura de lead, CTA por mensaje | `ai-rules.ts` (EMPUJÁ LA VENTA) |
| Agente 5 — Memoria conversacional | ✅ Parcial. Ventana de 20 mensajes + resumen persistido (`conversations.conversation_summary`, mig. 032) | `handler.ts` 535-604, `openrouter.ts` `buildSystemPrompt` |
| Caso 1 (plan canje "desde iPhone 13") | ✅ La regla EXACTA ya está en el prompt | `ai-rules.ts` línea 82 |
| Modo humano (IA no responde) | ✅ Modo HUMAN + auto-retorno por inactividad + `needs_attention` | `handler.ts` 498-515 |
| Anti-prompt-injection | ✅ Sanitización de input del cliente + patrones de inyección | `ai-context.ts` (`sanitizeForPrompt`, `INJECTION_PATTERNS`) |
| Multi-tenant / seguridad base | ✅ RLS activo en todas las tablas, acceso sólo vía service role en backend, anon key sólo para login | `mig. 025`, `route-auth.ts` |
| WhatsApp anti-ban | ✅ Lock de sesión única (mig. 031), envío con jitter/presencia, `syncFullHistory:false` | `client.ts`, `data-access.ts` |

**Implicancia comercial:** el mensaje de venta no es "lo estamos construyendo", es "ya funciona; lo estamos afinando para escala". Eso acorta el camino a producción.

---

## 2. Problemas encontrados (priorizados)

### P0 — Estabilidad y precisión (bloquean "vender a cientos")

**P0.1 — Modelo `gpt-4o-mini` por defecto.**
`openrouter.ts` usa `OPENAI_MODEL || "gpt-4o-mini"`. Es barato pero flojo siguiendo reglas duras (umbrales tipo "desde iPhone 13", no inventar variantes). El prompt es excelente, pero un modelo débil lo desobedece bajo presión → percepción de "responde como ChatGPT". **Mayor impacto/relación esfuerzo de todo el proyecto.**
→ Probar `gpt-4o` o `gpt-4.1` sólo en el paso de respuesta (mantener mini en el análisis JSON para costo). Variable de entorno, cero cambio de arquitectura.

**P0.2 — Catálogo truncado a 50 ítems.**
`ai-context.ts` línea 127: `regular.slice(0, 50)`. Un negocio Pro con 200–1000 productos: el modelo **no ve** del ítem 51 en adelante → "no lo tengo" sobre algo que sí está cargado, o peor, lo inventa. Contradice directamente el Agente 9 ("más productos = mejor IA").
→ Recuperación por relevancia: filtrar el catálogo según el mensaje del cliente (keyword/embeddings) y mandar sólo los 20–40 ítems relevantes, no los primeros 50.

**P0.3 — Estado en memoria de un solo worker.**
`conversationBuffers`, `processingGroupIds` y los timers viven en RAM del proceso. Con `numReplicas: 1` (railway.json) hoy es correcto. Pero a cientos de negocios vas a querer escalar el worker, y al pasar a 2+ réplicas: **se duplican respuestas y se rompe el buffer**. Es el techo arquitectónico real.
→ No tocar ahora. Documentar y planificar: dedupe/locks en Postgres o Redis antes de escalar horizontalmente.

### P1 — Precisión IA (calidad de respuesta)

**P1.1 — Memoria en chats largos.** El resumen (`action.summary`) se persiste sólo cuando `analyzeConversationAction` devuelve algo, y ese análisis a veces sale temprano con `null` (booking off + sin señales de acción). En un chat largo de pura consulta, más allá de 20 mensajes se pierde contexto.
→ Generar/actualizar resumen también cuando se supera la ventana de 20, independizándolo del análisis de acción.

**P1.2 — Doble llamada al LLM por mensaje.** Cada flush hace `analyzeConversationAction` + `generateReply`. Duplica costo y latencia a escala.
→ Gatear el análisis con más firmeza (ya hay un regex de señales) o fusionar en una sola llamada con salida estructurada.

### P2 — Conversión comercial (producto)

**P2.1 — Plantillas premium incompletas (Agente 10).** Hay ~14 plantillas (estética, gimnasio, inmobiliaria, odontología, peluquería, restaurante, taller, turismo, hotel, médico). **Faltan del listado:** Automotor, Tienda Apple, Veterinaria, Construcción, Seguros, Ecommerce. Y conviene estandarizar que cada una traiga personalidad + FAQs + objeciones + flujo de venta + seguimiento.

**P2.2 — Scraping / links externos (Agente 9).** `hasExternalSources` viene desactivado por defecto y el prompt ya prioriza catálogo. Coincido con tu hipótesis: el catálogo estructurado da mejor precisión que el scraping. Recomendación: **no eliminar el código**, pero mantenerlo opt-in/secundario y empujar el catálogo como flujo principal (mejora calidad Y negocio).

### P3 — UX y onboarding

**P3.1 — Onboarding (Agente 12).** Existe `onboarding.ts` con checklist y progreso, pero no es un wizard obligatorio bloqueante de 5 pasos. Es la mejora de activación con mejor retorno comercial.

**P3.2 — UX/UI (Agente 11).** Ya es mobile-first con buena base. Es pulido incremental, no rediseño. Bajo riesgo.

### P4 — Negocio

**P4.1 — Planes (Agente 13).** Starter $29.000 (20 prod), Growth $59.000 (150), Pro $99.000 (1000). Estructura sana. Sugerencias menores de rentabilidad/límites una vez resueltos P0.1–P0.2 (el costo de IA por modelo y por catálogo cambia los márgenes).

---

## 3. Seguridad y multi-tenant (Agente 14)

- **RLS:** activo en todas las tablas (mig. 025). Sin policies, todo el acceso es por service role en backend → `anon`/`authenticated` no leen tablas. Correcto.
- **Aislamiento por `business_id`:** las APIs del dashboard pasan por `withVerifiedActiveDashboardBusinessContext`; las queries filtran por `business_id`. No vi acceso cruzado en los caminos revisados.
- **Prompt injection:** mitigado en input del cliente (sanitización + patrones).
- **Pendiente de verificar a fondo (no alcanzó esta pasada):** que TODAS las rutas API sin excepción deriven el `business_id` del token y nunca del body del request. Es la verificación crítica de un pentest de multi-tenant y la recomiendo como tarea dedicada.

---

## 4. FASE 3 — Casos de prueba vs. comportamiento actual (en teoría)

| Caso | Comportamiento esperado | Estado según código |
|---|---|---|
| 1. Plan canje desde iPhone 13, preguntan iPhone 12 Pro → rechazar | Regla dura ya en prompt | ✅ depende de P0.1 (modelo). Con mini puede fallar |
| 2. Producto inexistente → no inventar | Anti-alucinación + placeholders | ✅ depende de P0.1/P0.2 |
| 3. 5 mensajes seguidos → 1 respuesta | Buffer + debounce | ✅ Implementado |
| 4. Modo humano → IA no responde | Modo HUMAN | ✅ Implementado |
| 5. WhatsApp desconectado → estado correcto | `status` + `worker_online` | ✅ Implementado |
| 6. Trial vencido → bloquear | `checkAccountAccess` | ✅ Implementado |
| 7. Multi-tenant aislado | RLS + filtros business_id | ✅ Base sólida; falta pentest dedicado de rutas |

**Importante:** estas pruebas hoy son "en teoría" (lectura de código). Ejecutarlas de verdad requiere un negocio de prueba con catálogo y WhatsApp conectado — y eso toca el flujo que pediste no romper, así que se hace con cuidado y con tu visto bueno.

---

## 5. Roadmap propuesto (FASE 2)

Orden por impacto/riesgo. Cada bloque es chico, reversible y NO toca la lista de "no romper".

- **Lote A (estabilidad/precisión, bajo riesgo):**
  - P0.1 Cambiar modelo del paso de respuesta vía env (probar gpt-4o / 4.1).
  - P0.2 Recuperación de catálogo por relevancia (reemplaza el `slice(0,50)`).
  - P1.1 Resumen de memoria desacoplado del análisis de acción.
- **Lote B (producto/conversión):**
  - P2.1 Completar 6 rubros de plantillas + estandarizar estructura premium.
  - P3.1 Wizard de onboarding obligatorio (5 pasos).
- **Lote C (escala, planificación):**
  - P0.3 Diseño de dedupe/locks fuera de memoria antes de escalar réplicas.
  - P1.2 Optimización de llamadas LLM.
  - P4.1 Ajuste fino de planes/márgenes.
- **Transversal:** pentest de aislamiento multi-tenant por ruta.

---

## 6. Lista "NO ROMPER" — confirmada intacta

No se tocó nada de: WhatsApp/Baileys, worker, QR, MercadoPago, login, signup, JID, `last_inbound_jid`, outbox, dedupe, multi-tenant. Este documento es sólo lectura/diagnóstico.
