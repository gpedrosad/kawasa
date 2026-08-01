# AI Learning — Kawasa / Kapso CRM

Documento vivo para agentes de IA (y humanos) que trabajen en este repo.
Complementa el `README.md`: acá va **contexto de decisiones, estado real y lecciones**, no tutorial genérico.

**Repo:** [github.com/gpedrosad/kawasa](https://github.com/gpedrosad/kawasa)  
**Producción:** [kawasa.vercel.app](https://kawasa.vercel.app)  
**Última actualización de este doc:** 2026-08-01 (automatización supp → nota de voz)

---

## 1. Qué es este proyecto

Base Next.js 15 (App Router) + TypeScript para un CRM sobre **Kapso** (WhatsApp Cloud API con Coexistence).

Hoy es una **base operativa** (enviar mensajes + recibir webhooks firmados), no un CRM completo con UI/DB/IA.

| Capa | Estado |
|------|--------|
| Cliente Kapso + env Zod | Listo |
| `POST /api/whatsapp/send-text` / `send-audio` | Listo |
| `POST /api/webhooks/kapso` + HMAC | Listo |
| Handlers de webhook | Log + automatización `supp` → nota de voz |
| Repositories (Prisma/DB) | Solo interfaces |
| AI providers | Stubs |
| UI CRM / bandeja | No existe |

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
5. **Repositories como puertos** — persistencia futura sin acoplar handlers a Prisma.
6. **AI desacoplada** — `AiProvider` + factory; no hardcodear un vendor en el webhook.
7. **No inventar CRM UI** hasta que exista dominio/persistencia claros.

---

## 8b. Automatización: “supp” → nota de voz

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

## 9. Deuda / próximos pasos sugeridos

Orden razonable:

1. Confirmar recepción real (mensaje WhatsApp → log en Vercel 200 + “Mensaje entrante”).
2. Persistencia: Prisma + Postgres (Supabase u otro) implementando interfaces en `repositories/`.
3. Idempotencia con `X-Idempotency-Key`.
4. Auth en `/api/whatsapp/*` (hoy abiertas: cualquiera que conozca la URL puede spamear).
5. Implementar un `AiProvider` y cablearlo en `handleIncomingMessage`.
6. Bandeja CRM (UI) consumiendo repositories.
7. Carpetas `functions/` y `workflows/` están vacías — reservadas para automatizaciones Kapso/futuras.

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
- [ ] Persistencia / UI CRM / IA

---

## 11. Cómo mantener este documento

Cuando se haga un cambio relevante (nuevo servicio, DB, auth, bug de prod, rotación de keys, cambio de dominio/webhook), **actualizar este archivo en el mismo PR/commit** con:

1. Fecha en “Última actualización”
2. Entrada corta en §6 (lección) o §9 (deuda resuelta)
3. IDs/URLs nuevos en §2 si cambian

No documentar secretos ni dumps de CLI con `secret_key`.
