create table if not exists public.pwa_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired', 'failed')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pwa_offline_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  client_action_id text not null,
  action_type text not null check (action_type in ('workout_log', 'nutrition_log', 'profile_update', 'attendance_check_in', 'attendance_check_out', 'class_booking_request')),
  endpoint text not null,
  method text not null check (method in ('POST', 'PUT', 'PATCH', 'DELETE')),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  status text not null default 'accepted' check (status in ('queued', 'accepted', 'rejected', 'processed', 'failed')),
  error_message text,
  created_offline_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.pwa_install_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  client_event_id text,
  event_type text not null check (event_type in ('install_prompt_shown', 'install_accepted', 'install_dismissed', 'standalone_open', 'push_opt_in', 'offline_action_queued', 'offline_sync_completed')),
  route text not null default '/',
  platform text not null default 'web',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.pwa_cache_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  snapshot_key text not null,
  payload jsonb not null default '{}'::jsonb,
  cached_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, snapshot_key)
);

create index if not exists idx_pwa_push_subscriptions_user_status on public.pwa_push_subscriptions(user_id, status);
create index if not exists idx_pwa_push_subscriptions_org_branch on public.pwa_push_subscriptions(organization_id, branch_id);
create index if not exists idx_pwa_offline_actions_user_status on public.pwa_offline_actions(user_id, status, received_at desc);
create index if not exists idx_pwa_offline_actions_org_branch on public.pwa_offline_actions(organization_id, branch_id, received_at desc);
create index if not exists idx_pwa_install_events_event_time on public.pwa_install_events(event_type, occurred_at desc);
create index if not exists idx_pwa_install_events_user_time on public.pwa_install_events(user_id, occurred_at desc);
create index if not exists idx_pwa_cache_snapshots_user_key on public.pwa_cache_snapshots(user_id, snapshot_key);

drop trigger if exists set_pwa_push_subscriptions_updated_at on public.pwa_push_subscriptions;
create trigger set_pwa_push_subscriptions_updated_at before update on public.pwa_push_subscriptions for each row execute function public.set_updated_at();

drop trigger if exists set_pwa_offline_actions_updated_at on public.pwa_offline_actions;
create trigger set_pwa_offline_actions_updated_at before update on public.pwa_offline_actions for each row execute function public.set_updated_at();

drop trigger if exists set_pwa_cache_snapshots_updated_at on public.pwa_cache_snapshots;
create trigger set_pwa_cache_snapshots_updated_at before update on public.pwa_cache_snapshots for each row execute function public.set_updated_at();

alter table public.pwa_push_subscriptions enable row level security;
alter table public.pwa_offline_actions enable row level security;
alter table public.pwa_install_events enable row level security;
alter table public.pwa_cache_snapshots enable row level security;

drop policy if exists "users manage own pwa push subscriptions" on public.pwa_push_subscriptions;
create policy "users manage own pwa push subscriptions"
on public.pwa_push_subscriptions
for all
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or (organization_id is not null and public.can_manage_organization(organization_id))
)
with check (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or (organization_id is not null and public.can_manage_organization(organization_id))
);

drop policy if exists "users manage own pwa offline actions" on public.pwa_offline_actions;
create policy "users manage own pwa offline actions"
on public.pwa_offline_actions
for all
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or (organization_id is not null and public.can_manage_organization(organization_id))
)
with check (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or (organization_id is not null and public.can_manage_organization(organization_id))
);

drop policy if exists "users write own pwa install events" on public.pwa_install_events;
create policy "users write own pwa install events"
on public.pwa_install_events
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  or user_id is null
);

drop policy if exists "staff read pwa install events" on public.pwa_install_events;
create policy "staff read pwa install events"
on public.pwa_install_events
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or (organization_id is not null and public.can_manage_organization(organization_id))
);

drop policy if exists "users manage own pwa cache snapshots" on public.pwa_cache_snapshots;
create policy "users manage own pwa cache snapshots"
on public.pwa_cache_snapshots
for all
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or (organization_id is not null and public.can_manage_organization(organization_id))
)
with check (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or (organization_id is not null and public.can_manage_organization(organization_id))
);

create or replace view public.pwa_mobile_engagement_summary as
select
  coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid) as organization_id,
  count(*) filter (where event_type = 'standalone_open') as standalone_opens,
  count(*) filter (where event_type = 'install_prompt_shown') as install_prompts,
  count(*) filter (where event_type = 'install_accepted') as installs,
  count(*) filter (where event_type = 'push_opt_in') as push_opt_ins,
  count(*) filter (where event_type = 'offline_action_queued') as offline_actions_queued,
  max(occurred_at) as latest_event_at
from public.pwa_install_events
group by coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid);

grant select, insert, update, delete on public.pwa_push_subscriptions to authenticated;
grant select, insert, update, delete on public.pwa_offline_actions to authenticated;
grant select, insert on public.pwa_install_events to authenticated;
grant select, insert, update, delete on public.pwa_cache_snapshots to authenticated;
grant select on public.pwa_mobile_engagement_summary to authenticated;
