# Atendé — Auditoría comercial para escalar
**Fecha:** 2026-06-24 · **Alcance:** producto completo (frontend, worker WhatsApp, IA, Supabase, MercadoPago, onboarding, pricing, competencia)
**Regla aplicada:** *ante la duda, no tocar.* Este documento es diagnóstico + plan. No incluye cambios de código.
**Equipo simulado:** SaaS Founder · PM · UX Mobile Lead · Arquitecto · Esp. Baileys · Esp. IA · CRO · QA · Growth · Onboarding/Retención.

---

## 0. Conclusión ejecutiva (leé esto aunque no leas el resto)

**Atendé NO es un MVP a medio construir. Es un producto maduro y bien hecho.** La mayoría de lo que el pedido planteaba como "construir" **ya existe y está bien resuelto** en el código: buffer de mensajes (manda 5 → responde 1 vez), deduplicación en 3 niveles, anti-alucinación duro, motor de ventas en el prompt, modo humano, agenda con disponibilidad real, anti-ban, multi-tenant con RLS, PWA instalable, navegación mobile con tab bar, onboarding guiado de 3 pasos y **Pairing Code ya implementado**.

Reescribir o "rediseñar todo" sería tirar plata y arriesgar estabilidad. **Lo que mueve la aguja para vender a cientos de negocios son pocas cosas, casi todas de bajo riesgo.** En una frase:

> El cuello de botella de Atendé hoy **no es funcionalidad: es calidad de IA (modelo), activación (onboarding hasta el primer "ajá") y percepción de profesionalismo.** No es arquitectura.

**Las 5 palancas de mayor impacto (ordenadas por retorno/esfuerzo):**

1. **Subir el modelo de IA del paso de respuesta** (`AI_REPLY_MODEL`) de `gpt-4o-mini` a uno fuerte. Es **una variable de entorno**, cero refactor, y es el sospechoso #1 de "responde como ChatGPT / inventa". Mayor impacto del proyecto.
2. **Onboarding que termine en el primer mensaje real respondido** (conectar WhatsApp + probar el bot dentro del wizard), no en "revisá tus reglas".
3. **Hacer del Pairing Code el camino principal de conexión en mobile** (ya está en el código; falta priorizarlo en la UI sobre el QR).
4. **Cerrar el loop de valor visible**: que el dueño *vea* lo que el bot le hizo ganar (leads capturados, respuestas fuera de hora, ventas empujadas). Sin esto no hay retención ni upgrades.
5. **Resolver el techo de escala del worker antes de crecer** (estado en RAM de 1 solo proceso). Hoy funciona; a 2+ réplicas se duplican respuestas. No tocar ahora; planificar.

El resto del informe detalla cada punto.

---

## 1. Auditoría completa — cómo funciona hoy

### 1.1 Arquitectura (real, verificada en el código)
- **Frontend/Backend:** Next.js 15 (App Router) + React 19. App principal bajo `/app/app/*` con layout que aplica *gates* por rol y por estado de cuenta (trial vencido → `/app/plan`).
- **Worker WhatsApp:** proceso separado (`scripts/start-worker.ts`, PM2/Railway) con **Baileys 6.7.22**. Una sesión por negocio, lock de sesión única (anti doble-conexión).
- **IA:** OpenAI SDK (compatible OpenRouter). **Dos pasos por mensaje**: (a) análisis JSON de intención/acción barato y (b) generación de respuesta. Prompt armado por mensaje con *retrieval* de catálogo por relevancia.
- **Datos:** Supabase (Postgres) con **RLS en todas las tablas**, acceso de backend por service role. Cache de datos de negocio con TTL 60s para bajar egress.
- **Pagos:** MercadoPago (checkout + webhooks), trial de 14 días en plan Growth.

### 1.2 Flujo de un mensaje entrante (el corazón del producto)
1. `messages.upsert` → ignora grupos/newsletter/JID no 1-a-1.
2. **Dedupe** por `external_message_id` (no reprocesa lo ya guardado).
3. Texto o **audio → transcripción** (Whisper) con fallback si no se entiende.
4. **Buffer con debounce** (8s, tope 20s): si el cliente manda 5 mensajes seguidos, agrupa y responde **una sola vez**. Guard de grupo en proceso para no duplicar.
5. Chequea modo (AI/HUMAN), acceso de cuenta y límites de plan.
6. Análisis de acción → si hay turno/derivación/lead, actúa; si no, **genera respuesta** con el contexto del negocio.
7. **Anti-eco**: no se responde a sí mismo ni al número propio; no repite la última respuesta.
8. Envío con "escribiendo…", jitter y tope horario (**anti-ban**).

### 1.3 Calidad de la IA (mejor de lo esperado)
El prompt (`ai-rules.ts`) es de nivel profesional: orden de resolución explícito (catálogo > reglas > FAQ > externas > historial), bloque **anti-alucinación duro**, detección de placeholders (`$X`, `consultar`, `[completar]`, `N/A`), reglas duras de negocio ("plan canje **desde** iPhone 13" → un 12 no califica), motor de ventas (señales de compra, objeción de precio, cross-sell, anclaje, captura de lead, CTA por mensaje), tono rioplatense, anti-Markdown para WhatsApp y frases de fallback ("dame un momento y lo consulto").

### 1.4 Reservas/turnos (sólido)
Motor de disponibilidad (`availability.ts`) **independiente de la IA**, funciones puras y testeables: genera slots por horario laboral, frecuencia configurable (15/30/45/60 min), duración, antelación mínima, bloqueos, excepciones y **no superpone turnos**. La IA propone; **el backend es la verdad**. Si el horario no entra, ofrece alternativas reales.

### 1.5 Conexión WhatsApp
QR + **Pairing Code ya funcionando** (Baileys 6.7.22 soporta `requestPairingCode` de forma estable). Normalización de número argentino (549...), rate-limit de pedidos de código, reconexión con backoff, limpieza de auth en logout.

---

## 2. Problemas CRÍTICOS (bloquean "vender a cientos")

**C1 — Modelo de IA por defecto débil.** `openrouter.ts` usa `gpt-4o-mini` salvo que se configure `AI_REPLY_MODEL`. El prompt es excelente, pero un modelo flojo lo desobedece bajo presión (umbrales, no inventar variantes) → genera la percepción de "responde como ChatGPT / inventa". **Es el problema más importante y el más barato de arreglar.**

**C2 — Techo de escala del worker.** `conversationBuffers`, `processingGroupIds` y los timers viven en RAM de **un solo** proceso. Con 1 réplica (config actual) es correcto. Al escalar a 2+ réplicas: **respuestas duplicadas** y buffer roto. Es el verdadero límite arquitectónico. **No romper nada ahora**; planificar locks/dedupe en Postgres o Redis antes de crecer horizontalmente.

**C3 — Riesgo de plataforma (Baileys no es API oficial).** Es el diferencial (conexión instantánea, sin fees de Meta) **y** el mayor riesgo: WhatsApp puede banear números. Ya hay anti-ban, pero a escala un baneo masivo es existencial. Debe haber: detección de desconexión + aviso proactivo al cliente, guía de "calentar" el número, y términos que lo expliciten.

**C4 — Activación: el onboarding no termina en valor.** El wizard de 3 pasos cierra en "revisá tus reglas / probá el asistente", **no** en "tu WhatsApp está conectado y ya respondió un mensaje real". El momento "ajá" (ver al bot responder bien) queda fuera del flujo guiado → cae la conversión trial→pago.

---

## 3. Problemas IMPORTANTES

**I1 — Memoria en chats largos.** El resumen se persiste sólo cuando el análisis de acción devuelve algo; en un chat largo de pura consulta (>30 mensajes) puede perderse contexto. *(Parcialmente mitigado: ya corre el análisis en hilos ≥10 mensajes, pero conviene independizar el resumen del análisis.)*

**I2 — Doble llamada al LLM por mensaje** (análisis + respuesta): duplica costo y latencia a escala. Hay un regex que ya gatea el análisis; conviene endurecerlo o fusionar en una sola llamada estructurada.

**I3 — Detección de handoff/consulta por regex sobre el texto de la IA.** `isHandoffReply`/`isConsultReply` matchean frases del propio bot. Si el modelo varía la redacción, se pierde el handoff o el aviso al encargado. Frágil; conviene anclarlo a la **señal estructurada** del análisis (que ya existe: `human_handoff`).

**I4 — Valor invisible para el dueño.** Hay métricas (`StatsScreen`) pero no un "esto te hizo ganar X": leads capturados, consultas respondidas fuera de hora, turnos generados, ventas empujadas. Sin un panel de ROI, el dueño no percibe por qué paga.

**I5 — Catálogo: fricción de carga.** `ItemCatalog.tsx` es enorme (1829 líneas). Hay importación por Excel, pero cargar el primer producto a mano sigue siendo el paso donde más gente abandona. Falta un camino ultra-rápido (pegar lista / foto de catálogo / importar de Instagram).

**I6 — Plantillas de rubro incompletas.** Faltan rubros del listado comercial (automotor, veterinaria, ecommerce, seguros, etc.) y estandarizar que cada una traiga personalidad + FAQs + objeciones + flujo de venta + seguimiento.

---

## 4. Quick Wins (menos de 7 días, bajo riesgo)

| # | Quick win | Esfuerzo | Riesgo | Impacto |
|---|-----------|----------|--------|---------|
| Q1 | Setear `AI_REPLY_MODEL` a un modelo fuerte (sólo el paso de respuesta; mantener mini en análisis). Medir antes/después con 20 chats reales. | 1 día | Muy bajo (env var) | **Altísimo** |
| Q2 | En `/app/connect`: poner **Pairing Code como opción primaria** en mobile, QR como secundario ("¿preferís escanear?"). El código ya existe. | 1–2 días | Bajo | Alto (activación) |
| Q3 | Cerrar el wizard de onboarding **dentro de** la conexión de WhatsApp + un "mandate un mensaje de prueba y mirá cómo responde". | 2–3 días | Bajo | Alto (activación) |
| Q4 | Banner de estado de conexión persistente: si el worker/WhatsApp se cae, avisar al dueño en la app y por mail/WhatsApp. | 2 días | Bajo | Alto (retención) |
| Q5 | Tarjeta "Lo que hizo tu asistente esta semana" en Inicio (leads, fuera de hora, turnos). Reusar datos que ya se loguean. | 2–3 días | Bajo | Alto (percepción de valor) |
| Q6 | Anclar handoff/consulta a la señal estructurada del análisis (no sólo regex). | 1 día | Bajo | Medio (confiabilidad) |
| Q7 | Completar 4–6 plantillas de rubro faltantes con flujo de venta. | 2–3 días | Muy bajo | Medio (conversión) |
| Q8 | Microcopy de errores de conexión ("el asistente está iniciando, esperá…") y vacíos con CTA. | 1 día | Muy bajo | Medio (UX) |

---

## 5. Mejoras de ALTO impacto (2–6 semanas)

- **Panel de ROI / "valor generado"** real, semanal, con notificación push (PWA) y resumen por WhatsApp al dueño. Es la palanca #1 de retención y de justificación de precio.
- **Onboarding con "primer éxito garantizado":** rubro → 3 productos (o import) → conectar → mensaje de prueba respondido → checklist de activación con progreso visible.
- **Carga de catálogo asistida por IA:** pegar una lista de precios en texto/Excel/foto y que la IA la estructure en ítems (nombre, precio, categoría). Ataca I5 directo.
- **Independizar el resumen de conversación** del análisis de acción (arregla I1, mejora calidad en chats largos).
- **Modo "vendedor" configurable por intensidad** (informativo ↔ agresivo) por negocio, sobre el motor de ventas que ya existe.
- **Detección y recuperación de baneo/caída de número** con playbook al cliente.

---

## 6. Roadmap 30 días (estabilizar + activar)

**Semana 1 — Calidad de IA y conexión**
- Q1 (modelo), Q2 (Pairing Code primario), Q6 (handoff estructurado).
- Banco de 20–30 conversaciones reales como set de regresión de IA (QA).

**Semana 2 — Activación**
- Q3 (onboarding que conecta y prueba), Q8 (microcopy), Q4 (estado de conexión).

**Semana 3 — Valor visible**
- Q5 + panel de ROI v1 (leads, fuera de hora, turnos, ventas empujadas).
- Q7 (plantillas faltantes).

**Semana 4 — Pulido y medición**
- Notificaciones PWA del panel de valor.
- Instrumentar embudo: signup → conecta → primer mensaje IA → primer lead → paga. Sin este embudo medido, las decisiones siguientes son a ciegas.

---

## 7. Roadmap 90 días (escalar con seguridad)

- **Preparar escala horizontal del worker (C2):** mover buffer/dedupe/locks de RAM a Postgres o Redis. Recién entonces habilitar 2+ réplicas. **Sin esto, no escalar el worker.**
- **Carga de catálogo por IA** en producción.
- **Resumen de conversación independiente** + fusión opcional de las dos llamadas LLM (costo/latencia).
- **Plantillas premium completas** por rubro con flujo de venta y seguimiento.
- **Playbook anti-baneo** (calentamiento de número, alertas, recuperación) y términos que lo expliciten.
- **Self-serve de planes** y upgrades in-app sin fricción (palanca de revenue).

---

## 8. Roadmap 6 meses (producto comercial defendible)

- **Multi-número / multi-sesión por negocio** (hoy 1 sesión; el plan Pro lo insinuaba y se quitó por honestidad). Requiere C2 resuelto.
- **Seguimientos automáticos** (recordatorios de turno, reactivación de leads fríos, carritos): pasa de "responder" a "traer plata".
- **Integraciones** (MercadoPago Link de pago en el chat, Google Calendar, Instagram DM, ecommerce/Tienda Nube).
- **Reportes avanzados y benchmarks** por rubro (valor para upsell a Pro).
- **API/embebido** para agencias que revenden Atendé (canal de crecimiento B2B2C).
- **Evaluación continua de IA** (golden set + scoring automático de alucinación) como ventaja de calidad sostenible.

---

## 9. Cambios UX/UI prioritarios

1. **Conexión primero, todo lo demás después:** mientras WhatsApp no esté conectado, la app debería empujar ese único paso (no dejar al usuario perdido entre 7 tabs).
2. **Pairing Code como héroe en mobile.** El QR en un solo teléfono es incómodo (necesitás otra pantalla). El código de 8 dígitos es nativo mobile.
3. **Inicio = panel de valor**, no un menú. Lo primero que ve el dueño debe ser "tu bot trabajó por vos".
4. **Catálogo: reducir a un flujo de 1 pantalla** para el primer producto; lo avanzado, oculto.
5. **Estados claros:** conexión, trial restante, límites de plan, "el bot está activo / en pausa" siempre visibles.
6. **Microcopy humano y rioplatense** en toda la app (ya lo tiene el bot; que la UI hable igual).

---

## 10. Que parezca una app móvil real (no una web)

- **PWA ya existe** (manifest, service worker, íconos, tab bar). Falta empujar la **instalación** ("Agregá Atendé a tu pantalla de inicio") con un prompt nativo en el momento justo (post-activación).
- **Notificaciones push** del panel de valor y de leads calientes (el SW ya está listo para push).
- **Gestos y transiciones tipo app**: tab bar fija (ya está), navegación con estado, *pull-to-refresh* en chats, *skeletons* en vez de spinners.
- **Splash + ícono maskable** (ya hay `icon-maskable-512`): verificar que la instalada abra en modo standalone sin barra del navegador.
- **Háptica/feedback táctil** en acciones clave (enviar, conectar).
- Evitar tablas anchas y formularios largos en mobile (revisar `ItemCatalog`, `TeamManagement`, `PlanOverview`).

---

## 11. Que la IA responda mejor (sin reescribir el prompt, que ya es bueno)

1. **Modelo fuerte en el paso de respuesta** (C1/Q1) — el cambio más rentable.
2. **Golden set de regresión:** 20–30 chats reales con respuesta esperada; correrlos en cada cambio de prompt o modelo. Sin esto, "mejorar la IA" es opinión.
3. **Resumen de conversación independiente del análisis** (chats largos).
4. **Forzar `response_format` JSON** ya está en el análisis; mantenerlo y validar `confidence` (ya se hace).
5. **Catálogo grande:** el *retrieval* por relevancia ya está; para Pro con cientos de ítems, evaluar embeddings si el keyword-match se queda corto.
6. **Reforzar el fallback** "no inventes": ya existe y es bueno; el modelo fuerte lo respeta mucho mejor.
7. **No tocar** el anti-alucinación ni el orden de resolución: están bien.

---

## 12. Aumentar ventas (que el bot venda, no que conteste)

- El motor de ventas **ya está en el prompt** (señales de compra, objeción de precio, cross-sell, anclaje, CTA, captura de lead). Con C1 resuelto, **rinde mucho más**.
- **Seguimiento automático** (roadmap 6m): el 80% de las ventas perdidas son por no insistir una vez. Recordatorios y reactivación traen revenue directo.
- **Link de pago MercadoPago en el chat** para cerrar dentro de WhatsApp.
- **Captura de lead siempre que falte un dato:** ya está en las reglas; asegurar que el lead llegue al panel y al dueño por WhatsApp.
- **Promos con urgencia real** (fecha de fin): ya soportado; empujar su uso desde la UI.

---

## 13. Aumentar retención

- **Panel de valor semanal + push/WhatsApp** (la razón #1 por la que alguien no cancela: ve que le sirve).
- **Alertas proactivas de caída de conexión** (un bot caído sin aviso = cancelación segura).
- **Resumen de "leads que atendiste durmiendo"** los lunes: emoción + evidencia de valor.
- **Salud del asistente:** avisar si el catálogo está incompleto o si hay muchas "consultas pendientes" sin cargar (el dueño mejora el bot y se engancha).
- **Onboarding de activación** que garantice el primer éxito (la retención se gana o se pierde en los primeros 7 días).

---

## 14. Aumentar upgrades (Starter → Growth → Pro)

- **Límites que se sienten en el momento justo:** al llegar a 10 productos (Starter), mostrar "desbloqueá 50 con Growth" en contexto, no en una página de precios.
- **Agenda de turnos y avisos al encargado** son features Growth de alto deseo: mostrarlas como "probá esto" con upgrade in-app.
- **Métricas avanzadas y plantillas premium** como gancho de Pro.
- **Upgrade self-serve in-app** (sin hablar con nadie) — hoy todo pasa por planes; bajá la fricción.
- **Anclaje de precio:** Growth como "más popular" (ya está) y mostrar el ahorro anual (20%, ya calculado) de forma prominente.

---

## 15. Recomendaciones técnicas SEGURAS (hacer)

- Cambiar `AI_REPLY_MODEL` por env var (sin tocar código).
- Priorizar Pairing Code en la UI (la lógica ya existe).
- Anclar handoff a la señal estructurada del análisis.
- Independizar el resumen de conversación.
- Golden set de IA + embudo instrumentado.
- Panel de valor reusando datos ya logueados.
- Alertas de conexión.
- Mover estado del worker a Postgres/Redis **antes** de escalar réplicas (planificado, probado en staging).

## 16. NO implementar (riesgo > beneficio ahora)

- **No reescribir el prompt ni el motor anti-alucinación:** están bien; un rediseño introduce regresiones.
- **No escalar el worker a 2+ réplicas** hasta resolver el estado en RAM (C2) → respuestas duplicadas garantizadas.
- **No prometer multi-número** hasta tener multi-sesión real (bien que ya se quitó del copy).
- **No migrar a la API oficial de Meta "por las dudas"** sin decisión estratégica: cambia el modelo de negocio (fees por mensaje, aprobación, onboarding más lento). Es una decisión de fundador, no un fix técnico.
- **No meter scraping/links externos como flujo principal:** el catálogo estructurado da mejor precisión. Mantener el scraping opt-in/secundario.
- **No rediseñar la UI entera:** es pulido incremental, no reconstrucción.
- **No tocar** dedupe, `last_inbound_jid`/`remoteJid`, buffer, MercadoPago, login, trial, límites de plan ni multi-tenant fuera de los cambios acotados descritos.

---

## Anexo A — Análisis comercial y de pricing

**Precios actuales en el código (ARS/mes):** Starter $29.000 · Growth $59.000 · Pro $99.000. Trial 14 días en Growth, 20% off anual.
**Precios que proponés:** Starter $49.000 · Growth $89.000 · Pro $149.000 (suba de ~50–70%).

**Competencia (USD/mes, 2026):** Wati $59–279 · respond.io $79–349 (+ por contacto activo) · Interakt (trimestral/anual, low-cost) · Zoko (Shopify). **Todos usan la API oficial de Meta:** aprobación, fees por mensaje (~20% sobre tarifa Meta), y son más CRM/complejos.

**Diferencial de Atendé:** conexión instantánea sin Meta (Baileys), **sin fee por conversación**, español rioplatense nativo, mobile-first, posicionamiento "vendedor automático" (no "chatbot/CRM"). Para un comerciante LATAM, eso es más simple y más barato de operar.

**¿Se justifica subir a $49k/$89k/$149k?** Sí, **pero condicionado a resolver C1 (modelo) y C4 (activación) primero.** Hoy, con `gpt-4o-mini`, una suba de precio sin subir calidad aumenta el churn. Secuencia recomendada:
1. Resolver C1 (calidad real) y C5 panel de valor.
2. Subir precio **para clientes nuevos** (grandfathering a los actuales = buena señal y retención).
3. Comunicar la suba con las nuevas features (valor visible), no en silencio.

A $49k/$89k/$149k ARS (~USD $40/$74/$124 al cambio de ~1.200), Atendé queda **alineado con Wati/respond.io en USD pero mucho más simple de operar**, lo cual es defendible si la calidad acompaña.

**Qué falta para justificar esos precios:** (1) IA que claramente no inventa, (2) panel que muestre el dinero/tiempo ganado, (3) confiabilidad de conexión visible, (4) seguimientos automáticos (lo que de verdad trae ventas).

---

## Anexo B — Mapa de riesgos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Baneo de número WhatsApp (Baileys) | Crítico | Anti-ban (ya), alertas, calentamiento, términos |
| Worker en RAM no escala | Alto | Postgres/Redis antes de 2+ réplicas |
| IA débil percibida como "inventa" | Alto | Modelo fuerte + golden set |
| Trial→pago bajo por activación | Alto | Onboarding hasta primer éxito |
| Costo de IA erosiona margen | Medio | mini en análisis, fuerte sólo en respuesta; medir |
| Dependencia de un solo proveedor LLM | Medio | SDK ya compatible con OpenRouter (multi-modelo) |

---

*Documento de diagnóstico. Ningún cambio fue aplicado al código. Próximo paso sugerido: aprobar los Quick Wins Q1–Q5 (semana 1–2) y montar el embudo de activación para medir el efecto.*
