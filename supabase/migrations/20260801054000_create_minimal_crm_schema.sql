-- KaWa CRM: schema minimalista (3 tablas)
-- Acceso: service_role desde el servidor. RLS on, sin policies anon.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  wa_id text,
  profile_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_phone_number_unique unique (phone_number)
);

create table public.conversations (
  id uuid primary key,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  phone_number_id text,
  status text not null default 'active',
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_contact_id_idx
  on public.conversations (contact_id);

create index conversations_last_message_at_idx
  on public.conversations (last_message_at desc nulls last);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  provider_message_id text not null,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  type text not null default 'text',
  status text not null default 'received',
  text text,
  media jsonb,
  context_message_id text,
  occurred_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_provider_message_id_unique unique (provider_message_id)
);

create index messages_conversation_created_at_idx
  on public.messages (conversation_id, created_at desc);

create index messages_contact_id_idx
  on public.messages (contact_id);

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

create trigger messages_set_updated_at
  before update on public.messages
  for each row execute function public.set_updated_at();

alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

comment on table public.contacts is 'Contactos WhatsApp (phone único).';
comment on table public.conversations is 'Hilos Kapso; id = conversation id del provider.';
comment on table public.messages is 'Mensajes; media opcional en jsonb (sin tabla aparte).';
comment on column public.messages.provider_message_id is 'wamid / id Meta-Kapso';
comment on column public.messages.media is 'Metadatos de media inline: id, link, mime_type, voice, url, etc.';
