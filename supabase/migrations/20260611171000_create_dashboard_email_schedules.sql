-- Scheduled executive dashboard summaries for Super Admins.

create table if not exists public.platform_dashboard_email_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  frequency text not null default 'weekly' check (frequency in ('weekly')),
  status text not null default 'active' check (status in ('active', 'paused')),
  next_run_at timestamptz not null default (date_trunc('week', now()) + interval '1 week 9 hours'),
  last_sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, frequency)
);

comment on table public.platform_dashboard_email_schedules is 'Super Admin subscriptions for scheduled executive dashboard email summaries.';

create index if not exists platform_dashboard_email_schedules_due_idx
on public.platform_dashboard_email_schedules (status, next_run_at);

drop trigger if exists set_platform_dashboard_email_schedules_updated_at on public.platform_dashboard_email_schedules;
create trigger set_platform_dashboard_email_schedules_updated_at
before update on public.platform_dashboard_email_schedules
for each row execute function public.set_updated_at();

alter table public.platform_dashboard_email_schedules enable row level security;

drop policy if exists "dashboard email schedules readable by super admins" on public.platform_dashboard_email_schedules;
create policy "dashboard email schedules readable by super admins"
on public.platform_dashboard_email_schedules for select to authenticated
using (public.is_super_admin());

drop policy if exists "dashboard email schedules insertable by super admins" on public.platform_dashboard_email_schedules;
create policy "dashboard email schedules insertable by super admins"
on public.platform_dashboard_email_schedules for insert to authenticated
with check (public.is_super_admin() and user_id = (select auth.uid()));

drop policy if exists "dashboard email schedules updatable by super admins" on public.platform_dashboard_email_schedules;
create policy "dashboard email schedules updatable by super admins"
on public.platform_dashboard_email_schedules for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "dashboard email schedules deletable by super admins" on public.platform_dashboard_email_schedules;
create policy "dashboard email schedules deletable by super admins"
on public.platform_dashboard_email_schedules for delete to authenticated
using (public.is_super_admin());
