# Escalera de conversiones → Meta (WhatsApp)

**Estado (2026-10-22):** deployado y mandando (`Purchase` e `InitiateCheckout` del 2026-10-21 llegaron a Meta). Desde 2026-10-22 AgendApp también reconoce a la persona por el **teléfono** de `/suscribirse` cuando llega por el link genérico `/empezar` (el que manda el agente de Kapso).

- Hecho: dataset `1147783157674161` creado en la WABA `1196537218554691`; migración aplicada en KaWa (129 contactos con `wa_ref`); en Vercel `kawasa` están cargadas `META_CAPI_ACCESS_TOKEN`, `META_DATASET_ID`, `KAWA_ATTRIBUTION_SECRET` y `CRON_SECRET`, y en `appoint` `KAWA_ATTRIBUTION_SECRET` (las claves también están en el Keychain: `codex-kawa-attribution-secret`, `codex-kawa-cron-secret`).
- Un `test_event_code` que no coincide con una sesión abierta de «Probar eventos» hace que Meta procese el evento **como real**. Por eso se borró `META_TEST_EVENT_CODE=TEST_KAWA` de `kawasa` (2026-10-21).
- La venta del 2026-10-14 ya llegó a Meta el 2026-10-21 como `Purchase` ARS 18.000 (fbtrace `AwNm4psK0-x-OCx4IJhpcWr`) por esa prueba. Su fila (`Subscribe`) quedó marcada `sent` para que el reintento no la duplique (Meta no deduplica).
- **Modo prueba de verdad:** abrir Events Manager → dataset → «Probar eventos», copiar el código que muestra y cargarlo como `META_TEST_EVENT_CODE` con la pestaña abierta. Al terminar de probar, borrar la variable y redeployar.

Para qué sirve: que Meta sepa qué personas que escribieron desde el anuncio valieron la pena y busque más gente así. Usa la [Conversions API for Business Messaging](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging) (`action_source=business_messaging`, `messaging_channel=whatsapp`, atribución por `ctwa_clid`).

## Escalones

| # | Evento Meta | Cuándo se marca (solo) | Dónde |
|---|---|---|---|
| 1 | (conversación) | Escribe desde el anuncio | Meta lo cuenta solo |
| 2a | `LeadSubmitted` | Vino de un anuncio (≤7 días) y **dice a qué se dedica** (misma regla que `QualifiedLead`). Es el que usa la campaña de leads por WhatsApp (EXP-003) para optimizar. Del 2026-10-24 al 2026-10-25 salía con cualquier respuesta y le mandó a Meta un audio con un link de Facebook como lead: se volvió atrás | `maybeQualifyLead` en `src/services/attribution/qualify-lead.ts` |
| 2b | `QualifiedLead` | Vino de un anuncio (≤7 días) y en un mensaje nombra una profesión. Si la nombra antes de que le escribamos, también sale `LeadSubmitted` (mismo `event_id`, no se duplica) | `maybeQualifyLead` en `src/services/attribution/qualify-lead.ts` |
| 3 | `InitiateCheckout` | Abre `/suscribirse` desde su link personal `agendapp.com.ar/empezar?wa=<código>`, o manda el formulario de `/suscribirse` con el mismo WhatsApp desde el que escribió | AgendApp → `POST /api/attribution/events` (`ref` o `phone`) |
| 4 | `Purchase` (ARS 18.000) | Paga la primera cuota (link personal o mismo WhatsApp) | Webhook de pagos de AgendApp → `POST /api/attribution/events` (`ref` o `phone`) |

- Meta **no acepta** `Lead` ni `Subscribe` en business_messaging. Las filas viejas con esos nombres salen como `QualifiedLead` / `Purchase` (`toMetaEventName`).
- Arrastrar en el kanban a **Lead** o **Ganado** manda el mismo evento. `event_id = {contactId}:{Evento}`, así que el automático y el manual no se duplican (Meta no deduplica estos eventos).
- Sin `ctwa_clid` (no vino de un anuncio) la conversión queda `skipped`.
- **Por qué `LeadSubmitted` al contestar (2026-10-24):** del 22 al 24-oct EXP-003 no recibió ningún `LeadSubmitted` (0 de 6 leads contestaron el primer mensaje, así que nadie llegó a decir su profesión) y Meta optimizaba sin señal. El cuello de botella es que contesten. Aun así, con USD 4/día (~3–4 conversaciones por día) no llega a los ~50 eventos semanales que pide Meta para salir de aprendizaje.
- Formas cortas de profesión desde 2026-10-24 («kine», «nutri», «psico», «fono», «fisio», «cejas», «nails»…): cuentan solo al principio de una palabra (`PROFESSION_WORD_STARTS`), para que «fono» no matchee «teléfono».
- La regla de profesión suma «depila» y «constelacion» desde 2026-10-22 (contra las 15 charlas de octubre habría marcado 10 de 12 sin ellas). Aprendizajes de esas charlas: `nuevonext/MARKETING/whatsapp/aprendizajes-conversion.md`.

- 2026-10-22: se mandaron a mano `QualifiedLead` + `LeadSubmitted` de 4 leads del 17 al 19-oct (dentro de los 7 días que acepta Meta), con la hora real del mensaje (`custom_data.source = backfill_2026-10-22`).
- El dataset `1147783157674161` está atado a la WABA. Para usarlo en un conjunto de anuncios a WhatsApp va en `promoted_object` (`pixel_id` = dataset, `custom_event_type` = `LEAD`); no aparece en `adspixels` de la cuenta publicitaria y no hizo falta compartirlo.

## Link personal

Cada contacto tiene `contacts.wa_ref` (8 hex, aleatorio, sin PII). En `/crm` cada tarjeta tiene «Copiar link para mandarle». AgendApp guarda el código en cookie (`agendapp_wa`, 30 días) y lo lleva a `mp_checkout_intents.utms.wa`.

Con el link genérico `/empezar` (sin código) los escalones 3 y 4 se atribuyen por teléfono: el WhatsApp del formulario se compara con `contacts.phone_number` (`argentinePhoneCandidates` en `src/utils/phone.ts`: acepta +54 9…, 011 15…, 10 dígitos) y solo cuenta si ese contacto escribió desde un anuncio. Si la persona pone otro número, no se atribuye.

## Piezas

| Pieza | Path |
|---|---|
| Envío a Meta + reintentos | `src/services/attribution/meta-capi.ts` |
| Registrar (idempotente) y mandar | `src/services/attribution/record-conversion.ts` |
| Escalón 2 automático | `src/services/attribution/qualify-lead.ts`: `maybeQualifyLead` (desde `handlers/incoming-message.ts`) |
| Endpoint para AgendApp | `src/app/api/attribution/events/route.ts` (Bearer `KAWA_ATTRIBUTION_SECRET`; `ref` o `phone`) |
| Quién contesta en WhatsApp | `src/app/api/kapso/route-inbound/route.ts` + `src/services/routing/route-inbound.ts` (Bearer `KAPSO_ROUTER_SECRET`). Lo consulta la Kapso Function del agente de ventas: agente si escribió desde un anuncio (desde `AGENT_LIVE_SINCE`, ≤14 días), silencio si la charla está en handoff (≤7 días), en ganado/perdido o no viene de un anuncio; `saludo` si todavía no le escribimos: Kapso manda el primer mensaje fijo del A/B (`opening-variants.ts`, tabla `opening_messages`, resultados en la vista `opening_message_summary`) |
| Reintento diario | `src/app/api/attribution/flush/route.ts` + `vercel.json` (12:00 UTC, Bearer `CRON_SECRET`) |
| Migración | `supabase/migrations/20261021211643_capi_business_messaging.sql` |
| AgendApp | `src/lib/waRef.ts`, `src/lib/kawaAttribution.ts`, `src/app/api/whatsapp-link/open/route.ts`, webhook `paySuscribe` |

## Deploy (en orden, cada paso con OK)

1. **Meta:** `POST /1196537218554691/dataset` (WABA de AgendApp) → `META_DATASET_ID`. Devuelve el existente si ya hay uno. El token System User ya tiene `whatsapp_business_management` y `whatsapp_business_manage_events`.
2. **KaWa Supabase:** aplicar la migración.
3. **Vercel KaWa:** `META_CAPI_ACCESS_TOKEN`, `META_DATASET_ID`, `KAWA_ATTRIBUTION_SECRET`, `CRON_SECRET`. Primero con `META_TEST_EVENT_CODE` para ver los eventos en «Probar eventos» sin que cuenten.
4. **Vercel AgendApp:** `KAWA_ATTRIBUTION_SECRET` (el mismo valor). Opcional `KAWA_ATTRIBUTION_URL` (default `https://kawasa.vercel.app`).
5. Deploy KaWa, después AgendApp.
6. `GET /api/attribution/flush` manda lo pendiente (incluida la venta del 2026-10-14, si Meta todavía la acepta).
7. **Campaña:** según la guía de Meta, en anuncios a WhatsApp la Conversions API habilita optimizar **por compra**. Con ~1 compra por semana no alcanza para que aprenda bien: la campaña sigue optimizando por conversaciones, y los eventos sirven como señal y para medir. Cambiar el objetivo obliga a crear un conjunto nuevo: solo con pedido explícito.
