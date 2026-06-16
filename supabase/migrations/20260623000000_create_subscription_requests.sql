-- Enterprise subscription request and approval system.
-- Organization owners submit requests (purchase/renewal/cancel/upgrade/downgrade/reactivation).
-- Super Admin reviews and approves/rejects. No critical change bypasses approval.

-- Subscription request types
create type public.subscription_request_type as enum (
  'purchase',
  'renewal',
  'upgrade',
  'downgrade',
  'cancellation',
  'reactivation'
);

-- Subscription request statuses
create type public.subscription_request_status as enum (
  'pending',
  'under_review',
  'approved',
  'rejected',
  'cancelled_by_organization',
  'completed'
);

-- Main subscription requests table
create table if not exists public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_type public.subscription_request_type not null,
  status public.subscription_request_status not null default 'pending',

  -- Package details
  current_package_id uuid references public.packages(id) on delete restrict,
  requested_package_id uuid references public.packages(id) on delete restrict,

  -- Pricing and billing at time of request (snapshot)
  requested_billing_period text check (requested_billing_period in ('monthly','quarterly','half_yearly','annual')),
  requested_price int check (requested_price >= 0),
  requested_currency text not null default 'INR',

  -- Date details
  requested_start_date date,
  requested_end_date date,

  -- Payment proof (for manual payment flows)
  payment_proof_url text,
  payment_proof_uploaded_at timestamptz,
  payment_note text,

  -- Actor references
  requested_by uuid not null references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  rejected_by uuid references auth.users(id) on delete set null,

  -- Notes
  reason text,
  organization_note text,
  admin_note text,
  rejection_reason text,

  -- Timestamps
  requested_at timestamptz not null default now(),
  under_review_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prevent duplicate pending requests of same type for same org
create unique index if not exists subscription_requests_one_pending_per_type_idx
on public.subscription_requests (organization_id, request_type)
where status in ('pending', 'under_review');

-- Index for Super Admin queue
create index if not exists subscription_requests_status_requested_idx
on public.subscription_requests (status, requested_at desc);

create index if not exists subscription_requests_org_status_idx
on public.subscription_requests (organization_id, status, requested_at desc);

-- Triggers
drop trigger if exists set_subscription_requests_updated_at on public.subscription_requests;
create trigger set_subscription_requests_updated_at
before update on public.subscription_requests
for each row execute function public.set_updated_at();

-- RLS
alter table public.subscription_requests enable row level security;
grant select, insert, update, delete on public.subscription_requests to authenticated;

-- Org owners can view their own requests
drop policy if exists "org owners view own subscription requests" on public.subscription_requests;
create policy "org owners view own subscription requests"
on public.subscription_requests
for select
to authenticated
using (
  organization_id = public.get_current_user_organization_id()
  and public.is_organization_owner()
);

-- Org owners can create requests for their own org
drop policy if exists "org owners create subscription requests" on public.subscription_requests;
create policy "org owners create subscription requests"
on public.subscription_requests
for insert
to authenticated
with check (
  organization_id = public.get_current_user_organization_id()
  and public.is_organization_owner()
  and requested_by = auth.uid()
  and status = 'pending'
);

-- Org owners can cancel their own pending requests
drop policy if exists "org owners cancel own pending requests" on public.subscription_requests;
create policy "org owners cancel own pending requests"
on public.subscription_requests
for update
to authenticated
using (
  organization_id = public.get_current_user_organization_id()
  and public.is_organization_owner()
  and requested_by = auth.uid()
  and status = 'pending'
)
with check (
  organization_id = public.get_current_user_organization_id()
  and public.is_organization_owner()
  and requested_by = auth.uid()
  and status = 'cancelled_by_organization'
);

-- Super Admins can view all requests
drop policy if exists "super admins view all subscription requests" on public.subscription_requests;
create policy "super admins view all subscription requests"
on public.subscription_requests
for select
to authenticated
using (public.is_super_admin());

-- Super Admins can manage all requests
drop policy if exists "super admins manage subscription requests" on public.subscription_requests;
create policy "super admins manage subscription requests"
on public.subscription_requests
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- Function: submit subscription request
create or replace function public.submit_subscription_request(
  p_organization_id uuid,
  p_request_type public.subscription_request_type,
  p_requested_package_id uuid default null,
  p_current_package_id uuid default null,
  p_requested_billing_period text default null,
  p_reason text default null,
  p_organization_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org public.organizations%rowtype;
  v_current_subscription public.organization_subscriptions%rowtype;
  v_requested_package public.packages%rowtype;
  v_existing_request_id uuid;
  v_pricing jsonb;
  v_request_id uuid;
begin
  -- Validate user is org owner for this org
  if not public.is_organization_owner() then
    raise exception 'Only organization owners can submit subscription requests.'
      using errcode = '42501';
  end if;

  -- Validate org exists
  select * into v_org from public.organizations where id = p_organization_id;
  if not found then
    raise exception 'Organization not found.' using errcode = 'P0002';
  end if;

  -- Check for existing pending request of same type
  select id into v_existing_request_id
  from public.subscription_requests
  where organization_id = p_organization_id
    and request_type = p_request_type
    and status in ('pending', 'under_review')
  limit 1;

  if found then
    raise exception 'A % request is already pending for this organization. Complete or cancel it first.', p_request_type
      using errcode = '22023';
  end if;

  -- Get current subscription if exists
  select * into v_current_subscription
  from public.organization_subscriptions
  where organization_id = p_organization_id
  limit 1;

  -- Validate and get requested package pricing
  if p_requested_package_id is not null then
    select * into v_requested_package from public.packages where id = p_requested_package_id;
    if not found then
      raise exception 'Requested package not found.' using errcode = 'P0002';
    end if;

    select jsonb_agg(jsonb_build_object(
      'billing_period', pp.billing_period,
      'price', pp.price,
      'currency', pp.currency,
      'setup_fee', pp.setup_fee
    ))
    into v_pricing
    from public.package_pricing pp
    where pp.package_id = p_requested_package_id and pp.is_active = true;
  end if;

  -- Create the request
  insert into public.subscription_requests (
    organization_id,
    request_type,
    status,
    current_package_id,
    requested_package_id,
    requested_billing_period,
    requested_price,
    requested_by,
    reason,
    organization_note
  )
  values (
    p_organization_id,
    p_request_type,
    'pending',
    v_current_subscription.package_id,
    p_requested_package_id,
    coalesce(p_requested_billing_period, v_current_subscription.billing_period),
    case when p_requested_package_id is not null and v_pricing is not null
      then (v_pricing->0->>'price')::int
      else null
    end,
    v_user_id,
    p_reason,
    p_organization_note
  )
  returning id into v_request_id;

  return jsonb_build_object(
    'requestId', v_request_id,
    'organizationId', p_organization_id,
    'requestType', p_request_type,
    'status', 'pending'
  );
end;
$$;

grant execute on function public.submit_subscription_request(uuid, public.subscription_request_type, uuid, uuid, text, text, text)
to authenticated;

-- Function: approve subscription request and execute it
create or replace function public.approve_subscription_request(
  p_request_id uuid,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.subscription_requests%rowtype;
  v_user_id uuid := auth.uid();
  v_subscription_id uuid;
  v_old_status text;
begin
  if not public.is_super_admin() then
    raise exception 'Only Super Admins can approve subscription requests.'
      using errcode = '42501';
  end if;

  select * into v_request
  from public.subscription_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Subscription request not found.' using errcode = 'P0002';
  end if;

  if v_request.status not in ('pending', 'under_review') then
    raise exception 'Request is already %.', v_request.status using errcode = '22023';
  end if;

  -- Execute the request based on type
  case v_request.request_type
    when 'purchase' then
      -- Create or update subscription
      insert into public.organization_subscriptions (
        organization_id,
        package_id,
        status,
        billing_period,
        price_override,
        started_at,
        assigned_by,
        notes
      )
      values (
        v_request.organization_id,
        v_request.requested_package_id,
        'active',
        v_request.requested_billing_period,
        v_request.requested_price,
        now(),
        v_user_id,
        coalesce(p_admin_note, 'Purchased via approval request.')
      )
      on conflict (organization_id) do update
      set
        package_id = excluded.package_id,
        status = excluded.status,
        billing_period = excluded.billing_period,
        price_override = excluded.price_override,
        assigned_by = excluded.assigned_by,
        notes = excluded.notes,
        updated_at = now()
      returning id into v_subscription_id;

    when 'renewal' then
      update public.organization_subscriptions
      set
        status = 'active',
        expires_at = case
          when billing_period = 'monthly' then now() + interval '1 month'
          when billing_period = 'quarterly' then now() + interval '3 months'
          when billing_period = 'half_yearly' then now() + interval '6 months'
          when billing_period = 'annual' then now() + interval '1 year'
          else now() + interval '1 month'
        end,
        next_billing_date = case
          when billing_period = 'monthly' then now() + interval '1 month'
          when billing_period = 'quarterly' then now() + interval '3 months'
          when billing_period = 'half_yearly' then now() + interval '6 months'
          when billing_period = 'annual' then now() + interval '1 year'
          else now() + interval '1 month'
        end,
        updated_at = now()
      where organization_id = v_request.organization_id
      returning id into v_subscription_id;

    when 'upgrade' then
      select id into v_subscription_id
      from public.organization_subscriptions
      where organization_id = v_request.organization_id;

      update public.organization_subscriptions
      set
        package_id = coalesce(v_request.requested_package_id, package_id),
        price_override = coalesce(v_request.requested_price, price_override),
        billing_period = coalesce(v_request.requested_billing_period::text, billing_period)::text,
        updated_at = now()
      where id = v_subscription_id;

    when 'downgrade' then
      select id into v_subscription_id
      from public.organization_subscriptions
      where organization_id = v_request.organization_id;

      update public.organization_subscriptions
      set
        package_id = coalesce(v_request.requested_package_id, package_id),
        price_override = coalesce(v_request.requested_price, price_override),
        billing_period = coalesce(v_request.requested_billing_period::text, billing_period)::text,
        updated_at = now()
      where id = v_subscription_id;

    when 'cancellation' then
      update public.organization_subscriptions
      set
        status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = coalesce(v_request.reason, 'Cancelled by Super Admin approval.'),
        updated_at = now()
      where organization_id = v_request.organization_id
      returning id into v_subscription_id;

    when 'reactivation' then
      update public.organization_subscriptions
      set
        status = 'active',
        updated_at = now()
      where organization_id = v_request.organization_id
      returning id into v_subscription_id;
  end case;

  -- Mark request as approved and completed
  update public.subscription_requests
  set
    status = 'approved',
    approved_by = v_user_id,
    admin_note = coalesce(p_admin_note, admin_note),
    approved_at = now(),
    completed_at = now(),
    updated_at = now()
  where id = p_request_id;

  -- Record in subscription_events
  insert into public.subscription_events (
    organization_id,
    subscription_id,
    event_type,
    previous_state,
    new_state,
    actor_id,
    reason
  ) values (
    v_request.organization_id,
    v_subscription_id,
    case v_request.request_type
      when 'purchase' then 'created'
      when 'renewal' then 'renewed'
      when 'upgrade' then 'upgraded'
      when 'downgrade' then 'downgraded'
      when 'cancellation' then 'cancelled'
      when 'reactivation' then 'reactivated'
    end,
    row_to_json(v_request)::jsonb,
    jsonb_build_object('status', 'approved', 'subscriptionId', v_subscription_id),
    v_user_id,
    v_request.reason
  );

  return jsonb_build_object(
    'requestId', p_request_id,
    'subscriptionId', v_subscription_id,
    'action', v_request.request_type,
    'status', 'approved'
  );
end;
$$;

grant execute on function public.approve_subscription_request(uuid, text)
to authenticated;

-- Function: reject subscription request
create or replace function public.reject_subscription_request(
  p_request_id uuid,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.subscription_requests%rowtype;
  v_user_id uuid := auth.uid();
begin
  if not public.is_super_admin() then
    raise exception 'Only Super Admins can reject subscription requests.'
      using errcode = '42501';
  end if;

  select * into v_request
  from public.subscription_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Subscription request not found.' using errcode = 'P0002';
  end if;

  if v_request.status not in ('pending', 'under_review') then
    raise exception 'Request is already %.', v_request.status using errcode = '22023';
  end if;

  update public.subscription_requests
  set
    status = 'rejected',
    rejected_by = v_user_id,
    rejection_reason = coalesce(p_rejection_reason, rejection_reason),
    rejected_at = now(),
    updated_at = now()
  where id = p_request_id;

  return jsonb_build_object(
    'requestId', p_request_id,
    'status', 'rejected'
  );
end;
$$;

grant execute on function public.reject_subscription_request(uuid, text)
to authenticated;

-- Function: mark request as under review
create or replace function public.mark_subscription_request_reviewing(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only Super Admins can review subscription requests.'
      using errcode = '42501';
  end if;

  update public.subscription_requests
  set status = 'under_review', under_review_at = now(), updated_at = now()
  where id = p_request_id and status = 'pending';

  return jsonb_build_object('requestId', p_request_id, 'status', 'under_review');
end;
$$;

grant execute on function public.mark_subscription_request_reviewing(uuid)
to authenticated;

-- Function: get current subscription with feature/limit info
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
  v_pending_request jsonb;
  v_result jsonb;
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

  select jsonb_agg(jsonb_build_object(
    'id', sr.id,
    'requestType', sr.request_type,
    'status', sr.status,
    'requestedAt', sr.requested_at,
    'requestedPackageId', sr.requested_package_id
  )) into v_pending_request
  from public.subscription_requests sr
  where sr.organization_id = p_organization_id
    and sr.status in ('pending', 'under_review')
  limit 1;

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
    'limits', coalesce(v_limits, '{}'::jsonb),
    'pendingRequest', v_pending_request
  );
end;
$$;

grant execute on function public.get_org_subscription_detail(uuid)
to authenticated;
