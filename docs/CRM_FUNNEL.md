# CRM Funnel (kanban)

Vista web para mover conversaciones WhatsApp por el embudo y marcar conversiones Meta.

**Estado:** implementado (MVP). Protegido con clave (`CRM_PASSWORD`, ver `src/middleware.ts`).

---

## Dónde

| Entorno | URL |
|---------|-----|
| Local | http://localhost:3000/crm |
| Prod | https://kawasa.vercel.app/crm |

Home también linkea “Abrir funnel CRM”.

---

## Embudo

Columnas (`conversations.stage`):

| Stage | Label | Conversión al entrar |
|-------|--------|----------------------|
| `nuevo` | Nuevo | — |
| `calificado` | Calificado | — |
| `interesado` | Interesado | — |
| `lead` | Lead | `QualifiedLead` → `conversions` + Meta CAPI |
| `ganado` | Ganado | `Purchase` (ARS 18.000) → `conversions` + Meta CAPI |
| `perdido` | Perdido | — |

Default al crear conversación (DB): `nuevo`.

**Idempotencia:** `event_id = {contactId}:{EventName}`. Re-arrastrar a Lead/Ganado no duplica la conversión, y tampoco la duplica el evento automático del mismo escalón. Las tarjetas también avanzan solas (Lead por profesión, Ganado por pago). Detalle: [`CAPI_ESCALERA.md`](CAPI_ESCALERA.md).

---

## Cómo se usa

1. Abrís `/crm`
2. Arrastrás la tarjeta a otra columna
3. Si soltás en **Lead** o **Ganado**, se llama `recordConversion` y se manda a Meta (queda `pending` si Meta no está configurado)
4. Badge **CTWA / ad** si hay `ad_touches` para esa conversación
5. «Copiar link para mandarle»: link personal `/empezar?wa=<código>` para medir si lo abre y si paga

---

## Archivos

| Pieza | Path |
|-------|------|
| Config etapas | `src/config/pipeline.ts` |
| Listar / mover | `src/services/crm/pipeline.ts` |
| UI página | `src/app/crm/page.tsx` |
| UI kanban (client) | `src/app/crm/crm-kanban.tsx` |
| API list | `GET /api/crm/conversations` |
| API mover | `PATCH /api/crm/conversations/[id]/stage` body `{ "stage": "lead" }` |
| Migración | `supabase/migrations/20260801160000_add_conversation_pipeline_stage.sql` |
| Fechas UI | `src/utils/datetime.ts` (`formatDateTimeAr`) |

---

## Hydration / fechas

`Intl` con `es-AR` + `a. m.` puede diferir entre Node y el browser → **hydration mismatch**.  
Usar siempre `formatDateTimeAr` (zona `America/Argentina/Buenos_Aires`, `hourCycle: h23`, partes fijas).

---

## Seguridad (deuda)

- `/crm` y `/api/crm/*` **no tienen login**
- Leen/escriben con `SUPABASE_SERVICE_ROLE_KEY` en server
- Antes de usar en prod compartido: auth (Clerk / Supabase Auth / secret básico)

---

## Próximos pasos naturales

1. Auth staff
2. Click en tarjeta → inbox del hilo (`messages`)
3. Filtros por phone / CTWA / fecha
