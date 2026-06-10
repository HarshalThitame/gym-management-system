create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null,
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (char_length(phone) between 8 and 20),
  email text null,
  source text not null check (source in ('free_trial', 'membership_inquiry', 'contact')),
  interest text null,
  message text not null check (char_length(message) between 8 and 800),
  preferred_trial_at timestamptz null,
  status text not null default 'new' check (status in ('new', 'contacted', 'trial_scheduled', 'trial_completed', 'converted', 'lost', 'spam')),
  consent_marketing boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_status_created_at_idx on public.leads (status, created_at desc);
create index if not exists leads_phone_idx on public.leads (phone);
create index if not exists leads_email_idx on public.leads (email);
create index if not exists leads_source_created_at_idx on public.leads (source, created_at desc);

alter table public.leads enable row level security;

drop policy if exists "service role can manage public leads" on public.leads;
create policy "service role can manage public leads"
on public.leads
for all
to service_role
using (true)
with check (true);

