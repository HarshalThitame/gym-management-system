-- Mobile Platform API Infrastructure

-- ════════════════════════════════════════════════════════════════════════
-- 1. Device registration for push notifications
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.mobile_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  device_token text not null,
  app_version text,
  device_model text,
  os_version text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, device_token)
);

create index if not exists mobile_devices_user_idx on public.mobile_devices (user_id);
create index if not exists mobile_devices_org_idx on public.mobile_devices (organization_id);

alter table public.mobile_devices enable row level security;
drop policy if exists "mobile devices owner" on public.mobile_devices;
create policy "mobile devices owner"
  on public.mobile_devices for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "mobile devices insert" on public.mobile_devices;
create policy "mobile devices insert"
  on public.mobile_devices for insert to authenticated
  with check (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════
-- 2. Push notification queue
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.push_notification_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  data jsonb default '{}'::jsonb,
  priority text default 'normal' check (priority in ('high', 'normal', 'low')),
  status text default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists push_queue_user_idx on public.push_notification_queue (user_id);
create index if not exists push_queue_status_idx on public.push_notification_queue (status);

-- ════════════════════════════════════════════════════════════════════════
-- 3. Mobile auth sessions (multi-device support)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.mobile_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.mobile_devices(id) on delete cascade,
  refresh_token text not null,
  expires_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists mobile_sessions_user_idx on public.mobile_sessions (user_id);
create index if not exists mobile_sessions_token_idx on public.mobile_sessions (refresh_token);

-- ════════════════════════════════════════════════════════════════════════
-- 4. Mobile-friendly API views
-- ════════════════════════════════════════════════════════════════════════

-- Member dashboard: quick overview for mobile
create or replace view public.mobile_member_dashboard as
select
  m.id as member_id,
  m.full_name,
  m.email,
  m.phone,
  m.status,
  m.joined_at,
  g.id as gym_id,
  g.name as gym_name,
  b.id as branch_id,
  b.name as branch_name,
  o.id as organization_id,
  o.name as organization_name,
  ob.primary_color,
  ob.secondary_color,
  ob.logo_url,
  ob.favicon_url
from public.members m
join public.gyms g on g.id = m.gym_id
left join public.branches b on b.gym_id = g.id
join public.organizations o on o.id = g.organization_id
left join public.organization_branding ob on ob.organization_id = o.id;

-- Trainer dashboard
create or replace view public.mobile_trainer_dashboard as
select
  t.id as trainer_id,
  t.display_name,
  t.email,
  t.phone,
  t.status,
  g.id as gym_id,
  g.name as gym_name,
  o.id as organization_id,
  o.name as organization_name
from public.trainers t
join public.gyms g on g.id = t.gym_id
join public.organizations o on o.id = g.organization_id;
