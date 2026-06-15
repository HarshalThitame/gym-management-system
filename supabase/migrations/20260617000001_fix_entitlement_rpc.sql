-- Fix: Recreate refresh_organization_entitlements with proper jsonb type casting
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
begin
  select * into v_sub
  from public.organization_subscriptions
  where organization_id = p_organization_id
  order by started_at desc
  limit 1;

  if not found then
    insert into public.organization_entitlements (organization_id, package_id, package_name, status, features, limits, is_active, synced_at)
    values (p_organization_id, null, null, 'none', '{}'::jsonb, '{}'::jsonb, false, now())
    on conflict (organization_id) do update set
      package_id = null, package_name = null, status = 'none', features = '{}'::jsonb, limits = '{}'::jsonb, is_active = false, synced_at = now();
    return jsonb_build_object('ok', true, 'status', 'none');
  end if;

  select jsonb_object_agg(fc.feature_key,
    case when pf.value::text = 'true' then true else false end)
  into v_features
  from public.package_features pf
  join public.feature_catalog fc on fc.code = pf.feature_code
  where pf.package_id = v_sub.package_id;

  select jsonb_object_agg(pl.limit_code, pl.value) into v_limits
  from public.package_limits pl where pl.package_id = v_sub.package_id;

  insert into public.organization_entitlements (
    organization_id, subscription_id, package_id, package_name, status, features, limits, is_active, synced_at, expires_at
  ) values (
    p_organization_id, v_sub.id, v_sub.package_id,
    (select name from public.packages where id = v_sub.package_id),
    v_sub.status, coalesce(v_features, '{}'::jsonb), coalesce(v_limits, '{}'::jsonb),
    (v_sub.status in ('active', 'trial') and not (v_sub.status = 'trial' and v_sub.trial_ends_at is not null and v_sub.trial_ends_at < now())),
    now(), v_sub.expires_at
  )
  on conflict (organization_id) do update set
    subscription_id = v_sub.id, package_id = v_sub.package_id,
    package_name = (select name from public.packages where id = v_sub.package_id),
    status = v_sub.status, features = coalesce(v_features, '{}'::jsonb),
    limits = coalesce(v_limits, '{}'::jsonb),
    is_active = (v_sub.status in ('active', 'trial') and not (v_sub.status = 'trial' and v_sub.trial_ends_at is not null and v_sub.trial_ends_at < now())),
    synced_at = now(), expires_at = v_sub.expires_at;

  insert into public.entitlement_audit_logs (organization_id, action, new_value, reason)
  values (p_organization_id, 'entitlement_refreshed',
    jsonb_build_object('features', v_features, 'limits', v_limits, 'status', v_sub.status),
    'Entitlements refreshed from subscription');

  return jsonb_build_object('ok', true, 'status', v_sub.status);
end;
$$;
