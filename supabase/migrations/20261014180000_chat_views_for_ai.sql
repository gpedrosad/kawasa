-- Vistas para leer y analizar chats (personas o IA) sin armar joins.
-- Agrupan por contacto: Kapso abre una conversación nueva tras 60 min sin
-- mensajes, así que una misma charla queda partida en varios conversation_id.
-- security_invoker: respetan RLS (solo service_role lee, igual que las tablas).

create or replace view public.chat_messages
with (security_invoker = true) as
select
  m.id,
  m.contact_id,
  c.phone_number,
  c.profile_name,
  m.conversation_id,
  m.direction,
  m.raw -> 'kapso' ->> 'origin' as origin,
  case
    when m.direction = 'inbound' then 'contacto'
    when m.raw -> 'kapso' ->> 'origin' in ('business_app', 'history_sync')
      then 'gonzalo_app'
    else 'bot_api'
  end as author,
  m.type,
  m.status,
  case
    when m.text ~ 'Transcript:'
      then '[audio] ' || btrim(substring(m.text from 'Transcript:\s*(.*)$'))
    when m.type = 'audio' then '[audio sin transcripción]'
    when m.type in ('image', 'video', 'document', 'sticker')
      then '[' || m.type || ']'
        || coalesce(' ' || nullif(m.media ->> 'caption', ''), '')
    when m.type = 'reaction' then '[reacción]'
    when m.type = 'revoke' then '[mensaje borrado]'
    when m.type = 'unknown' then '[mensaje no soportado]'
    else m.text
  end as body,
  coalesce(m.occurred_at, m.created_at) as sent_at,
  (coalesce(m.occurred_at, m.created_at)
    at time zone 'America/Argentina/Buenos_Aires') as sent_at_ar
from public.messages m
left join public.contacts c on c.id = m.contact_id;

comment on view public.chat_messages is
  'Un mensaje por fila, en ambas direcciones. author: contacto | bot_api (flujo/API) | gonzalo_app (escrito desde la app). body ya trae la transcripción de audios.';

create or replace view public.chat_threads
with (security_invoker = true) as
with ad as (
  select distinct on (contact_id)
    contact_id, headline, source_url, source_id, touched_at
  from public.ad_touches
  where contact_id is not null
  order by contact_id, touched_at
),
stage as (
  select distinct on (contact_id) contact_id, stage
  from public.conversations
  order by contact_id, last_message_at desc nulls last
),
agg as (
  select
    cm.contact_id,
    min(cm.sent_at) as first_message_at,
    max(cm.sent_at) as last_message_at,
    max(cm.sent_at) filter (where cm.direction = 'inbound') as last_inbound_at,
    max(cm.sent_at) filter (where cm.direction = 'outbound') as last_outbound_at,
    count(*) filter (where cm.direction = 'inbound') as inbound_count,
    count(*) filter (where cm.direction = 'outbound') as outbound_count,
    (array_agg(cm.author order by cm.sent_at desc))[1] as last_author,
    string_agg(
      to_char(cm.sent_at_ar, 'DD/MM HH24:MI') || ' '
        || case cm.author
             when 'contacto' then 'Contacto'
             when 'gonzalo_app' then 'Gonzalo (app)'
             else 'AgendApp (bot/API)'
           end
        || ': ' || coalesce(cm.body, ''),
      e'\n' order by cm.sent_at
    ) as transcript
  from public.chat_messages cm
  where cm.contact_id is not null
  group by cm.contact_id
)
select
  c.id as contact_id,
  c.phone_number,
  c.profile_name,
  ad.headline as ad_headline,
  ad.source_url as ad_url,
  ad.source_id as ad_source_id,
  ad.touched_at as ad_touched_at,
  stage.stage,
  agg.first_message_at,
  agg.last_message_at,
  agg.last_inbound_at,
  agg.last_outbound_at,
  agg.inbound_count,
  agg.outbound_count,
  agg.last_author,
  (agg.last_author = 'contacto') as waiting_for_us,
  agg.transcript
from agg
join public.contacts c on c.id = agg.contact_id
left join ad on ad.contact_id = c.id
left join stage on stage.contact_id = c.id;

comment on view public.chat_threads is
  'Una fila por contacto con la charla completa en transcript (texto listo para IA), anuncio de origen y si la última palabra es del contacto (waiting_for_us).';

revoke all on public.chat_messages from anon, authenticated;
revoke all on public.chat_threads from anon, authenticated;
