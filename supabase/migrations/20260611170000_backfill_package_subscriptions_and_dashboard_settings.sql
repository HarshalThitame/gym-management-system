-- Production dashboard readiness remediation.
-- 1. Backfill the new organization_subscriptions table from the legacy
--    platform_subscriptions table so every existing organization has a real
--    package assignment.
-- 2. Store Super Admin dashboard thresholds in database-managed settings
--    instead of hardcoding operational risk thresholds in component code.

create table if not exists public.platform_dashboard_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.platform_dashboard_settings is 'Platform-wide dashboard configuration such as readiness, freshness, usage, and SLO thresholds.';
comment on column public.platform_dashboard_settings.value is 'JSON configuration consumed by Super Admin dashboard services.';

drop trigger if exists set_platform_dashboard_settings_updated_at on public.platform_dashboard_settings;
create trigger set_platform_dashboard_settings_updated_at
before update on public.platform_dashboard_settings
for each row execute function public.set_updated_at();

alter table public.platform_dashboard_settings enable row level security;

drop policy if exists "platform dashboard settings readable by super admins" on public.platform_dashboard_settings;
create policy "platform dashboard settings readable by super admins"
on public.platform_dashboard_settings for select to authenticated
using (public.is_super_admin());

drop policy if exists "platform dashboard settings insertable by super admins" on public.platform_dashboard_settings;
create policy "platform dashboard settings insertable by super admins"
on public.platform_dashboard_settings for insert to authenticated
with check (public.is_super_admin());

drop policy if exists "platform dashboard settings updatable by super admins" on public.platform_dashboard_settings;
create policy "platform dashboard settings updatable by super admins"
on public.platform_dashboard_settings for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "platform dashboard settings deletable by super admins" on public.platform_dashboard_settings;
create policy "platform dashboard settings deletable by super admins"
on public.platform_dashboard_settings for delete to authenticated
using (public.is_super_admin());

insert into public.platform_dashboard_settings (key, value, description)
values (
  'super_admin_dashboard_thresholds',
  jsonb_build_object(
    'readiness', jsonb_build_object(
      'good', 85,
      'watch', 70,
      'criticalSecurityPenalty', 10,
      'criticalSecurityCap', 30,
      'downHealthPenalty', 14,
      'downHealthCap', 28,
      'degradedHealthPenalty', 5,
      'degradedHealthCap', 15,
      'failedBackupPenalty', 8,
      'failedBackupCap', 20,
      'failedDomainPenalty', 6,
      'failedDomainCap', 18,
      'hardBlockedSubscriptionPenalty', 5,
      'hardBlockedSubscriptionCap', 20,
      'unassignedSubscriptionPenalty', 3,
      'unassignedSubscriptionCap', 15,
      'overdueCompliancePenalty', 5,
      'overdueComplianceCap', 15
    ),
    'usage', jsonb_build_object(
      'watch', 70,
      'risk', 90
    ),
    'freshness', jsonb_build_object(
      'warningMinutes', 60,
      'staleMinutes', 1440
    ),
    'slo', jsonb_build_object(
      'uptimeTargetPercent', 99.9,
      'apiP95MsTarget', 500,
      'databaseP95MsTarget', 350,
      'queueLagMsTarget', 60000,
      'errorRateTargetPercent', 1,
      'webhookFailureTarget', 0
    )
  ),
  'Default Super Admin dashboard thresholds for readiness scoring, capacity pressure, freshness, and SLO posture.'
)
on conflict (key) do update
set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

with package_ids as (
  select
    (select id from public.packages where name = 'Lite' limit 1) as lite_id,
    (select id from public.packages where name = 'Standard' limit 1) as standard_id,
    (select id from public.packages where name = 'Premium' limit 1) as premium_id
),
legacy_subscriptions as (
  select distinct on (organization_id)
    organization_id,
    plan_tier,
    status,
    starts_on,
    renews_on,
    trial_ends_on,
    created_by
  from public.platform_subscriptions
  order by organization_id, updated_at desc
),
subscription_backfill as (
  select
    o.id as organization_id,
    case legacy.plan_tier
      when 'enterprise' then package_ids.premium_id
      when 'professional' then package_ids.standard_id
      else package_ids.lite_id
    end as package_id,
    case legacy.status
      when 'trial' then 'trial'
      when 'active' then 'active'
      when 'past_due' then 'expired'
      when 'suspended' then 'suspended'
      when 'cancelled' then 'cancelled'
      else 'active'
    end as status,
    legacy.starts_on,
    legacy.renews_on,
    legacy.trial_ends_on,
    legacy.created_by,
    legacy.organization_id is not null as had_legacy_subscription
  from public.organizations o
  cross join package_ids
  left join legacy_subscriptions legacy on legacy.organization_id = o.id
  where package_ids.lite_id is not null
)
insert into public.organization_subscriptions (
  organization_id,
  package_id,
  status,
  started_at,
  expires_at,
  trial_ends_at,
  assigned_by,
  notes
)
select
  organization_id,
  package_id,
  status,
  coalesce(starts_on::timestamptz, now()),
  renews_on::timestamptz,
  case when status = 'trial' then trial_ends_on::timestamptz else null end,
  created_by,
  case
    when had_legacy_subscription then 'Backfilled from legacy platform_subscriptions during production dashboard readiness remediation.'
    else 'Default Lite package assigned during production dashboard readiness remediation because no legacy subscription existed.'
  end
from subscription_backfill
where package_id is not null
on conflict (organization_id) do update
set
  package_id = excluded.package_id,
  status = excluded.status,
  expires_at = excluded.expires_at,
  trial_ends_at = excluded.trial_ends_at,
  assigned_by = coalesce(excluded.assigned_by, public.organization_subscriptions.assigned_by),
  notes = excluded.notes,
  updated_at = now();
