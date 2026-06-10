create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 140),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  organization_type text not null default 'single_gym' check (organization_type in ('single_gym', 'multi_branch', 'franchise')),
  status text not null default 'active' check (status in ('active', 'trial', 'suspended', 'deactivated', 'archived')),
  primary_domain text null,
  billing_email text null,
  owner_user_id uuid null references auth.users(id) on delete set null,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  gym_id uuid null references public.gyms(id) on delete set null,
  name text not null check (char_length(name) between 2 and 140),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  branch_code text not null check (char_length(branch_code) between 2 and 32),
  status text not null default 'active' check (status in ('planned', 'active', 'maintenance', 'suspended', 'deactivated', 'archived')),
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR',
  address text null,
  city text null,
  state text null,
  country text not null default 'India',
  postal_code text null,
  phone text null,
  email text null,
  operating_hours jsonb not null default '{}'::jsonb,
  capacity integer not null default 0 check (capacity >= 0),
  latitude numeric(10, 7) null,
  longitude numeric(10, 7) null,
  opened_on date null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  unique (organization_id, branch_code)
);

create unique index if not exists branches_unique_gym_id_idx on public.branches (gym_id) where gym_id is not null;
create index if not exists branches_org_status_idx on public.branches (organization_id, status, created_at desc);
create index if not exists branches_city_idx on public.branches (city, status);

create table if not exists public.branch_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  general_settings jsonb not null default '{}'::jsonb,
  membership_settings jsonb not null default '{}'::jsonb,
  payment_settings jsonb not null default '{}'::jsonb,
  attendance_settings jsonb not null default '{}'::jsonb,
  class_settings jsonb not null default '{}'::jsonb,
  notification_settings jsonb not null default '{}'::jsonb,
  security_settings jsonb not null default '{}'::jsonb,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id)
);

create table if not exists public.branch_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_name text not null check (role_name in ('super_admin', 'gym_admin', 'reception_staff', 'trainer', 'member')),
  branch_role text not null default 'viewer' check (branch_role in ('owner', 'admin', 'manager', 'staff', 'trainer', 'viewer')),
  access_scope text not null default 'single_branch' check (access_scope in ('single_branch', 'multi_branch', 'organization')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended', 'revoked')),
  permissions jsonb not null default '{}'::jsonb,
  assigned_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, user_id)
);

create index if not exists branch_users_user_status_idx on public.branch_users (user_id, status);
create index if not exists branch_users_org_role_idx on public.branch_users (organization_id, branch_role, status);

create table if not exists public.branch_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  metric_date date not null default current_date,
  revenue_amount numeric(14, 2) not null default 0 check (revenue_amount >= 0),
  active_members integer not null default 0 check (active_members >= 0),
  new_members integer not null default 0 check (new_members >= 0),
  attendance_count integer not null default 0 check (attendance_count >= 0),
  trainer_utilization numeric(5, 2) not null default 0 check (trainer_utilization between 0 and 100),
  class_utilization numeric(5, 2) not null default 0 check (class_utilization between 0 and 100),
  storage_mb numeric(12, 2) not null default 0 check (storage_mb >= 0),
  api_requests integer not null default 0 check (api_requests >= 0),
  created_at timestamptz not null default now(),
  unique (branch_id, metric_date)
);

create index if not exists branch_metrics_org_date_idx on public.branch_metrics (organization_id, metric_date desc);
create index if not exists branch_metrics_branch_date_idx on public.branch_metrics (branch_id, metric_date desc);

create table if not exists public.tenant_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tenant_key text not null unique check (tenant_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  plan_tier text not null default 'starter' check (plan_tier in ('starter', 'professional', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'trial', 'suspended', 'archived')),
  custom_domain text null,
  subdomain text null unique,
  brand_name text not null,
  logo_url text null,
  favicon_url text null,
  primary_color text not null default '#111315',
  secondary_color text not null default '#16a34a',
  accent_color text not null default '#d7ff3f',
  typography jsonb not null default '{"heading":"Inter","body":"Inter"}'::jsonb,
  email_branding jsonb not null default '{}'::jsonb,
  domain_status text not null default 'not_configured' check (domain_status in ('not_configured', 'pending', 'verified', 'failed')),
  feature_overrides jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{"branches":1,"members":500,"storage_mb":1024}'::jsonb,
  compliance_settings jsonb not null default '{}'::jsonb,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete cascade,
  flag_key text not null check (flag_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  name text not null,
  description text not null default '',
  enabled boolean not null default false,
  rollout_percentage integer not null default 0 check (rollout_percentage between 0 and 100),
  target_plan_tiers text[] not null default array['starter', 'professional', 'enterprise'],
  rules jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists feature_flags_scope_key_idx
on public.feature_flags (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), flag_key);
create index if not exists feature_flags_scope_status_idx on public.feature_flags (organization_id, branch_id, status);

create table if not exists public.platform_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_tier text not null default 'starter' check (plan_tier in ('starter', 'professional', 'enterprise')),
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'cancelled', 'suspended')),
  branch_limit integer not null default 1 check (branch_limit >= 1),
  member_limit integer not null default 500 check (member_limit >= 0),
  staff_limit integer not null default 10 check (staff_limit >= 0),
  storage_limit_mb integer not null default 1024 check (storage_limit_mb >= 0),
  starts_on date not null default current_date,
  renews_on date null,
  trial_ends_on date null,
  usage_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete set null,
  branch_id uuid null references public.branches(id) on delete set null,
  actor_id uuid null references auth.users(id) on delete set null,
  event_type text not null check (char_length(event_type) between 3 and 120),
  entity_type text not null check (char_length(entity_type) between 2 and 80),
  entity_id uuid null,
  severity text not null default 'info' check (severity in ('info', 'notice', 'warning', 'critical')),
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_org_created_idx on public.activity_events (organization_id, created_at desc);
create index if not exists activity_events_branch_created_idx on public.activity_events (branch_id, created_at desc);
create index if not exists activity_events_actor_created_idx on public.activity_events (actor_id, created_at desc);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete set null,
  branch_id uuid null references public.branches(id) on delete set null,
  actor_id uuid null references auth.users(id) on delete set null,
  event_type text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  source_ip inet null,
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved', 'dismissed')),
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create index if not exists security_events_org_status_idx on public.security_events (organization_id, status, severity, created_at desc);

create table if not exists public.compliance_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete set null,
  branch_id uuid null references public.branches(id) on delete set null,
  request_type text not null check (request_type in ('data_export', 'data_deletion', 'consent_review', 'privacy_update')),
  subject_user_id uuid null references auth.users(id) on delete set null,
  requester_email text not null,
  status text not null default 'open' check (status in ('open', 'in_review', 'approved', 'completed', 'rejected')),
  due_at timestamptz null,
  completed_at timestamptz null,
  notes text null,
  metadata jsonb not null default '{}'::jsonb,
  requested_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists compliance_requests_org_status_idx on public.compliance_requests (organization_id, status, due_at);

create table if not exists public.retention_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete cascade,
  data_category text not null check (data_category in ('attendance', 'payments', 'communications', 'audit_logs', 'fitness', 'documents')),
  retention_days integer not null check (retention_days between 30 and 3650),
  disposition_action text not null default 'archive' check (disposition_action in ('archive', 'anonymize', 'delete', 'legal_hold')),
  legal_hold boolean not null default false,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  last_reviewed_at timestamptz null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists retention_policies_scope_category_idx
on public.retention_policies (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), data_category);

create table if not exists public.backup_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete set null,
  branch_id uuid null references public.branches(id) on delete set null,
  backup_type text not null check (backup_type in ('database', 'files', 'configuration', 'full')),
  scope text not null default 'tenant' check (scope in ('platform', 'tenant', 'branch')),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  storage_location text null,
  size_mb numeric(12, 2) null check (size_mb is null or size_mb >= 0),
  checksum text null,
  recovery_point_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  requested_by uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists backup_jobs_org_status_idx on public.backup_jobs (organization_id, status, created_at desc);

create table if not exists public.system_health_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete set null,
  branch_id uuid null references public.branches(id) on delete set null,
  check_key text not null,
  component text not null check (component in ('api', 'database', 'storage', 'queue', 'email', 'payments', 'auth', 'background_jobs')),
  status text not null default 'healthy' check (status in ('healthy', 'degraded', 'down', 'unknown')),
  latency_ms integer null check (latency_ms is null or latency_ms >= 0),
  message text null,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create index if not exists system_health_checks_scope_checked_idx on public.system_health_checks (organization_id, branch_id, checked_at desc);
create index if not exists system_health_checks_component_status_idx on public.system_health_checks (component, status, checked_at desc);

create table if not exists public.documentation_articles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete cascade,
  audience text not null check (audience in ('admin', 'trainer', 'member', 'api', 'deployment')),
  category text not null,
  title text not null check (char_length(title) between 3 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  body text not null,
  tags text[] not null default '{}',
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists documentation_articles_scope_slug_idx
on public.documentation_articles (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

create or replace function public.can_access_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.branch_users bu
      where bu.organization_id = target_organization_id
        and bu.user_id = (select auth.uid())
        and bu.status = 'active'
    );
$$;

create or replace function public.can_manage_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.branch_users bu
      where bu.organization_id = target_organization_id
        and bu.user_id = (select auth.uid())
        and bu.status = 'active'
        and bu.branch_role in ('owner', 'admin', 'manager')
    );
$$;

create or replace function public.can_access_branch(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.branch_users bu
      where bu.branch_id = target_branch_id
        and bu.user_id = (select auth.uid())
        and bu.status = 'active'
    );
$$;

create or replace view public.enterprise_branch_metrics_latest as
select distinct on (b.id)
  b.organization_id,
  b.id as branch_id,
  b.name as branch_name,
  b.status as branch_status,
  b.city,
  b.capacity,
  bm.metric_date,
  coalesce(bm.revenue_amount, 0) as revenue_amount,
  coalesce(bm.active_members, 0) as active_members,
  coalesce(bm.attendance_count, 0) as attendance_count,
  coalesce(bm.trainer_utilization, 0) as trainer_utilization,
  coalesce(bm.class_utilization, 0) as class_utilization,
  coalesce(bm.storage_mb, 0) as storage_mb,
  coalesce(bm.api_requests, 0) as api_requests
from public.branches b
left join public.branch_metrics bm on bm.branch_id = b.id
order by b.id, bm.metric_date desc nulls last;

create or replace view public.enterprise_tenant_usage_summary as
select
  o.id as organization_id,
  o.name as organization_name,
  o.organization_type,
  o.status as organization_status,
  tc.plan_tier,
  tc.custom_domain,
  tc.subdomain,
  ps.branch_limit,
  ps.member_limit,
  ps.storage_limit_mb,
  count(distinct b.id) as branches,
  count(distinct bu.user_id) as users,
  coalesce(sum(ebm.active_members), 0)::bigint as active_members,
  coalesce(sum(ebm.revenue_amount), 0)::numeric(14, 2) as revenue_amount,
  coalesce(sum(ebm.storage_mb), 0)::numeric(12, 2) as storage_mb
from public.organizations o
left join public.tenant_configs tc on tc.organization_id = o.id
left join public.platform_subscriptions ps on ps.organization_id = o.id
left join public.branches b on b.organization_id = o.id and b.status <> 'archived'
left join public.branch_users bu on bu.organization_id = o.id and bu.status = 'active'
left join public.enterprise_branch_metrics_latest ebm on ebm.branch_id = b.id
group by o.id, o.name, o.organization_type, o.status, tc.plan_tier, tc.custom_domain, tc.subdomain, ps.branch_limit, ps.member_limit, ps.storage_limit_mb;

create or replace view public.enterprise_security_summary as
select
  organization_id,
  status,
  severity,
  count(*)::bigint as event_count,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at
from public.security_events
group by organization_id, status, severity;

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();
drop trigger if exists set_branches_updated_at on public.branches;
create trigger set_branches_updated_at before update on public.branches for each row execute function public.set_updated_at();
drop trigger if exists set_branch_settings_updated_at on public.branch_settings;
create trigger set_branch_settings_updated_at before update on public.branch_settings for each row execute function public.set_updated_at();
drop trigger if exists set_branch_users_updated_at on public.branch_users;
create trigger set_branch_users_updated_at before update on public.branch_users for each row execute function public.set_updated_at();
drop trigger if exists set_tenant_configs_updated_at on public.tenant_configs;
create trigger set_tenant_configs_updated_at before update on public.tenant_configs for each row execute function public.set_updated_at();
drop trigger if exists set_feature_flags_updated_at on public.feature_flags;
create trigger set_feature_flags_updated_at before update on public.feature_flags for each row execute function public.set_updated_at();
drop trigger if exists set_platform_subscriptions_updated_at on public.platform_subscriptions;
create trigger set_platform_subscriptions_updated_at before update on public.platform_subscriptions for each row execute function public.set_updated_at();
drop trigger if exists set_compliance_requests_updated_at on public.compliance_requests;
create trigger set_compliance_requests_updated_at before update on public.compliance_requests for each row execute function public.set_updated_at();
drop trigger if exists set_retention_policies_updated_at on public.retention_policies;
create trigger set_retention_policies_updated_at before update on public.retention_policies for each row execute function public.set_updated_at();
drop trigger if exists set_documentation_articles_updated_at on public.documentation_articles;
create trigger set_documentation_articles_updated_at before update on public.documentation_articles for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.branch_settings enable row level security;
alter table public.branch_users enable row level security;
alter table public.branch_metrics enable row level security;
alter table public.tenant_configs enable row level security;
alter table public.feature_flags enable row level security;
alter table public.platform_subscriptions enable row level security;
alter table public.activity_events enable row level security;
alter table public.security_events enable row level security;
alter table public.compliance_requests enable row level security;
alter table public.retention_policies enable row level security;
alter table public.backup_jobs enable row level security;
alter table public.system_health_checks enable row level security;
alter table public.documentation_articles enable row level security;

grant select, insert, update on public.organizations to authenticated;
grant select, insert, update on public.branches to authenticated;
grant select, insert, update on public.branch_settings to authenticated;
grant select, insert, update on public.branch_users to authenticated;
grant select, insert, update on public.branch_metrics to authenticated;
grant select, insert, update on public.tenant_configs to authenticated;
grant select, insert, update on public.feature_flags to authenticated;
grant select, insert, update on public.platform_subscriptions to authenticated;
grant select, insert on public.activity_events to authenticated;
grant select, insert, update on public.security_events to authenticated;
grant select, insert, update on public.compliance_requests to authenticated;
grant select, insert, update on public.retention_policies to authenticated;
grant select, insert, update on public.backup_jobs to authenticated;
grant select, insert on public.system_health_checks to authenticated;
grant select, insert, update on public.documentation_articles to authenticated;
grant select on public.enterprise_branch_metrics_latest to authenticated;
grant select on public.enterprise_tenant_usage_summary to authenticated;
grant select on public.enterprise_security_summary to authenticated;
grant execute on function public.can_access_organization(uuid) to authenticated;
grant execute on function public.can_manage_organization(uuid) to authenticated;
grant execute on function public.can_access_branch(uuid) to authenticated;

drop policy if exists "organizations visible by membership" on public.organizations;
create policy "organizations visible by membership"
on public.organizations for select to authenticated
using (public.can_access_organization(id));

drop policy if exists "super admins create organizations" on public.organizations;
create policy "super admins create organizations"
on public.organizations for insert to authenticated
with check (public.is_super_admin());

drop policy if exists "organization managers update organizations" on public.organizations;
create policy "organization managers update organizations"
on public.organizations for update to authenticated
using (public.can_manage_organization(id))
with check (public.can_manage_organization(id));

drop policy if exists "branches visible by organization" on public.branches;
create policy "branches visible by organization"
on public.branches for select to authenticated
using (public.can_access_organization(organization_id));

drop policy if exists "organization managers manage branches" on public.branches;
create policy "organization managers manage branches"
on public.branches for all to authenticated
using (public.can_manage_organization(organization_id))
with check (public.can_manage_organization(organization_id));

drop policy if exists "branch settings visible by branch" on public.branch_settings;
create policy "branch settings visible by branch"
on public.branch_settings for select to authenticated
using (public.can_access_branch(branch_id));

drop policy if exists "branch settings manageable by organization managers" on public.branch_settings;
create policy "branch settings manageable by organization managers"
on public.branch_settings for all to authenticated
using (public.can_manage_organization(organization_id))
with check (public.can_manage_organization(organization_id));

drop policy if exists "branch users visible by organization" on public.branch_users;
create policy "branch users visible by organization"
on public.branch_users for select to authenticated
using (public.can_access_organization(organization_id) or user_id = (select auth.uid()));

drop policy if exists "branch users manageable by organization managers" on public.branch_users;
create policy "branch users manageable by organization managers"
on public.branch_users for all to authenticated
using (public.can_manage_organization(organization_id))
with check (public.can_manage_organization(organization_id));

drop policy if exists "branch metrics visible by organization" on public.branch_metrics;
create policy "branch metrics visible by organization"
on public.branch_metrics for select to authenticated
using (public.can_access_organization(organization_id));

drop policy if exists "branch metrics manageable by managers" on public.branch_metrics;
create policy "branch metrics manageable by managers"
on public.branch_metrics for all to authenticated
using (public.can_manage_organization(organization_id))
with check (public.can_manage_organization(organization_id));

drop policy if exists "tenant configs visible by organization" on public.tenant_configs;
create policy "tenant configs visible by organization"
on public.tenant_configs for select to authenticated
using (public.can_access_organization(organization_id));

drop policy if exists "tenant configs manageable by managers" on public.tenant_configs;
create policy "tenant configs manageable by managers"
on public.tenant_configs for all to authenticated
using (public.can_manage_organization(organization_id))
with check (public.can_manage_organization(organization_id));

drop policy if exists "feature flags visible in scope" on public.feature_flags;
create policy "feature flags visible in scope"
on public.feature_flags for select to authenticated
using (
  public.is_super_admin()
  or (organization_id is not null and public.can_access_organization(organization_id))
  or (branch_id is not null and public.can_access_branch(branch_id))
);

drop policy if exists "feature flags manageable by managers" on public.feature_flags;
create policy "feature flags manageable by managers"
on public.feature_flags for all to authenticated
using (
  public.is_super_admin()
  or (organization_id is not null and public.can_manage_organization(organization_id))
)
with check (
  public.is_super_admin()
  or (organization_id is not null and public.can_manage_organization(organization_id))
);

drop policy if exists "subscriptions visible by organization" on public.platform_subscriptions;
create policy "subscriptions visible by organization"
on public.platform_subscriptions for select to authenticated
using (public.can_access_organization(organization_id));

drop policy if exists "subscriptions manageable by super admins" on public.platform_subscriptions;
create policy "subscriptions manageable by super admins"
on public.platform_subscriptions for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "activity events visible by organization" on public.activity_events;
create policy "activity events visible by organization"
on public.activity_events for select to authenticated
using (
  public.is_super_admin()
  or (organization_id is not null and public.can_manage_organization(organization_id))
  or (branch_id is not null and public.can_access_branch(branch_id))
);

drop policy if exists "activity events insertable by authenticated users" on public.activity_events;
create policy "activity events insertable by authenticated users"
on public.activity_events for insert to authenticated
with check ((select auth.uid()) is not null);

drop policy if exists "security events visible by managers" on public.security_events;
create policy "security events visible by managers"
on public.security_events for select to authenticated
using (public.is_super_admin() or (organization_id is not null and public.can_manage_organization(organization_id)));

drop policy if exists "security events manageable by managers" on public.security_events;
create policy "security events manageable by managers"
on public.security_events for all to authenticated
using (public.is_super_admin() or (organization_id is not null and public.can_manage_organization(organization_id)))
with check (public.is_super_admin() or (organization_id is not null and public.can_manage_organization(organization_id)));

drop policy if exists "compliance requests visible by managers" on public.compliance_requests;
create policy "compliance requests visible by managers"
on public.compliance_requests for select to authenticated
using (public.is_super_admin() or (organization_id is not null and public.can_manage_organization(organization_id)));

drop policy if exists "compliance requests manageable by managers" on public.compliance_requests;
create policy "compliance requests manageable by managers"
on public.compliance_requests for all to authenticated
using (public.is_super_admin() or (organization_id is not null and public.can_manage_organization(organization_id)))
with check (public.is_super_admin() or (organization_id is not null and public.can_manage_organization(organization_id)));

drop policy if exists "retention policies visible by managers" on public.retention_policies;
create policy "retention policies visible by managers"
on public.retention_policies for select to authenticated
using (public.is_super_admin() or (organization_id is not null and public.can_manage_organization(organization_id)) or organization_id is null);

drop policy if exists "retention policies manageable by managers" on public.retention_policies;
create policy "retention policies manageable by managers"
on public.retention_policies for all to authenticated
using (public.is_super_admin() or (organization_id is not null and public.can_manage_organization(organization_id)))
with check (public.is_super_admin() or (organization_id is not null and public.can_manage_organization(organization_id)));

drop policy if exists "backup jobs visible by managers" on public.backup_jobs;
create policy "backup jobs visible by managers"
on public.backup_jobs for select to authenticated
using (public.is_super_admin() or (organization_id is not null and public.can_manage_organization(organization_id)));

drop policy if exists "backup jobs manageable by managers" on public.backup_jobs;
create policy "backup jobs manageable by managers"
on public.backup_jobs for all to authenticated
using (public.is_super_admin() or (organization_id is not null and public.can_manage_organization(organization_id)))
with check (public.is_super_admin() or (organization_id is not null and public.can_manage_organization(organization_id)));

drop policy if exists "health checks visible by managers" on public.system_health_checks;
create policy "health checks visible by managers"
on public.system_health_checks for select to authenticated
using (public.is_super_admin() or organization_id is null or (organization_id is not null and public.can_manage_organization(organization_id)));

drop policy if exists "health checks insertable by managers" on public.system_health_checks;
create policy "health checks insertable by managers"
on public.system_health_checks for insert to authenticated
with check (public.is_super_admin() or organization_id is null or (organization_id is not null and public.can_manage_organization(organization_id)));

drop policy if exists "documentation visible by audience" on public.documentation_articles;
create policy "documentation visible by audience"
on public.documentation_articles for select to authenticated
using (status = 'published' and (organization_id is null or public.can_access_organization(organization_id)));

drop policy if exists "documentation manageable by platform admins" on public.documentation_articles;
create policy "documentation manageable by platform admins"
on public.documentation_articles for all to authenticated
using (public.is_super_admin() or (organization_id is not null and public.can_manage_organization(organization_id)))
with check (public.is_super_admin() or organization_id is null or (organization_id is not null and public.can_manage_organization(organization_id)));

insert into public.feature_flags (flag_key, name, description, enabled, rollout_percentage, target_plan_tiers, status)
values
  ('multi_branch', 'Multi-Branch Operations', 'Enable organization and branch management workflows.', true, 100, array['professional', 'enterprise'], 'active'),
  ('white_label', 'White Label Branding', 'Enable tenant-controlled brand colors, logos, email branding, and domains.', true, 100, array['enterprise'], 'active'),
  ('custom_domains', 'Custom Domains', 'Enable custom branded domains and subdomains.', false, 0, array['enterprise'], 'paused'),
  ('advanced_audit_center', 'Advanced Audit Center', 'Enable enterprise-grade audit search, export, and security review workflows.', true, 100, array['professional', 'enterprise'], 'active'),
  ('backup_recovery', 'Backup and Recovery', 'Enable backup job orchestration and recovery point tracking.', true, 100, array['enterprise'], 'active')
on conflict do nothing;

insert into public.retention_policies (data_category, retention_days, disposition_action, legal_hold, status)
values
  ('attendance', 730, 'archive', false, 'active'),
  ('payments', 2555, 'archive', false, 'active'),
  ('communications', 1095, 'archive', false, 'active'),
  ('audit_logs', 2555, 'legal_hold', true, 'active'),
  ('fitness', 1095, 'anonymize', false, 'active'),
  ('documents', 1825, 'archive', false, 'active')
on conflict do nothing;

insert into public.documentation_articles (audience, category, title, slug, body, tags, status)
values
  ('admin', 'Enterprise Administration', 'Multi-Branch Setup Checklist', 'multi-branch-setup-checklist', 'Create an organization, add branches, assign branch users, configure access policies, and review branch health before onboarding members.', array['branches','settings'], 'published'),
  ('admin', 'Security', 'Audit Center Review Process', 'audit-center-review-process', 'Review login events, role changes, payment actions, settings updates, exports, and high-severity security events weekly.', array['audit','security'], 'published'),
  ('trainer', 'Operations', 'Trainer Branch Access', 'trainer-branch-access', 'Trainers can access assigned members, sessions, classes, and progress records only for branches where they are assigned.', array['trainers','branches'], 'published'),
  ('member', 'Privacy', 'Member Data Rights', 'member-data-rights', 'Members can request data exports, consent reviews, profile corrections, and deletion workflows subject to retention policy and legal obligations.', array['privacy','compliance'], 'published'),
  ('api', 'Integration', 'Tenant Isolation API Rules', 'tenant-isolation-api-rules', 'All server actions and APIs must resolve organization and branch scope server-side. Never trust tenant or branch identifiers supplied only by the client.', array['api','tenant-isolation'], 'published'),
  ('deployment', 'Release Management', 'Production Release and Rollback', 'production-release-and-rollback', 'Use development, staging, and production environments with preview deployments, database migration review, smoke checks, and documented rollback ownership.', array['deployment','rollback'], 'published')
on conflict do nothing;
