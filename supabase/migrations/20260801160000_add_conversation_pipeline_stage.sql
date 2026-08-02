alter table public.conversations
  add column if not exists stage text not null default 'nuevo';

alter table public.conversations
  drop constraint if exists conversations_stage_check;

alter table public.conversations
  add constraint conversations_stage_check
  check (stage in ('nuevo', 'calificado', 'interesado', 'lead', 'ganado', 'perdido'));

create index if not exists conversations_stage_idx
  on public.conversations (stage);

comment on column public.conversations.stage is 'Etapa del funnel CRM (kanban). lead/ganado disparan conversiones.';
