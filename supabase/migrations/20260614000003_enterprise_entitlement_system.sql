-- Centralized Enterprise Feature Entitlement System
-- Adds dot-notation feature keys, cached org entitlements,
-- entitlement audit logging, and feature usage tracking.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Add feature_key (dot notation) to feature_catalog
-- ════════════════════════════════════════════════════════════════════════

alter table public.feature_catalog add column if not exists feature_key text;
comment on column public.feature_catalog.feature_key is 'Dot-notation key (e.g. attendance.qr). Used for API exposure and UI display.';

-- Populate feature_key values
with cat_map as (
  select id, code from public.feature_categories
)
update public.feature_catalog fc
set feature_key = (
  select cm.code from cat_map cm where cm.id = fc.category_id
) || '.' || fc.code
where feature_key is null;

alter table public.feature_catalog alter column feature_key set not null;
create unique index if not exists feature_catalog_feature_key_idx on public.feature_catalog (feature_key);

-- ════════════════════════════════════════════════════════════════════════
-- 2. organization_entitlements — materialized per-org entitlement snapshot
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.organization_entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.organization_subscriptions(id) on delete set null,
  package_id uuid references public.packages(id) on delete set null,
  package_name text,
  status text,
  features jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  synced_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

comment on table public.organization_entitlements is 'Cached, denormalized entitlement snapshot per organization. Single source of truth for feature access.';
comment on column public.organization_entitlements.features is 'JSON object of feature_key -> boolean/value entitlements';
comment on column public.organization_entitlements.limits is 'JSON object of limit_key -> numeric value';

create index if not exists org_entitlements_org_idx on public.organization_entitlements (organization_id);
create index if not exists org_entitlements_pkg_idx on public.organization_entitlements (package_id);
create index if not exists org_entitlements_active_idx on public.organization_entitlements (is_active) where is_active = true;

alter table public.organization_entitlements enable row level security;

drop policy if exists "org entitlements super admin" on public.organization_entitlements;
create policy "org entitlements super admin"
  on public.organization_entitlements for select to authenticated
  using (public.is_super_admin());

drop policy if exists "org entitlements org owner" on public.organization_entitlements;
create policy "org entitlements org owner"
  on public.organization_entitlements for select to authenticated
  using (public.is_organization_owner(organization_id));

drop policy if exists "org entitlements insert" on public.organization_entitlements;
create policy "org entitlements insert"
  on public.organization_entitlements for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "org entitlements update" on public.organization_entitlements;
create policy "org entitlements update"
  on public.organization_entitlements for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop trigger if exists set_org_entitlements_updated_at on public.organization_entitlements;
create trigger set_org_entitlements_updated_at
  before update on public.organization_entitlements
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- 3. entitlement_audit_logs — every entitlement change
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.entitlement_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in (
    'entitlement_refreshed', 'entitlement_synced',
    'feature_granted', 'feature_revoked',
    'limit_increased', 'limit_decreased',
    'subscription_upgraded', 'subscription_downgraded',
    'subscription_expired', 'subscription_suspended',
    'plan_changed', 'package_updated',
    'manual_override', 'admin_grant'
  )),
  feature_key text,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.entitlement_audit_logs is 'Immutable audit trail of every entitlement change per organization.';

create index if not exists entitlement_audit_org_idx on public.entitlement_audit_logs (organization_id, created_at desc);
create index if not exists entitlement_audit_action_idx on public.entitlement_audit_logs (action);

alter table public.entitlement_audit_logs enable row level security;

drop policy if exists "ent audit super admin" on public.entitlement_audit_logs;
create policy "ent audit super admin"
  on public.entitlement_audit_logs for select to authenticated
  using (public.is_super_admin());

drop policy if exists "ent audit org owner" on public.entitlement_audit_logs;
create policy "ent audit org owner"
  on public.entitlement_audit_logs for select to authenticated
  using (public.is_organization_owner(organization_id));

drop policy if exists "ent audit insert" on public.entitlement_audit_logs;
create policy "ent audit insert"
  on public.entitlement_audit_logs for insert to authenticated
  with check (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════
-- 4. feature_usage_tracking — per-org feature metering
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.feature_usage_tracking (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feature_key text not null,
  usage_count bigint not null default 0,
  usage_limit bigint not null default -1,
  period_start date not null default current_date,
  period_end date not null default (current_date + interval '1 month'),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, feature_key, period_start)
);

comment on table public.feature_usage_tracking is 'Usage metering per feature per org. Supports usage-based billing and quota enforcement.';

create index if not exists feature_usage_org_idx on public.feature_usage_tracking (organization_id, feature_key);
create index if not exists feature_usage_period_idx on public.feature_usage_tracking (period_start, period_end);

alter table public.feature_usage_tracking enable row level security;

drop policy if exists "feature usage super admin" on public.feature_usage_tracking;
create policy "feature usage super admin"
  on public.feature_usage_tracking for select to authenticated
  using (public.is_super_admin());

drop policy if exists "feature usage org owner" on public.feature_usage_tracking;
create policy "feature usage org owner"
  on public.feature_usage_tracking for select to authenticated
  using (public.is_organization_owner(organization_id));

-- ════════════════════════════════════════════════════════════════════════
-- 5. RPC: refresh_organization_entitlements
-- Atomically refreshes the cached entitlement snapshot for an org.
-- This is the single source of truth synchronization function.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.refresh_organization_entitlements(
  p_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_features jsonb;
  v_limits jsonb;
  v_result jsonb;
begin
  -- Get current subscription
  select * into v_sub
  from public.organization_subscriptions
  where organization_id = p_organization_id
  order by started_at desc
  limit 1;

  if not found then
    -- No subscription: empty entitlements
    insert into public.organization_entitlements (
      organization_id, package_id, package_name, status,
      features, limits, is_active, synced_at
    ) values (
      p_organization_id, null, null, 'none',
      '{}'::jsonb, '{}'::jsonb, false, now()
    )
    on conflict (organization_id) do update set
      package_id = null, package_name = null, status = 'none',
      features = '{}'::jsonb, limits = '{}'::jsonb,
      is_active = false, synced_at = now();

    return jsonb_build_object('ok', true, 'status', 'none');
  end if;

  -- Build features JSON: feature_key -> boolean
  select jsonb_object_agg(
    fc.feature_key,
    case
      when pf.value::text = 'true' then true
      when pf.value::text = 'false' then false
      else coalesce(pf.value::boolean, false)
    end
  ) into v_features
  from public.package_features pf
  join public.feature_catalog fc on fc.code = pf.feature_code
  where pf.package_id = v_sub.package_id;

  -- Build limits JSON: limit_code -> value
  select jsonb_object_agg(pl.limit_code, pl.value) into v_limits
  from public.package_limits pl
  where pl.package_id = v_sub.package_id;

  -- Determine active status
  declare
    v_is_active boolean;
    v_pkg_name text;
  begin
    v_is_active := v_sub.status in ('active', 'trial');
    if v_sub.status = 'trial' and v_sub.trial_ends_at is not null and v_sub.trial_ends_at < now() then
      v_is_active := false;
    end if;

    select name into v_pkg_name from public.packages where id = v_sub.package_id;

    -- Upsert entitlements
    insert into public.organization_entitlements (
      organization_id, subscription_id, package_id, package_name,
      status, features, limits, is_active, synced_at, expires_at
    ) values (
      p_organization_id, v_sub.id, v_sub.package_id, v_pkg_name,
      v_sub.status,
      coalesce(v_features, '{}'::jsonb),
      coalesce(v_limits, '{}'::jsonb),
      v_is_active, now(), v_sub.expires_at
    )
    on conflict (organization_id) do update set
      subscription_id = v_sub.id,
      package_id = v_sub.package_id,
      package_name = v_pkg_name,
      status = v_sub.status,
      features = coalesce(v_features, '{}'::jsonb),
      limits = coalesce(v_limits, '{}'::jsonb),
      is_active = v_is_active,
      synced_at = now(),
      expires_at = v_sub.expires_at;

    -- Record audit log
    insert into public.entitlement_audit_logs (
      organization_id, action,
      new_value, reason
    ) values (
      p_organization_id, 'entitlement_refreshed',
      jsonb_build_object('features', v_features, 'limits', v_limits, 'package', v_pkg_name, 'status', v_sub.status),
      'Entitlements refreshed from subscription'
    );

    return jsonb_build_object('ok', true, 'status', v_sub.status, 'is_active', v_is_active, 'package', v_pkg_name);
  end;
end;
$$;

comment on function public.refresh_organization_entitlements is 'Single source of truth sync: reads subscription + package_features + package_limits and materializes into organization_entitlements.';

-- ════════════════════════════════════════════════════════════════════════
-- 6. Trigger: auto-refresh entitlements on subscription changes
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.auto_refresh_entitlements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_organization_entitlements(new.organization_id);
  return new;
end;
$$;

drop trigger if exists refresh_entitlements_on_sub_change on public.organization_subscriptions;
create trigger refresh_entitlements_on_sub_change
  after insert or update of status, package_id, expires_at, trial_ends_at
  on public.organization_subscriptions
  for each row
  execute function public.auto_refresh_entitlements();

-- ════════════════════════════════════════════════════════════════════════
-- 7. Update feature_catalog RLS for new columns
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists "catalog readable by all authenticated" on public.feature_catalog;
create policy "catalog readable by all authenticated"
  on public.feature_catalog for select to authenticated
  using (true);

-- ════════════════════════════════════════════════════════════════════════
-- 8. Create view: org_active_entitlements for easy querying
-- ════════════════════════════════════════════════════════════════════════

create or replace view public.org_active_entitlements as
select
  oe.organization_id,
  oe.package_id,
  oe.package_name,
  oe.status,
  oe.is_active,
  oe.synced_at,
  oe.expires_at,
  oe.features,
  oe.limits,
  -- Boolean feature access columns for backward compatibility
  (oe.features ->> 'attendance.qr')::boolean as qr_attendance_enabled,
  (oe.features ->> 'attendance.biometric')::boolean as biometric_attendance_enabled,
  (oe.features ->> 'attendance.rfid')::boolean as rfid_attendance_enabled,
  (oe.features ->> 'attendance.nfc')::boolean as nfc_attendance_enabled,
  (oe.features ->> 'ai.recommendations')::boolean as ai_recommendations_enabled,
  (oe.features ->> 'branding.custom_domain')::boolean as custom_domain_enabled,
  (oe.features ->> 'branding.white_label')::boolean as white_label_enabled,
  (oe.features ->> 'integrations.api')::boolean as api_access_enabled,
  (oe.features ->> 'multi_branch.enabled')::boolean as multi_branch_enabled,
  (oe.features ->> 'franchise.management')::boolean as franchise_management_enabled,
  -- Limit columns
  (oe.limits ->> 'max_members')::int as max_members,
  (oe.limits ->> 'max_branches')::int as max_branches,
  (oe.limits ->> 'max_gyms')::int as max_gyms,
  (oe.limits ->> 'max_trainers')::int as max_trainers,
  (oe.limits ->> 'max_staff')::int as max_staff
from public.organization_entitlements oe;

comment on view public.org_active_entitlements is 'Denormalized view of active org entitlements with feature and limit columns for backward compatibility.';
