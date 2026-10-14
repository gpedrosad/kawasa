# AI Learning — Kawasa / Kapso CRM

Documento vivo para agentes de IA (y humanos) que trabajen en este repo.
Complementa el `README.md`: acá va **contexto de decisiones, estado real y lecciones**, no tutorial genérico.

**Repo:** [github.com/gpedrosad/kawasa](https://github.com/gpedrosad/kawasa)  
**Producción:** [kawasa.vercel.app](https://kawasa.vercel.app)  
**Última actualización de este doc:** 2026-08-01 (CRM kanban + fix hydration fechas)

---

## 1. Qué es este proyecto

Base Next.js 15 (App Router) + TypeScript para un CRM sobre **Kapso** (WhatsApp Cloud API con Coexistence).

Hoy es una **base operativa** (enviar mensajes + recibir webhooks firmados), no un CRM completo con UI/DB/IA.

**Producto:** [`docs/PRODUCT_AGENDAPP.md`](PRODUCT_AGENDAPP.md) (hechos).  
**Flujo primer contacto qualify→audio (solo doc, no cierre, no implementar):** [`docs/KAPSO_WHATSAPP_QUALIFY.md`](KAPSO_WHATSAPP_QUALIFY.md).

| Capa | Estado |
|------|--------|
| Cliente Kapso + env Zod | Listo |
| `POST /api/whatsapp/send-text` / `send-audio` | Listo |
| `POST /api/webhooks/kapso` + HMAC | Listo |
| Handlers de webhook | Log + automatización `supp` → nota de voz |
| Repositories / Supabase KaWa | Schema 3 tablas + persist incoming |
| AI providers | Stubs |
| UI CRM / funnel kanban | `/crm` — drag etapas; Lead/Ganado → conversion |

---

## 2. Identidades y entorno (no secretos)

### Kapso

| Concepto | Valor |
|----------|--------|
| Proyecto | `Default project` (`08b675a2-78d0-43b6-a64e-86f65c83fe19`) |
| Número prod | **Agendapp** — `phone_number_id`: `623041330889329` |
| Display | `+54 9 11 3301-7403` |
| Tipo | Coexistence, `CONNECTED` |
| Sandbox | También existe (`597907523413541`) — no es el de prod |
| Link local | `.kapso/project.json` + `kapso.yaml` |

### Vercel

| Concepto | Valor |
|----------|--------|
| Team | `Gonzalo's projects` (`team_IcBo6Pb7AzKFUcBUEaxYG4PK`) |
| Project | `kawasa` (`prj_OeiclujtlSIge9brdSoZDOAx00AB`) |
| Dominio prod | `https://kawasa.vercel.app` |
| Deploy de referencia | commit `e884d49` en `main` |

### Git

- Remoto: `https://github.com/gpedrosad/kawasa.git`
- Branch de prod: `main` (push → redeploy Vercel)

### Supabase — SOLO proyecto KaWa

**Regla dura:** en este repo solo se trabaja contra Supabase **KaWa**. Nunca contra Agendapp u otros.

| Campo | Valor |
|-------|--------|
| Nombre | **KaWa** |
| Project ref | `dkpihigjlifjvxiszkew` |
| URL | `https://dkpihigjlifjvxiszkew.supabase.co` |
| MCP | `https://mcp.supabase.com/mcp?project_ref=dkpihigjlifjvxiszkew` |
| CLI link | `supabase/.temp/project-ref` → `dkpihigjlifjvxiszkew` |
| Cursor rule | `.cursor/rules/supabase-kawa-only.mdc` (`alwaysApply`) |

**Prohibido:** `yflufqybchxrqvscnwyo` (Agendapp / “gpedrosad's Project”). Fue el MCP por error al inicio; no migrar, no leer keys de prod, no aplicar SQL ahí.

Checklist antes de tocar DB:

1. `get_project_url` (MCP) → debe ser `https://dkpihigjlifjvxiszkew.supabase.co`
2. Si no: corregir MCP / `supabase link --project-ref dkpihigjlifjvxiszkew` y reautenticar
3. Recién ahí `list_tables` / migraciones / repos

#### Schema minimalista (CRM + atribución Meta)

```text
contacts 1──* conversations 1──* messages
     │              │                └── media en messages.media (jsonb)
     │              └── 1 ad_touches (first-touch CTWA)
     └──* conversions (pending → futuro Meta CAPI)
              └── opcional FK ad_touch_id
```

| Tabla | Rol |
|-------|-----|
| `contacts` | phone único, nombre, metadata |
| `conversations` | `id` = Kapso conversation UUID, FK contact |
| `messages` | `provider_message_id` = wamid (único), direction, type, text, media jsonb |
| `ad_touches` | First-touch Meta CTWA (`ctwa_clid`, campaign/ad ids, utm, raw) |
| `conversions` | Eventos (`Lead`, `Purchase`, …) con `event_id` para dedup CAPI; `status=pending` hasta envío |

- RLS on, **sin policies anon** → solo `service_role` desde el server.
- Migraciones: `supabase/migrations/20260801054000_*` y `20260801054500_add_meta_ads_attribution.sql`
- Persistencia webhook: `src/services/crm/persist-incoming.ts` (+ `persistAdTouch` si hay `referral`)
- Registrar conversión (sin enviar aún): `recordConversion()` en `src/services/attribution/`
- Cliente admin: `src/lib/supabase.ts`
- Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (también en Vercel prod)

**Flujo Meta Ads (CTWA) — parcialmente listo**

1. Usuario toca Click-to-WhatsApp ad → mensaje trae `referral.ctwa_clid`
2. Guardamos `ad_touches` (first-touch por conversación, `channel=ctwa`)
3. Cuando haya lead/compra: `recordConversion({ eventName: 'Lead', conversationId })`
4. Luego un worker/CAPI marcará `conversions.status = sent` y optimizará el ad set en Ads Manager

**Atribución desde WEB — NO implementar hasta que el usuario lo pida**

Problema: desde la web **no** llega `referral` de Meta. Hay que inyectar el origen.

Diseño acordado (cuando se pida):

1. Endpoint ej. `POST /api/attribution/web` (o `GET` redirect):
   - Input: `utm_*`, `fbclid`, opcional `_fbc`/`_fbp`, landing path
   - Crea fila en `ad_touches` con `source=meta|web`, `channel=web`, `utm`, raw; genera código corto `ref` (ej. `w_8f3a2c`)
   - Devuelve / redirige a:
     `https://wa.me/541133017403?text=Hola%20ref%3Aw_8f3a2c`
2. En webhook (`persist-incoming` / attribution):
   - Parsear primer mensaje con patrón `ref:w_XXXX` (o similar)
   - Matchear `ad_touches` por ese código (puede hacer falta columna `ref_code text unique` en `ad_touches`)
   - Vincular `contact_id` + `conversation_id` al touch web
3. Conversiones igual que CTWA: `recordConversion` → luego CAPI

Alternativa frágil (no preferida): meter UTMs crudos en el `text` del `wa.me` sin fila previa en DB.

Schema tip: hoy `ad_touches` ya tiene `channel` + `utm`; al implementar, agregar `ref_code` unique nullable.

Botón web típico:

```html
<!-- Ideal: pegar a /api/attribution/web?utm_source=site&utm_campaign=home -->
<a href="https://kawasa.vercel.app/api/attribution/web?utm_source=site&utm_campaign=home">
  Escribinos por WhatsApp
</a>
```

---

## 3. Variables de entorno

Requeridas (servidor **nunca** `NEXT_PUBLIC_*`):

```env
KAPSO_API_KEY=...
KAPSO_PHONE_NUMBER_ID=623041330889329
KAPSO_WEBHOOK_SECRET=...   # debe coincidir con secret_key del webhook en Kapso
```

Opcionales: `KAPSO_BASE_URL`, `LOG_LEVEL`.

- Local: `.env.local` (gitignored vía `.env*`)
- Prod: configuradas en Vercel Project Settings → Environment Variables
- Validación: `src/config/env.ts` (Zod). Si falta algo crítico, falla con mensaje claro.

### Secretos — reglas aprendidas

1. **Nunca** commitear `.env.local` ni `.cursor/mcp.json` si tiene Bearer hardcodeado.
2. `.cursor/mcp.json` está en `.gitignore`. Usar `.cursor/mcp.api-key.example.json` con `${env:KAPSO_API_KEY}`.
3. El CLI `kapso whatsapp webhooks list` **devuelve `secret_key` en claro** — no pegar ese output en issues/PRs/docs públicos.
4. Si una key se expuso (chat, commit, MCP config), **rotarla** en el dashboard Kapso.

---

## 4. Flujo de producción actual

```text
WhatsApp user
    → Meta / Kapso
    → POST https://kawasa.vercel.app/api/webhooks/kapso
         headers: X-Webhook-Signature (HMAC SHA256), X-Webhook-Event, ...
    → verifyKapsoWebhookSignature(rawBody, secret)
    → handleWebhook → handlers (hoy: logger.info)
```

Webhook Kapso (Agendapp):

- ID: `6a2be184-1960-44cc-8ef8-a1bbbc1391aa`
- URL prod: `https://kawasa.vercel.app/api/webhooks/kapso`
- Eventos: `message.received|sent|delivered|read|failed` + `conversation.created|ended|inactive`
- `payload_version`: `v2`

Envío saliente:

```text
Cliente/API → /api/whatsapp/send-text|send-audio
           → services/whatsapp/*
           → @kapso/whatsapp-cloud-api (baseUrl Kapso)
```

---

## 5. Mapa de código relevante

```text
src/
  config/env.ts                 # Zod + cache de env
  lib/kapso.ts                  # singleton WhatsAppClient
  lib/logger.ts                 # logger (console en dev)
  app/api/webhooks/kapso/       # raw body + firma + dispatch
  app/api/whatsapp/send-*/      # HTTP thin wrappers
  services/whatsapp/            # lógica de envío / media / read
  services/webhooks/            # normalize + handleWebhook + handlers
  services/ai/                  # stubs OpenAI/Anthropic/Gemini
  repositories/interfaces/      # puertos Contact/Conversation/Message/Media
  utils/webhook-signature.ts    # HMAC + timingSafeEqual
  utils/phone.ts                # E.164-ish validation
```

Handlers importantes (extender acá, no en la route):

- `handlers/incoming-message.ts` — mensajes entrantes
- `handlers/status.ts` — sent/delivered/read/failed
- `handlers/conversation.ts` — created/ended/inactive/updated

---

## 6. Lecciones de sesión (2026-08-01)

### Kapso “listo” ≠ app recibiendo

Estaban OK: API key, phone number, secret, webhook events, código.  
Faltaba el **puente público**:

1. Tunnel Cloudflare (`trycloudflare.com`) apuntaba a un host muerto → HTTP **530**.
2. Puerto `3000` local tenía otro proyecto (`katia`), no este repo.

**Aprendizaje:** para webhooks locales hace falta `npm run dev` de *este* repo + tunnel vivo + URL del webhook actualizada. En prod, URL estable (Vercel) es mejor.

### Deploy Vercel

1. Push a `main` en `gpedrosad/kawasa`.
2. Import en Vercel con env vars.
3. Actualizar webhook Kapso:

```bash
kapso whatsapp webhooks update <WEBHOOK_ID> \
  --phone-number-id 623041330889329 \
  --url "https://kawasa.vercel.app/api/webhooks/kapso" \
  --active
```

### Smoke tests útiles

| Check | Resultado esperado |
|-------|--------------------|
| `GET /` | 200 |
| `POST /api/webhooks/kapso` sin firma | **401** `Firma de webhook inválida` |
| `GET /api/webhooks/kapso` | **405** (solo POST) |
| 401 en smoke test | Buena señal: env cargó y la firma se valida |

Si faltaran env en Vercel, el fallo sería distinto (error al parsear env / 500), no el 401 de firma.

### Primer mensaje real en prod (verificado)

`2026-08-01T05:33:11Z` — `POST /api/webhooks/kapso` → **200**

- Log: `Mensaje entrante recibido`
- `from`: `56968257817` (conversación Kapso de Gonzalo Pedrosa)
- `type`: `text`, preview: `Supp`
- `conversationId`: `a6b07696-6c87-420a-b8ff-b989003d83fe`
- Sin runtime errors

Conclusión: firma, env Vercel, URL webhook y handler están OK end-to-end. Lo que falta es lógica de negocio (persistir / responder / CRM).

### MCP / CLI

- MCP Kapso en Cursor: server `kapso` / `user-kapso` (`https://api.kapso.ai/mcp`).
- MCP Vercel: team + `get_project` / `get_runtime_logs` / `get_runtime_errors`.
- CLI: `@kapso/cli` — `kapso status`, `whatsapp numbers list`, `whatsapp webhooks *`.
- Auth CLI/MCP: API key del proyecto (modo `api_key`).

---

## 7. Cómo debuggear producción

### Vercel (MCP o dashboard)

- Project ID: `prj_OeiclujtlSIge9brdSoZDOAx00AB`
- Team ID: `team_IcBo6Pb7AzKFUcBUEaxYG4PK`
- Tools útiles: `get_runtime_logs` (`since: "30m"`, `query: "webhook"`), `get_runtime_errors`
- Inspector deploy: Vercel → proyecto `kawasa` → Deployments

Qué buscar en logs tras un WhatsApp real:

- `Mensaje entrante recibido` (handler)
- `Firma de webhook Kapso inválida` → secret mismatch entre Kapso y Vercel
- Errores Zod de env → falta variable en Vercel

### Kapso

```bash
kapso whatsapp webhooks list --phone-number-id 623041330889329
kapso whatsapp conversations list --phone-number-id 623041330889329
kapso whatsapp messages send --phone-number-id 623041330889329 --to "+54911..." --text "ping"
```

---

## 8. Decisiones de diseño a respetar

1. **Secretos solo servidor** — sin `NEXT_PUBLIC_KAPSO_*`.
2. **Routes HTTP delgadas** — lógica en `services/`.
3. **Webhook verifica firma sobre raw body** — no parsear JSON antes de HMAC.
4. **Tipado estricto** — evitar `any`; normalizar payloads en `normalize.ts`.
5. **Repositories como puertos** — persistencia (Supabase KaWa) sin acoplar handlers al vendor.
6. **AI desacoplada** — `AiProvider` + factory; no hardcodear un vendor en el webhook.
7. **CRM funnel** en `/crm` (kanban); detalle inbox y auth siguen pendientes.
8. **Supabase = solo KaWa** (`dkpihigjlifjvxiszkew`). Ver §2 y regla Cursor.
9. **Fechas en UI client/SSR:** usar `formatDateTimeAr` — no `Intl` `es-AR` suelto (hydration).

---

## 8b. CRM kanban (`/crm`)

Doc completo: [`CRM_FUNNEL.md`](CRM_FUNNEL.md).

Etapas: `nuevo` → `calificado` → `interesado` → `lead` → `ganado` / `perdido`

- Drag & drop → `PATCH /api/crm/conversations/[id]/stage`
- `lead` → conversión `Lead`; `ganado` → `Subscribe` (`conversions.status=pending`)
- `event_id` = `{conversationId}:{EventName}`
- **Con clave** (2026-10-14): `src/middleware.ts` pide Basic Auth con `CRM_PASSWORD` para todo (páginas, `/api/crm/*`, `/api/whatsapp/*`). Quedan públicos solo `/api/webhooks/*` (HMAC) y `/sounds/*` (Meta descarga el audio). Sin `CRM_PASSWORD` no entra nadie. El repo es público: la clave nunca va en el código.
- Local: http://localhost:3000/crm · Prod: https://kawasa.vercel.app/crm

### Lección: hydration en fechas del kanban

`Intl.DateTimeFormat("es-AR")` produjo mismatch SSR/cliente (`a. m.` / espacios distintos).  
Fix: `src/utils/datetime.ts` → `formatDateTimeAr` con `timeZone: America/Argentina/Buenos_Aires` + `hourCycle: h23`.

## 8c. Automatización: “supp” → nota de voz

Trigger (case-insensitive, opcional `!?.` al final): texto exacto `supp`.

Flujo:

1. `handleIncomingMessage` detecta con `isSuppTrigger`
2. `markAsRead` (+ typing indicator best-effort)
3. `sendAudio({ voice: true, audioUrl })` → WhatsApp muestra **burbuja de nota de voz**, no archivo adjunto

Archivos:

- Audio OPUS/OGG: `public/sounds/supp-voice.ogg`
- Lógica: `src/services/automations/supp-voice.ts`
- URL pública: `APP_URL` o `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` + `/sounds/supp-voice.ogg`
- Override: `SUPP_VOICE_AUDIO_URL`

Importante: `voice: true` es lo que hace que Meta lo trate como audio grabado (PTT), no como documento/archivo de sonido. El archivo debe ser OGG/OPUS.

## 8d. Chats completos para leer o analizar con IA (2026-10-14)

KaWa guarda **las dos direcciones**:

- Entrantes: `message.received` → `persist-incoming.ts`.
- Salientes (flujo Kapso, API o escritos desde la app): `message.sent/delivered/read/failed` → `handlers/status.ts` → `persist-outbound.ts`. El primer evento crea la fila; los siguientes solo suben `status`.
- Origen en `messages.raw->kapso->>origin`: `cloud_api` (flujo/API), `business_app` (Gonzalo desde la app), `history_sync` (historial importado).
- Historial y huecos: `npm run sync:kapso` (o `-- --since=YYYY-MM-DD`). Idempotente por wamid, respeta el 429 de Kapso.

Kapso cierra la conversación tras 60 min sin mensajes (`inactivity_minutes` del webhook) y abre otra: **una charla = un contacto, no un `conversation_id`**. Por eso las vistas agrupan por contacto:

| Vista | Para qué |
|-------|----------|
| `chat_threads` | Una fila por contacto: `transcript` (charla entera en texto, hora AR, autor), `ad_headline`/`ad_url`, `inbound_count`/`outbound_count`, `last_author`, `waiting_for_us`, `stage`. |
| `chat_messages` | Un mensaje por fila con `author` (`contacto` / `bot_api` / `gonzalo_app`) y `body` limpio (audios con transcripción). |

Migración: `supabase/migrations/20261014180000_chat_views_for_ai.sql` (`security_invoker`, solo service_role).

Ejemplo (REST con service role):

```bash
curl -s "$SUPABASE_URL/rest/v1/chat_threads?select=profile_name,ad_headline,waiting_for_us,last_message_at,transcript&ad_headline=not.is.null&last_message_at=gte.2026-10-11&order=last_message_at.desc" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## 9. Deuda / próximos pasos sugeridos

Orden razonable:

1. Deploy código + env Supabase en Vercel; verificar persistencia en KaWa.
2. Idempotencia con `X-Idempotency-Key`.
3. Auth en `/api/whatsapp/*`.
4. Meta CAPI (enviar `conversions` pending) + atribución web si se pide.
5. Auth en `/crm` + inbox del hilo (hoy kanban sin login).

---

## 10. Checklist “¿está andando Kapso?”

- [x] Cuenta/proyecto Kapso + API key
- [x] Número Agendapp CONNECTED (Coexistence)
- [x] `.env.local` / env Vercel con las 3 vars
- [x] Código webhook + send services
- [x] Repo en GitHub + deploy Vercel Ready
- [x] Webhook URL = `https://kawasa.vercel.app/api/webhooks/kapso`
- [x] Secret webhook Kapso = `KAPSO_WEBHOOK_SECRET` en Vercel
- [x] Mensaje real entrante verificado en runtime logs (`Supp` → 200)
- [x] Respuesta automática mínima: texto `supp` → nota de voz
- [x] Persistencia KaWa (contacts / conversations / messages)
- [x] Atribución CTWA (`ad_touches`) + cola `conversions` (pending, sin CAPI aún)
- [x] CRM kanban `/crm` (drag → stage → conversión Lead/Subscribe)
- [ ] Auth en `/crm` + inbox del hilo
- [ ] Atribución WEB (`ref:` + `/api/attribution/web`) — documentado; **no hasta pedido explícito**
- [ ] Envío Meta Conversions API

---

## 11. Cómo mantener este documento

Cuando se haga un cambio relevante (nuevo servicio, DB, auth, bug de prod, rotación de keys, cambio de dominio/webhook), **actualizar este archivo en el mismo PR/commit** con:

1. Fecha en “Última actualización”
2. Entrada corta en §6 (lección) o §9 (deuda resuelta)
3. IDs/URLs nuevos en §2 si cambian

No documentar secretos ni dumps de CLI con `secret_key`.
