# Kapso CRM Base

Base profesional en **Next.js 15 (App Router) + TypeScript** para construir un CRM con WhatsApp, IA y automatizaciones usando **Kapso** (WhatsApp Cloud API con Coexistence).

## Qué incluye

- Cliente singleton `@kapso/whatsapp-cloud-api` (`src/lib/kapso.ts`)
- Validación de entorno con Zod (`src/config/env.ts`)
- Servicios reutilizables de WhatsApp (`src/services/whatsapp`)
- API routes de envío (texto / audio-voz)
- Webhook firmado HMAC SHA256 + dispatcher por evento
- Tipado estricto (sin `any`)
- Interfaces de IA desacopladas (OpenAI / Anthropic / Gemini)
- Puertos Repository listos para Prisma/PostgreSQL
- Logger centralizado (console en dev, contrato listo para Winston/Pino)

Los secretos **nunca** usan `NEXT_PUBLIC_*`.

## MCP & CLI (agentes)

### CLI (instalado)

```bash
npm install -g @kapso/cli
kapso login
kapso status
```

En este repo ya está:

- CLI autenticado
- Proyecto linkeado (`kapso link`) → `Default project`
- Número Coexistence **Agendapp** (`phone_number_id`: `623041330889329`)

Comandos útiles:

```bash
kapso whatsapp numbers list
kapso whatsapp conversations list --phone-number-id 623041330889329
kapso whatsapp messages send --phone-number-id 623041330889329 --to "+54911..." --text "Hola"
kapso whatsapp webhooks list --phone-number-id 623041330889329
```

### MCP en Cursor (configurado)

Global (`~/.cursor/mcp.json`) y proyecto (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "kapso": {
      "url": "https://api.kapso.ai/mcp"
    }
  }
}
```

Para activarlo:

1. Abre **Cursor → Settings → Tools & MCP**
2. En el server `kapso`, pulsa **Connect** / autentica en el navegador
3. Elige el proyecto Kapso
4. Confirma que aparecen tools (`status`, `whatsapp_messages`, etc.)

#### Variante con API key

```bash
export KAPSO_API_KEY="tu_project_api_key"
```

Luego usa la config de ejemplo `.cursor/mcp.api-key.example.json` (Bearer `${env:KAPSO_API_KEY}`).

Crea la API key en el dashboard: [app.kapso.ai](https://app.kapso.ai).

## Estructura

```text
src/
  app/api/
    whatsapp/send-text/
    whatsapp/send-audio/
    webhooks/kapso/
  config/          # env con Zod
  lib/             # kapso client + logger
  services/
    whatsapp/      # sendText, sendAudio, sendTemplate, markAsRead, media
    webhooks/      # handleWebhook + handlers
    ai/            # providers desacoplados (stubs)
  repositories/interfaces/
  types/
  utils/
  hooks/
```

## 1. Configurar Kapso

1. Crea una cuenta en [Kapso](https://kapso.ai).
2. Conecta tu número de WhatsApp (Cloud API / Coexistence según tu caso).
3. Obtén:
   - **API Key** del proyecto
   - **Phone Number ID** del número conectado
   - **Webhook Secret** al crear el webhook

### Obtener API Key

1. Entra al dashboard de Kapso.
2. Abre tu proyecto.
3. Ve a API Keys / Settings.
4. Copia la key y guárdala solo en `.env.local` (nunca en el frontend ni en git).

### Phone Number ID

En Kapso, abre el número de WhatsApp conectado y copia el `phone_number_id`.

## 2. Variables de entorno

```bash
cp .env.example .env.local
```

Completa:

```env
KAPSO_API_KEY=...
KAPSO_PHONE_NUMBER_ID=...
KAPSO_WEBHOOK_SECRET=...
```

Opcional:

```env
KAPSO_BASE_URL=https://api.kapso.ai/meta/whatsapp
LOG_LEVEL=debug
```

Si falta alguna variable crítica, el servidor lanza un error claro al usarla.

## 3. Configurar webhook

1. Expón tu entorno local (ej. ngrok / Cloudflare Tunnel):

```bash
ngrok http 3000
```

2. En Kapso, crea un webhook apuntando a:

```text
https://<tu-dominio-publico>/api/webhooks/kapso
```

3. Usa el mismo secret que `KAPSO_WEBHOOK_SECRET`.
4. Suscribe eventos, por ejemplo:
   - `whatsapp.message.received`
   - `whatsapp.message.sent`
   - `whatsapp.message.delivered`
   - `whatsapp.message.read`
   - `whatsapp.message.failed`
   - `whatsapp.conversation.created`
   - `whatsapp.conversation.ended`
   - `whatsapp.conversation.inactive`

El endpoint:

- lee el **raw body**
- verifica `X-Webhook-Signature` (HMAC SHA256)
- compara con `timingSafeEqual`
- rechaza firmas inválidas (401)
- despacha a `handleIncomingMessage` / `handleStatus` / `handleConversation`

## 4. Ejecutar localmente

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## 5. Probar envío de mensajes

### Texto

```bash
curl -X POST http://localhost:3000/api/whatsapp/send-text \
  -H 'Content-Type: application/json' \
  -d '{
    "to": "+56912345678",
    "text": "Hola desde Kapso CRM Base"
  }'
```

### Audio / nota de voz (LINK)

```bash
curl -X POST http://localhost:3000/api/whatsapp/send-audio \
  -H 'Content-Type: application/json' \
  -d '{
    "telefono": "+56912345678",
    "audioUrl": "https://example.com/voice.ogg",
    "voice": true
  }'
```

### Audio por MEDIA_ID

```bash
curl -X POST http://localhost:3000/api/whatsapp/send-audio \
  -H 'Content-Type: application/json' \
  -d '{
    "telefono": "+56912345678",
    "mediaId": "MEDIA_ID_SUBIDO",
    "voice": true
  }'
```

Para notas de voz, Meta recomienda `.ogg` con codec OPUS.

## Servicios reutilizables

```ts
import {
  sendText,
  sendAudio,
  sendTemplate,
  markAsRead,
  uploadMedia,
  downloadMedia,
} from "@/services/whatsapp";
```

## IA (preparado, no implementado)

`src/services/ai` expone el contrato `AiProvider` y stubs para:

- OpenAI
- Anthropic
- Gemini

Usa `createAiProvider("openai")` cuando quieras activarlos.

## Base de datos (preparado, no implementado)

Interfaces en `src/repositories/interfaces`:

- `ContactRepository`
- `ConversationRepository`
- `MessageRepository`
- `MediaRepository`

Implementa con Prisma/PostgreSQL sin cambiar la lógica de webhooks/servicios.

## Producción

- Despliega en Vercel u otro host Node.
- Configura las env vars en el panel del host.
- Apunta el webhook de Kapso a tu URL pública.
- No expongas `KAPSO_*` al cliente.
- El logger ya está listo para conectar Winston/Pino en producción.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Próximos pasos sugeridos

1. Persistencia Prisma + Postgres
2. Implementar un `AiProvider`
3. Autenticación para las rutas de envío (`/api/whatsapp/*`)
4. Idempotencia de webhooks con `X-Idempotency-Key`
5. Bandeja CRM (UI) consumiendo repositories

## Aprendizaje para IA

Contexto vivo (estado real, IDs, lecciones, debug): [`docs/AI_LEARNING.md`](docs/AI_LEARNING.md). Actualizarlo cuando cambiemos algo relevante.

Contexto AgendApp: [`docs/PRODUCT_AGENDAPP.md`](docs/PRODUCT_AGENDAPP.md).  
Flujo WhatsApp primer contacto (**solo doc**, no cierre): [`docs/KAPSO_WHATSAPP_QUALIFY.md`](docs/KAPSO_WHATSAPP_QUALIFY.md).

CRM funnel (kanban): [`/crm`](http://localhost:3000/crm) — arrastrar etapas; Lead/Ganado registran conversión.  
Detalle: [`docs/CRM_FUNNEL.md`](docs/CRM_FUNNEL.md).
