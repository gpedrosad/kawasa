-- Conversiones a Meta (Conversions API for Business Messaging).
-- 1. Cada contacto tiene un código corto y aleatorio para su link personal
--    (agendapp.com.ar/empezar?wa=<código>): así AgendApp avisa quién abrió el link y quién pagó.
-- 2. conversions cuenta intentos de envío.

alter table public.contacts
  add column wa_ref text not null
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

create unique index contacts_wa_ref_uidx on public.contacts (wa_ref);

alter table public.conversions
  add column attempts integer not null default 0;

comment on column public.contacts.wa_ref is
  'Código del link personal /empezar?wa=. Aleatorio, sin PII.';
comment on column public.conversions.attempts is
  'Intentos de envío a Meta CAPI (business_messaging).';
