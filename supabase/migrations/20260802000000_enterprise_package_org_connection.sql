-- ════════════════════════════════════════════════════════════════════
-- Enterprise Package-Organization Connection Engine
-- ════════════════════════════════════════════════════════════════════

-- 1. Fix platform_subscriptions hardcoded plan_tier constraint
alter table public.platform_subscriptions drop constraint if exists platform_subscriptions_plan_tier_check;
alter table public.platform_subscriptions add constraint platform_subscriptions_plan_tier_check
  check (plan_tier in ('starter', 'professional', 'enterprise', 'custom'));

-- 2. Add package_version_id to organization_subscriptions
alter table public.organization_subscriptions add column if not exists package_version_id uuid references public.package_versions(id) on delete set null;
alter table public.organization_subscriptions add column if not exists apply_changes_at text not null default 'immediately' check (apply_changes_at in ('immediately', 'renewal', 'scheduled'));
alter table public.organization_subscriptions add column if not exists scheduled_change_at timestamptz null;
alter table public.organization_subscriptions add column if not exists scheduled_package_id uuid references public.packages(id) on delete set null;

-- 3. Add override support to organization_entitlements
alter table public.organization_entitlements add column if not exists overrides jsonb not null default '[]'::jsonb;
alter table public.organization_entitlements add column if not exists package_version_id uuid null;

-- 4. Organization usage limits tracking table
create table if not exists public.organization_usage_limits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  limit_key text not null,
  limit_value integer not null default 0,
  overridden_value integer null,
  override_reason text null,
  override_expires_at timestamptz null,
  override_approved_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, limit_key)
);

-- 5. Organization feature overrides table
create table if not exists public.organization_feature_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null,
  reason text not null,
  expires_at timestamptz null,
  approved_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, feature_key)
);

-- 6. Package change audit log
create table if not exists public.package_audit_log (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  action text not null,
  old_values jsonb null,
  new_values jsonb null,
  apply_mode text null,
  affected_organizations integer null,
  performed_by uuid null references auth.users(id) on delete set null,
  ip_address text null,
  created_at timestamptz not null default now()
);

-- 7. Subscription health check results
create table if not exists public.subscription_health_results (
  id uuid primary key default gen_random_uuid(),
  check_type text not null,
  status text not null check (status in ('healthy', 'warning', 'critical')),
  organization_id uuid null references public.organizations(id) on delete cascade,
  message text null,
  details jsonb null,
  checked_at timestamptz not null default now()
);

-- 8. Indexes
create index if not exists idx_org_usage_limits_org on public.organization_usage_limits(organization_id);
create index if not exists idx_org_feature_overrides_org on public.organization_feature_overrides(organization_id);
create index if not exists idx_package_audit_log_pkg on public.package_audit_log(package_id, created_at desc);
create index if not exists idx_sub_health_status on public.subscription_health_results(status, checked_at desc);

-- 9. RLS
alter table public.organization_usage_limits enable row level security;
alter table public.organization_feature_overrides enable row level security;
alter table public.package_audit_log enable row level security;
alter table public.subscription_health_results enable row level security;

create policy "super_admin manage usage_limits" on public.organization_usage_limits for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "org_owner read usage_limits" on public.organization_usage_limits for select to authenticated using (organization_id in (select id from public.organizations where owner_user_id = auth.uid()));

create policy "super_admin manage feature_overrides" on public.organization_feature_overrides for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "super_admin manage audit_log" on public.package_audit_log for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "super_admin manage health_results" on public.subscription_health_results for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

grant select, insert, update on public.organization_usage_limits to authenticated;
grant select, insert, update, delete on public.organization_feature_overrides to authenticated;
grant select, insert on public.package_audit_log to authenticated;
grant select, insert on public.subscription_health_results to authenticated;

-- 10. Function: Sync organization entitlements from package
create or replace function public.sync_org_entitlements(target_org_id uuid)
returns void as $$
declare
  v_sub record;
  v_pkg record;
  v_features jsonb := '{}'::jsonb;
  v_limits jsonb := '{}'::jsonb;
  v_overrides jsonb;
  v_feat record;
begin
  -- Get active subscription
  select * into v_sub from public.organization_subscriptions
    where organization_id = target_org_id and status = 'active'
    order by created_at desc limit 1;

  if not found then
    update public.organization_entitlements set is_active = false
      where organization_id = target_org_id;
    return;
  end if;

  -- Get package
  select * into v_pkg from public.packages where id = v_sub.package_id;
  if not found then return; end if;

  -- Build features JSON from package_features
  for v_feat in select * from public.package_features where package_id = v_pkg.id loop
    v_features := jsonb_set(v_features, array[v_feat.feature_key], to_jsonb(v_feat.enabled));
  end loop;

  -- Override with package boolean columns
  v_features := jsonb_set(v_features, '{attendance.qr}', to_jsonb(v_pkg.qr_attendance_enabled));
  v_features := jsonb_set(v_features, '{attendance.biometric}', to_jsonb(v_pkg.biometric_attendance_enabled));
  v_features := jsonb_set(v_features, '{attendance.rfid}', to_jsonb(v_pkg.rfid_attendance_enabled));

  -- Build limits JSON
  v_limits := jsonb_build_object(
    'max_members', v_pkg.max_members,
    'max_trainers', v_pkg.max_trainers,
    'max_staff', v_pkg.max_staff,
    'max_gyms', v_pkg.max_gyms,
    'max_branches', v_pkg.max_branches,
    'max_leads', v_pkg.max_leads,
    'max_storage_mb', v_pkg.max_storage_mb,
    'max_attendance_devices', v_pkg.max_attendance_devices,
    'max_ai_requests', v_pkg.max_ai_requests,
    'max_sms', v_pkg.max_sms,
    'max_emails', v_pkg.max_emails,
    'max_whatsapp_messages', v_pkg.max_whatsapp_messages,
    'max_custom_domains', v_pkg.max_custom_domains,
    'max_api_calls', v_pkg.max_api_calls
  );

  -- Get existing overrides if any
  select coalesce(jsonb_agg(jsonb_build_object(
    'feature_key', fo.feature_key, 'enabled', fo.enabled, 'reason', fo.reason
  )), '[]'::jsonb) into v_overrides
  from public.organization_feature_overrides fo
  where fo.organization_id = target_org_id and (fo.expires_at is null or fo.expires_at > now());

  -- Upsert entitlements
  insert into public.organization_entitlements (
    organization_id, subscription_id, package_id, package_name, status,
    features, limits, is_active, synced_at, expires_at
  ) values (
    target_org_id, v_sub.id, v_pkg.id, v_pkg.name, v_sub.status,
    v_features, v_limits, true, now(), v_sub.expires_at
  ) on conflict (organization_id) do update set
    subscription_id = v_sub.id,
    package_id = v_pkg.id,
    package_name = v_pkg.name,
    status = v_sub.status,
    features = v_features,
    limits = v_limits,
    is_active = true,
    overrides = v_overrides,
    synced_at = now(),
    expires_at = v_sub.expires_at;

  -- Sync usage limits to organization_usage_limits table
  insert into public.organization_usage_limits (organization_id, limit_key, limit_value)
  select target_org_id, key, value::int from jsonb_each(v_limits)
  on conflict (organization_id, limit_key) do update set
    limit_value = excluded.limit_value,
    updated_at = now();

end;
$$ language plpgsql security definer;

-- 11. Function: Check if organization has a feature entitlement
create or replace function public.has_entitlement(org_id uuid, feature_key text)
returns boolean as $$
declare
  v_features jsonb;
  v_override boolean;
begin
  -- Check override first
  select enabled into v_override from public.organization_feature_overrides
    where organization_id = org_id and feature_key = feature_key
    and (expires_at is null or expires_at > now());
  if found then return v_override; end if;

  -- Check entitlements
  select features into v_features from public.organization_entitlements
    where organization_id = org_id and is_active = true;
  if not found then return false; end if;

  return coalesce((v_features->>feature_key)::boolean, false);
end;
$$ language plpgsql stable security definer;

-- 12. Function: Check organization usage limit
create or replace function public.check_usage_limit(org_id uuid, limit_key text)
returns table(current_usage int, max_limit int, within_limit boolean) as $$
declare
  v_limit int;
  v_override int;
begin
  -- Check override
  select overridden_value into v_override from public.organization_usage_limits
    where organization_id = org_id and limit_key = limit_key
    and override_expires_at is not null and override_expires_at > now();
  if found then v_limit := v_override; else
    select limit_value into v_limit from public.organization_usage_limits
      where organization_id = org_id and limit_key = limit_key;
    if not found then v_limit := 0; end if;
  end if;

  return query
  select
    case limit_key
      when 'max_members' then (select count(*)::int from public.members where organization_id = org_id)
      when 'max_trainers' then (select count(*)::int from public.trainers where organization_id = org_id)
      when 'max_staff' then (select count(*)::int from public.branch_users where organization_id = org_id and status = 'active' and role_name != 'member')
      when 'max_gyms' then (select count(*)::int from public.gyms where organization_id = org_id and status = 'active')
      when 'max_branches' then (select count(*)::int from public.branches where organization_id = org_id and status = 'active')
      when 'max_leads' then (select count(*)::int from public.leads where organization_id = org_id)
      when 'max_storage_mb' then (select coalesce(sum(pg_total_relation_size(relid)), 0)::int / (1024*1024) from pg_stat_all_tables where schemaname = 'public' and relname like 'member_%')
      when 'max_attendance_devices' then 0
      when 'max_ai_requests' then (select count(*)::int from public.ai_chat_messages cm join public.ai_chat_sessions cs on cm.session_id = cs.id where cs.organization_id = org_id and cm.created_at > now() - interval '30 days')
      when 'max_sms' then 0
      when 'max_emails' then 0
      when 'max_whatsapp_messages' then 0
      when 'max_custom_domains' then (select count(*)::int from public.tenant_domains where organization_id = org_id and status = 'verified')
      when 'max_api_calls' then 0
      else 0
    end as current_usage,
    v_limit as max_limit,
    (case when v_limit = -1 then true else
      case limit_key
        when 'max_members' then (select count(*)::int from public.members where organization_id = org_id) < v_limit
        when 'max_trainers' then (select count(*)::int from public.trainers where organization_id = org_id) < v_limit
        when 'max_staff' then (select count(*)::int from public.branch_users where organization_id = org_id and status = 'active' and role_name != 'member') < v_limit
        when 'max_gyms' then (select count(*)::int from public.gyms where organization_id = org_id and status = 'active') < v_limit
        when 'max_branches' then (select count(*)::int from public.branches where organization_id = org_id and status = 'active') < v_limit
        when 'max_leads' then (select count(*)::int from public.leads where organization_id = org_id) < v_limit
        when 'max_custom_domains' then (select count(*)::int from public.tenant_domains where organization_id = org_id and status = 'verified') < v_limit
        else v_limit = -1
      end
    end) as within_limit;
end;
$$ language plpgsql stable security definer;

-- 13. Function: Subscription health check
create or replace function public.run_subscription_health_check()
returns table(organization_id uuid, status text, message text) as $$
declare
  v_org record;
begin
  for v_org in select id, name from public.organizations loop
    -- Check has active subscription
    if not exists (select 1 from public.organization_subscriptions
      where organization_id = v_org.id and status = 'active' and package_id is not null) then
      return query select v_org.id, 'critical'::text, 'No active subscription or package assigned'::text;
      continue;
    end if;

    -- Check has entitlements
    if not exists (select 1 from public.organization_entitlements
      where organization_id = v_org.id and is_active = true) then
      return query select v_org.id, 'warning'::text, 'Missing entitlements'::text;
      continue;
    end if;

    -- Check entitlements are fresh
    if exists (select 1 from public.organization_entitlements
      where organization_id = v_org.id and synced_at < now() - interval '24 hours') then
      return query select v_org.id, 'warning'::text, 'Entitlements not synced in 24+ hours'::text;
      continue;
    end if;

    return query select v_org.id, 'healthy'::text, 'All systems operational'::text;
  end loop;
end;
$$ language plpgsql security definer;

-- 14. Grant execute permissions
grant execute on function public.sync_org_entitlements to authenticated;
grant execute on function public.has_entitlement to authenticated;
grant execute on function public.check_usage_limit to authenticated;
grant execute on function public.run_subscription_health_check to authenticated;
