# Escalera de conversiones → Meta (WhatsApp)

**Estado (2026-10-21):** código listo, **sin commitear ni deployar**.

- Hecho: dataset `1147783157674161` creado en la WABA `1196537218554691`; migración aplicada en KaWa (129 contactos con `wa_ref`); en Vercel `kawasa` están cargadas `META_CAPI_ACCESS_TOKEN`, `META_DATASET_ID`, `KAWA_ATTRIBUTION_SECRET` y `CRON_SECRET`, y en `appoint` `KAWA_ATTRIBUTION_SECRET` (las claves también están en el Keychain: `codex-kawa-attribution-secret`, `codex-kawa-cron-secret`).
- Un `test_event_code` que no coincide con una sesión abierta de «Probar eventos» hace que Meta procese el evento **como real**. Por eso se borró `META_TEST_EVENT_CODE=TEST_KAWA` de `kawasa` (2026-10-21).
- La venta del 2026-10-14 ya llegó a Meta el 2026-10-21 como `Purchase` ARS 18.000 (fbtrace `AwNm4psK0-x-OCx4IJhpcWr`) por esa prueba. Su fila (`Subscribe`) quedó marcada `sent` para que el reintento no la duplique (Meta no deduplica).
- **Modo prueba de verdad:** abrir Events Manager → dataset → «Probar eventos», copiar el código que muestra y cargarlo como `META_TEST_EVENT_CODE` con la pestaña abierta. Al terminar de probar, borrar la variable y redeployar.

Para qué sirve: que Meta sepa qué personas que escribieron desde el anuncio valieron la pena y busque más gente así. Usa la [Conversions API for Business Messaging](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging) (`action_source=business_messaging`, `messaging_channel=whatsapp`, atribución por `ctwa_clid`).

## Escalones

| # | Evento Meta | Cuándo se marca (solo) | Dónde |
|---|---|---|---|
| 1 | (conversación) | Escribe desde el anuncio | Meta lo cuenta solo |
| 2 | `QualifiedLead` | Vino de un anuncio (≤7 días) y en un mensaje nombra una profesión | `src/services/attribution/qualify-lead.ts` |
| 3 | `InitiateCheckout` | Abre `/suscribirse` desde su link personal `agendapp.com.ar/empezar?wa=<código>` | AgendApp → `POST /api/attribution/events` |
| 4 | `Purchase` (ARS 18.000) | Paga la primera cuota con ese link | Webhook de pagos de AgendApp → `POST /api/attribution/events` |

- Meta **no acepta** `Lead` ni `Subscribe` en business_messaging. Las filas viejas con esos nombres salen como `QualifiedLead` / `Purchase` (`toMetaEventName`).
- Arrastrar en el kanban a **Lead** o **Ganado** manda el mismo evento. `event_id = {contactId}:{Evento}`, así que el automático y el manual no se duplican (Meta no deduplica estos eventos).
- Sin `ctwa_clid` (no vino de un anuncio) la conversión queda `skipped`.
- Contra las 15 charlas del anuncio de octubre, la regla de profesión habría marcado 10.

## Link personal

Cada contacto tiene `contacts.wa_ref` (8 hex, aleatorio, sin PII). En `/crm` cada tarjeta tiene «Copiar link para mandarle». AgendApp guarda el código en cookie (`agendapp_wa`, 30 días) y lo lleva a `mp_checkout_intents.utms.wa`.

Si se manda el link genérico `/empezar` (sin código), los escalones 3 y 4 no se pueden atribuir a la persona.

## Piezas

| Pieza | Path |
|---|---|
| Envío a Meta + reintentos | `src/services/attribution/meta-capi.ts` |
| Registrar (idempotente) y mandar | `src/services/attribution/record-conversion.ts` |
| Escalón 2 automático | `src/services/attribution/qualify-lead.ts` (desde `handlers/incoming-message.ts`) |
| Endpoint para AgendApp | `src/app/api/attribution/events/route.ts` (Bearer `KAWA_ATTRIBUTION_SECRET`) |
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
