-- Enterprise Usage & Limits Enforcement System
-- Adds real-time usage tracking, audit logs, limit override requests.

-- ════════════════════════════════════════════════════════════════════════
-- 1. organization_usage — real-time usage snapshots per org
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.organization_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_count int not null default 0,
  trainer_count int not null default 0,
  staff_count int not null default 0,
  gym_count int not null default 0,
  branch_count int not null default 0,
  storage_gb numeric(10,2) not null default 0,
  api_calls_30d bigint not null default 0,
  ai_requests_30d int not null default 0,
  sms_sent_30d int not null default 0,
  emails_sent_30d int not null default 0,
  domains_configured int not null default 0,
  snaphsot_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

comment on table public.organization_usage is 'Real-time usage metrics per organization. Updated on resource creation/deletion.';

create index if not exists org_usage_org_idx on public.organization_usage (organization_id);

alter table public.organization_usage enable row level security;

drop policy if exists "org_usage super admin" on public.organization_usage;
create policy "org_usage super admin"
  on public.organization_usage for select to authenticated
  using (public.is_super_admin());

drop policy if exists "org_usage org owner" on public.organization_usage;
create policy "org_usage org owner"
  on public.organization_usage for select to authenticated
  using (public.is_organization_owner(organization_id));

drop policy if exists "org_usage insert" on public.organization_usage;
create policy "org_usage insert"
  on public.organization_usage for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "org_usage update" on public.organization_usage;
create policy "org_usage update"
  on public.organization_usage for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════
-- 2. usage_audit_logs — immutable audit of limit events
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.usage_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'limit_reached', 'limit_exceeded_attempt', 'limit_increased', 'limit_decreased',
    'over_limit_blocked', 'usage_refreshed', 'usage_corrected',
    'plan_upgraded', 'plan_downgraded', 'quota_temporary_grant',
    'bulk_import_blocked', 'limit_override', 'limit_override_revoked'
  )),
  limit_code text,
  current_value int,
  limit_value int,
  previous_value int,
  reason text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.usage_audit_logs is 'Immutable audit trail of all limit-related events per organization.';

create index if not exists usage_audit_org_idx on public.usage_audit_logs (organization_id, created_at desc);
create index if not exists usage_audit_event_idx on public.usage_audit_logs (event_type);

alter table public.usage_audit_logs enable row level security;

drop policy if exists "usage audit super admin" on public.usage_audit_logs;
create policy "usage audit super admin"
  on public.usage_audit_logs for select to authenticated
  using (public.is_super_admin());

drop policy if exists "usage audit org owner" on public.usage_audit_logs;
create policy "usage audit org owner"
  on public.usage_audit_logs for select to authenticated
  using (public.is_organization_owner(organization_id));

drop policy if exists "usage audit insert" on public.usage_audit_logs;
create policy "usage audit insert"
  on public.usage_audit_logs for insert to authenticated
  with check (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════
-- 3. limit_override_requests — super admin temporary overrides
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.limit_override_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  limit_code text not null,
  requested_value int not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.limit_override_requests is 'Super Admin can approve temporary limit increases for organizations.';

create index if not exists limit_override_org_idx on public.limit_override_requests (organization_id);
create index if not exists limit_override_status_idx on public.limit_override_requests (status);

alter table public.limit_override_requests enable row level security;

drop policy if exists "limit override super admin" on public.limit_override_requests;
create policy "limit override super admin"
  on public.limit_override_requests for select to authenticated
  using (public.is_super_admin());

drop policy if exists "limit override org owner" on public.limit_override_requests;
create policy "limit override org owner"
  on public.limit_override_requests for select to authenticated
  using (public.is_organization_owner(organization_id));

-- ════════════════════════════════════════════════════════════════════════
-- 4. RPC: refresh_organization_usage — recalculates all usage counts
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.refresh_organization_usage(
  p_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_members int;
  v_trainers int;
  v_staff int;
  v_gyms int;
  v_branches int;
begin
  select count(*) into v_members from public.members where organization_id = p_organization_id and status = 'active';
  select count(*) into v_trainers from public.trainers t join public.gyms g on g.id = t.gym_id where g.organization_id = p_organization_id and t.status = 'active';
  select count(*) into v_staff from public.branch_users where organization_id = p_organization_id and status = 'active';
  select count(*) into v_gyms from public.gyms where organization_id = p_organization_id and status = 'active';
  select count(*) into v_branches from public.branches where organization_id = p_organization_id and status = 'active';

  insert into public.organization_usage (organization_id, member_count, trainer_count, staff_count, gym_count, branch_count)
  values (p_organization_id, v_members, v_trainers, v_staff, v_gyms, v_branches)
  on conflict (organization_id) do update set
    member_count = v_members, trainer_count = v_trainers, staff_count = v_staff,
    gym_count = v_gyms, branch_count = v_branches,
    snaphsot_date = current_date, updated_at = now();

  insert into public.usage_audit_logs (organization_id, event_type, current_value, reason)
  values (p_organization_id, 'usage_refreshed', v_members + v_trainers + v_staff + v_gyms + v_branches, 'Usage refreshed');

  return jsonb_build_object('ok', true, 'members', v_members, 'trainers', v_trainers, 'staff', v_staff, 'gyms', v_gyms, 'branches', v_branches);
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 5. Trigger: auto-refresh usage on member/gym/branch/trainer/staff changes
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.auto_refresh_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  -- Determine org_id based on which table triggered
  if tg_table_name = 'members' then
    v_org_id := new.organization_id;
  elsif tg_table_name = 'gyms' then
    v_org_id := new.organization_id;
  elsif tg_table_name = 'branches' then
    v_org_id := new.organization_id;
  elsif tg_table_name = 'trainers' then
    select g.organization_id into v_org_id from public.gyms g where g.id = coalesce(new.gym_id, old.gym_id);
  elsif tg_table_name = 'branch_users' then
    v_org_id := coalesce(new.organization_id, old.organization_id);
  end if;

  if v_org_id is not null then
    perform public.refresh_organization_usage(v_org_id);
  end if;
  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 6. Add organization_id to members table if missing
-- ════════════════════════════════════════════════════════════════════════

alter table public.members add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
comment on column public.members.organization_id is 'Organization the member belongs to (denormalized for performance)';

-- ════════════════════════════════════════════════════════════════════════
-- 7. Seed limit codes into package_limits for any missing standard limits
-- ════════════════════════════════════════════════════════════════════════

-- Ensure all 3 active packages have standard limits
do $$
declare
  pkg record;
begin
  for pkg in select id, name, slug, sort_order from public.packages where slug in ('starter', 'growth', 'enterprise') loop
    -- Ensure all standard limit codes exist
    insert into public.package_limits (package_id, limit_code, label, value, sort_order) values
      (pkg.id, 'max_members', 'Maximum Members', case pkg.slug when 'starter' then 500 when 'growth' then 5000 else -1 end, 1),
      (pkg.id, 'max_branches', 'Maximum Branches', case pkg.slug when 'starter' then 1 when 'growth' then 10 else -1 end, 2),
      (pkg.id, 'max_gyms', 'Maximum Gyms', case pkg.slug when 'starter' then 1 when 'growth' then 5 else -1 end, 3),
      (pkg.id, 'max_trainers', 'Maximum Trainers', case pkg.slug when 'starter' then 10 when 'growth' then 100 else -1 end, 4),
      (pkg.id, 'max_staff', 'Maximum Staff', case pkg.slug when 'starter' then 5 when 'growth' then 50 else -1 end, 5),
      (pkg.id, 'max_storage_gb', 'Storage Limit (GB)', case pkg.slug when 'starter' then 5 when 'growth' then 50 else -1 end, 6),
      (pkg.id, 'max_api_calls', 'Monthly API Calls', case pkg.slug when 'starter' then 0 when 'growth' then 10000 else -1 end, 7),
      (pkg.id, 'max_domains', 'Custom Domains', case pkg.slug when 'starter' then 0 when 'growth' then 0 else -1 end, 8),
      (pkg.id, 'max_ai_requests', 'AI Requests per Month', case pkg.slug when 'starter' then 0 when 'growth' then 500 else -1 end, 9),
      (pkg.id, 'max_sms_monthly', 'SMS per Month', case pkg.slug when 'starter' then 0 when 'growth' then 1000 else -1 end, 10),
      (pkg.id, 'max_emails_monthly', 'Emails per Month', case pkg.slug when 'starter' then 500 when 'growth' then 5000 else -1 end, 11)
    on conflict (package_id, limit_code) do update set
      value = excluded.value, label = excluded.label;
  end loop;
end $$;
