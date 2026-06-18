-- ============================================================================
-- Remove the manual subscription request-approval flow.
-- Self-service Razorpay checkout remains the only purchase/renew/upgrade path.
-- Self-service cancellation (cancel_organization_subscription) is unaffected.
--
-- Steps:
--   1. Recreate get_org_subscription_detail without the pendingRequest subquery.
--   2. Drop the request-handling RPCs (submit/approve/reject/mark_reviewing).
--   3. Drop the subscription_requests table (cascades indexes, trigger, RLS).
--   4. Drop the now-unused enum types.
-- ============================================================================

-- 1. get_org_subscription_detail: drop the pending-request lookup so it no
--    longer references subscription_requests.
create or replace function public.get_org_subscription_detail(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription public.organization_subscriptions%rowtype;
  v_package public.packages%rowtype;
  v_features jsonb;
  v_limits jsonb;
begin
  select * into v_subscription
  from public.organization_subscriptions
  where organization_id = p_organization_id
  limit 1;

  if not found then
    return jsonb_build_object('hasSubscription', false);
  end if;

  select * into v_package from public.packages where id = v_subscription.package_id;

  select jsonb_object_agg(pf.feature_code, pf.value)
  into v_features
  from public.package_features pf
  where pf.package_id = v_subscription.package_id;

  select jsonb_object_agg(pl.limit_code, jsonb_build_object('value', pl.value, 'label', pl.label))
  into v_limits
  from public.package_limits pl
  where pl.package_id = v_subscription.package_id;

  return jsonb_build_object(
    'hasSubscription', true,
    'subscriptionId', v_subscription.id,
    'packageId', v_subscription.package_id,
    'packageName', v_package.name,
    'packageSlug', v_package.slug,
    'status', v_subscription.status,
    'billingPeriod', v_subscription.billing_period,
    'priceOverride', v_subscription.price_override,
    'startedAt', v_subscription.started_at,
    'expiresAt', v_subscription.expires_at,
    'nextBillingDate', v_subscription.next_billing_date,
    'cancelledAt', v_subscription.cancelled_at,
    'features', coalesce(v_features, '{}'::jsonb),
    'limits', coalesce(v_limits, '{}'::jsonb)
  );
end;
$$;

-- 2. Drop the request-handling RPCs. Drop the grants implicitly via cascade.
drop function if exists public.submit_subscription_request(
  uuid, public.subscription_request_type, uuid, uuid, text, text, text
) cascade;

drop function if exists public.approve_subscription_request(uuid, text) cascade;

drop function if exists public.reject_subscription_request(uuid, text) cascade;

drop function if exists public.mark_subscription_request_reviewing(uuid) cascade;

-- 3. Drop the subscription_requests table. CASCADE removes its indexes,
--    trigger, RLS policies, and the updated_at trigger function binding.
drop table if exists public.subscription_requests cascade;

-- 4. Drop the now-unused enum types.
drop type if exists public.subscription_request_type;
drop type if exists public.subscription_request_status;
