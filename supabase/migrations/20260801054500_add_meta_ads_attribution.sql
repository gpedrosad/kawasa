-- Atribución Meta Ads (CTWA) + conversiones futuras para CAPI / pulir targeting
-- Minimalista: 2 tablas. No envía a Meta todavía (status=pending).

create table public.ad_touches (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  source text not null default 'meta',
  channel text not null default 'ctwa',
  ctwa_clid text,
  source_id text,
  source_type text,
  source_url text,
  headline text,
  body text,
  media_type text,
  campaign_id text,
  adset_id text,
  ad_id text,
  utm jsonb not null default '{}'::jsonb,
  raw jsonb,
  touched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index ad_touches_ctwa_clid_uidx
  on public.ad_touches (ctwa_clid)
  where ctwa_clid is not null;

alter table public.ad_touches
  add constraint ad_touches_conversation_id_unique unique (conversation_id);

create index ad_touches_contact_id_idx
  on public.ad_touches (contact_id);

create index ad_touches_campaign_id_idx
  on public.ad_touches (campaign_id)
  where campaign_id is not null;

create table public.conversions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  ad_touch_id uuid references public.ad_touches (id) on delete set null,
  event_name text not null,
  event_id text not null,
  event_time timestamptz not null default now(),
  value numeric(12, 2),
  currency text not null default 'USD',
  action_source text not null default 'business_messaging',
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  custom_data jsonb not null default '{}'::jsonb,
  user_data jsonb not null default '{}'::jsonb,
  meta_response jsonb,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversions_event_id_unique unique (event_id)
);

create index conversions_status_idx
  on public.conversions (status, created_at);

create index conversions_conversation_id_idx
  on public.conversions (conversation_id);

create index conversions_event_name_idx
  on public.conversions (event_name);

create trigger conversions_set_updated_at
  before update on public.conversions
  for each row execute function public.set_updated_at();

alter table public.ad_touches enable row level security;
alter table public.conversions enable row level security;

comment on table public.ad_touches is 'First-touch Meta/CTWA (ctwa_clid, campaign, etc.) para atribución.';
comment on table public.conversions is 'Eventos de conversión listos para Meta CAPI; status pending hasta envío.';
comment on column public.conversions.event_id is 'Idempotencia Meta (dedup Pixel/CAPI).';
comment on column public.conversions.action_source is 'Para WhatsApp CTWA usar business_messaging.';
