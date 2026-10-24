-- A/B del primer mensaje a leads de anuncios (agente de ventas, 2026-10-24).
-- El router (/api/kapso/route-inbound) le asigna a cada lead nuevo una variante del
-- primer mensaje; Kapso lo manda como texto fijo y después sigue el agente de IA.
-- Una fila por teléfono: nunca se le manda a alguien dos primeros mensajes.

create table public.opening_messages (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  variant text not null,
  message text not null,
  assigned_at timestamptz not null default now(),
  constraint opening_messages_phone_number_unique unique (phone_number)
);

create index opening_messages_variant_idx
  on public.opening_messages (variant, assigned_at);

alter table public.opening_messages enable row level security;

comment on table public.opening_messages is
  'Primer mensaje fijo que recibió cada lead de anuncio (A/B). phone_number con el mismo formato que contacts.phone_number (54 + 10 dígitos).';

-- Resultado por lead: ¿contestó después del primer mensaje? ¿llegó a cada escalón?
create or replace view public.opening_message_results
with (security_invoker = true) as
select
  o.variant,
  o.assigned_at,
  c.id as contact_id,
  (
    select min(coalesce(m.occurred_at, m.created_at))
    from public.messages m
    where m.contact_id = c.id
      and m.direction = 'inbound'
      and coalesce(m.occurred_at, m.created_at) > o.assigned_at
  ) as first_reply_at,
  exists (
    select 1 from public.conversions cv
    where cv.contact_id = c.id and cv.event_name = 'QualifiedLead'
  ) as qualified,
  exists (
    select 1 from public.conversions cv
    where cv.contact_id = c.id and cv.event_name = 'InitiateCheckout'
  ) as initiated_checkout,
  exists (
    select 1 from public.conversions cv
    where cv.contact_id = c.id and cv.event_name = 'Purchase'
  ) as purchased
from public.opening_messages o
left join public.contacts c on c.phone_number = o.phone_number;

comment on view public.opening_message_results is
  'Una fila por lead del A/B del primer mensaje: variante, si contestó (first_reply_at) y escalones de conversión.';

-- Resumen por variante para la revisión semanal.
create or replace view public.opening_message_summary
with (security_invoker = true) as
select
  variant,
  count(*) as leads,
  count(first_reply_at) as replied,
  count(*) filter (where first_reply_at - assigned_at <= interval '24 hours') as replied_24h,
  count(*) filter (where qualified) as qualified,
  count(*) filter (where initiated_checkout) as initiated_checkout,
  count(*) filter (where purchased) as purchased,
  min(assigned_at) as first_assigned_at,
  max(assigned_at) as last_assigned_at
from public.opening_message_results
group by variant;

comment on view public.opening_message_summary is
  'A/B del primer mensaje: leads, cuántos contestaron y cuántos llegaron a cada escalón, por variante.';

revoke all on public.opening_messages from anon, authenticated;
revoke all on public.opening_message_results from anon, authenticated;
revoke all on public.opening_message_summary from anon, authenticated;
