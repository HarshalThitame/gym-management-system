-- ============================================================================
-- Enterprise Hardening: Production Readiness Audit Fixes
-- 
-- This migration applies all fixes identified by the comprehensive
-- enterprise audit of the Package and Subscription modules.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- FIX 1: Add missing columns to packages table for complete feature gating
-- ════════════════════════════════════════════════════════════════════════════

alter table public.packages add column if not exists max_storage_gb integer not null default 0
  check (max_storage_gb = -1 or max_storage_gb >= 0);
comment on column public.packages.max_storage_gb is 'Maximum storage in GB. Use -1 for unlimited. 0 means no storage.';

alter table public.packages add column if not exists max_trainers integer not null default 0
  check (max_trainers = -1 or max_trainers >= 0);
comment on column public.packages.max_trainers is 'Maximum trainer accounts. Use -1 for unlimited. 0 means no trainers.';

alter table public.packages add column if not exists max_api_calls integer not null default 0
  check (max_api_calls = -1 or max_api_calls >= 0);
comment on column public.packages.max_api_calls is 'Monthly API call limit. Use -1 for unlimited. 0 means no API access.';

alter table public.packages add column if not exists notifications_enabled boolean not null default false;
comment on column public.packages.notifications_enabled is 'Enable push/email/SMS notification features.';

alter table public.packages add column if not exists white_label_enabled boolean not null default false;
comment on column public.packages.white_label_enabled is 'Enable white-label branding (custom domain, remove branding).';

alter table public.packages add column if not exists max_gyms integer not null default 1
  check (max_gyms = -1 or max_gyms >= 1);
comment on column public.packages.max_gyms is 'Maximum gyms per organization. Use -1 for unlimited.';

alter table public.packages add column if not exists trial_days integer not null default 0
  check (trial_days >= 0);
comment on column public.packages.trial_days is 'Default trial duration in days for this package. 0 = no trial.';

alter table public.packages add column if not exists setup_fee integer not null default 0
  check (setup_fee >= 0);
comment on column public.packages.setup_fee is 'One-time setup fee in paise/cents.';

alter table public.packages add column if not exists package_version integer not null default 1
  check (package_version >= 1);
comment on column public.packages.package_version is 'Incremented on each substantive package update.';

alter table public.packages add column if not exists previous_version_id uuid
  references public.packages(id) on delete set null;
comment on column public.packages.previous_version_id is 'Links to the previous version of this package for audit trail.';

alter table public.packages add column if not exists archived_at timestamptz;
comment on column public.packages.archived_at is 'When the package was archived (soft-delete).';

alter table public.packages add column if not exists deprecation_message text;
comment on column public.packages.deprecation_message is 'Message shown to orgs when their package is deprecated.';

-- ════════════════════════════════════════════════════════════════════════════
-- FIX 2 & 3: Database-level state machine enforcement trigger
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.validate_subscription_status_transition()
returns trigger
language plpgsql
as $$
declare
  valid boolean;
begin
  -- Allow setting initial status on insert
  if tg_op = 'INSERT' then
    if new.status not in ('active', 'trial', 'expired', 'suspended', 'cancelled') then
      raise exception 'Invalid subscription status: %', new.status;
    end if;
    return new;
  end if;

  -- Validate status transitions
  select exists (
    select 1
    from (values
      ('trial', 'active'), ('trial', 'expired'), ('trial', 'suspended'),
      ('active', 'suspended'), ('active', 'expired'),
      ('suspended', 'active'), ('suspended', 'expired'), ('suspended', 'cancelled'),
      ('expired', 'active'), ('cancelled', 'expired')
    ) as t(from_status, to_status)
    where t.from_status = old.status and t.to_status = new.status
  ) into valid;

  if not valid then
    raise exception 'Invalid subscription status transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_subscription_status_transition on public.organization_subscriptions;
create trigger enforce_subscription_status_transition
  before update of status on public.organization_subscriptions
  for each row
  execute function public.validate_subscription_status_transition();

-- Auto-expiry trigger: mark expired when past expires_at
create or replace function public.auto_expire_subscription()
returns trigger
language plpgsql
as $$
begin
  if new.expires_at is not null
    and new.expires_at <= now()
    and new.status in ('active', 'trial')
  then
    new.status = 'expired';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_auto_expire_subscription on public.organization_subscriptions;

-- ════════════════════════════════════════════════════════════════════════════
-- FIX 4: Unique constraint on pending scheduled changes per subscription
-- ════════════════════════════════════════════════════════════════════════════

create unique index if not exists scheduled_plan_changes_pending_unique
  on public.scheduled_plan_changes (subscription_id)
  where status = 'pending';

-- Also prevent conflicting scheduled changes (same subscription, same time)
create unique index if not exists scheduled_plan_changes_unique_effective
  on public.scheduled_plan_changes (subscription_id, effective_date)
  where status = 'pending';

-- ════════════════════════════════════════════════════════════════════════════
-- FIX 14: Additional CHECK constraints for data integrity
-- ════════════════════════════════════════════════════════════════════════════

-- Ensure cancelled_at is set when status is cancelled
alter table public.organization_subscriptions
  drop constraint if exists check_cancelled_status;
alter table public.organization_subscriptions
  add constraint check_cancelled_status
  check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status != 'cancelled')
  );

-- Ensure trial_ends_at is set when status is trial
alter table public.organization_subscriptions
  drop constraint if exists check_trial_status;
alter table public.organization_subscriptions
  add constraint check_trial_status
  check (
    (status = 'trial' and trial_ends_at is not null)
    or (status != 'trial')
  );

-- Ensure expires_at is in the future when set
alter table public.organization_subscriptions
  drop constraint if exists check_expires_at_future;
alter table public.organization_subscriptions
  add constraint check_expires_at_future
  check (
    expires_at is null
    or expires_at > created_at
  );

-- Ensure dunning_attempts doesn't exceed max
alter table public.organization_subscriptions
  drop constraint if exists check_dunning_attempts_range;
alter table public.organization_subscriptions
  add constraint check_dunning_attempts_range
  check (dunning_attempts >= 0 and dunning_attempts <= 10);

-- Ensure sort_order is unique across packages
alter table public.packages
  drop constraint if exists packages_sort_order_unique;
alter table public.packages
  add constraint packages_sort_order_unique unique (sort_order);

-- ════════════════════════════════════════════════════════════════════════════
-- FIX 15: Add package version history tracking
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.package_version_history (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  change_description text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (package_id, version)
);

comment on table public.package_version_history is 'Immutable history of package changes for audit and rollback.';

create index if not exists package_version_history_pkg_idx
  on public.package_version_history (package_id, version desc);

-- ════════════════════════════════════════════════════════════════════════════
-- FIX: Add subscription expiry/cancellation cleanup trigger
-- When a subscription transitions to cancelled, schedule data retention
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.handle_subscription_cancelled()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelled' and old.status != 'cancelled' then
    -- Set the data retention expiry date
    new.expires_at = now() + (coalesce(new.data_retention_days, 90) || ' days')::interval;
  end if;
  return new;
end;
$$;

drop trigger if exists on_subscription_cancelled on public.organization_subscriptions;
create trigger on_subscription_cancelled
  before update of status on public.organization_subscriptions
  for each row
  when (new.status = 'cancelled')
  execute function public.handle_subscription_cancelled();

-- ════════════════════════════════════════════════════════════════════════════
-- FIX: Add index for subscription billing queries (performance)
-- ════════════════════════════════════════════════════════════════════════════

create index if not exists organization_subscriptions_next_billing_idx
  on public.organization_subscriptions (next_billing_date)
  where status = 'active' and next_billing_date is not null;

create index if not exists organization_subscriptions_billing_org_idx
  on public.organization_subscriptions (organization_id, next_billing_date)
  where status = 'active';

create index if not exists subscription_addons_sub_id_addon_idx
  on public.subscription_addons (subscription_id, addon_id);

-- ════════════════════════════════════════════════════════════════════════════
-- FIX: Update package RLS - ensure super_admin isolation
-- ════════════════════════════════════════════════════════════════════════════

-- Package version history: only super admins can read
alter table public.package_version_history enable row level security;

drop policy if exists "pkg version history super admin" on public.package_version_history;
create policy "pkg version history super admin"
  on public.package_version_history for select to authenticated
  using (public.is_super_admin());

drop policy if exists "pkg version history insert super admin" on public.package_version_history;
create policy "pkg version history insert super admin"
  on public.package_version_history for insert to authenticated
  with check (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- FIX: Update seed data for new columns
-- ════════════════════════════════════════════════════════════════════════════

update public.packages set
  max_storage_gb = case
    when name ilike '%lite%' then 5
    when name = 'Standard' then 50
    when name = 'Premium' then -1
    else 0
  end,
  max_trainers = case
    when name ilike '%lite%' then 5
    when name = 'Standard' then 20
    when name = 'Premium' then -1
    else 0
  end,
  max_api_calls = case
    when name ilike '%lite%' then 1000
    when name = 'Standard' then 10000
    when name = 'Premium' then -1
    else 0
  end,
  notifications_enabled = case
    when name ilike '%lite%' then true
    when name = 'Standard' then true
    when name = 'Premium' then true
    else false
  end,
  white_label_enabled = case
    when name ilike '%lite%' then false
    when name = 'Standard' then false
    when name = 'Premium' then true
    else false
  end,
  max_gyms = case
    when name ilike '%lite%' then 1
    when name = 'Standard' then 3
    when name = 'Premium' then -1
    else 1
  end,
  trial_days = case
    when name ilike '%lite%' then 14
    when name = 'Standard' then 14
    when name = 'Premium' then 30
    else 0
  end,
  setup_fee = 0,
  package_version = 1
where package_version = 1 or package_version is null;

-- ════════════════════════════════════════════════════════════════════════════
-- FIX: RPC for atomic subscription upgrade within a DB transaction
-- This ensures that the upgrade and all side effects happen atomically.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.atomic_upgrade_subscription(
  p_subscription_id uuid,
  p_new_package_id uuid,
  p_assigned_by uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_new_pkg record;
  v_old_pkg record;
  v_result jsonb;
begin
  -- Lock the subscription row to prevent concurrent modifications
  select * into v_sub
  from public.organization_subscriptions
  where id = p_subscription_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Subscription not found');
  end if;

  -- Verify target package exists and is active
  select * into v_new_pkg
  from public.packages
  where id = p_new_package_id and is_active = true;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Target package not found or inactive');
  end if;

  -- Get current package
  select * into v_old_pkg
  from public.packages
  where id = v_sub.package_id;

  -- Update subscription
  update public.organization_subscriptions set
    package_id = p_new_package_id,
    assigned_by = p_assigned_by,
    notes = coalesce(p_reason, notes),
    updated_at = now()
  where id = p_subscription_id;

  -- Record event
  insert into public.subscription_events (
    organization_id, subscription_id, event_type,
    previous_state, new_state, actor_id, reason
  ) values (
    v_sub.organization_id, p_subscription_id, 'plan_changed',
    jsonb_build_object('package_id', v_sub.package_id),
    jsonb_build_object('package_id', p_new_package_id),
    p_assigned_by, p_reason
  );

  return jsonb_build_object(
    'ok', true,
    'subscription_id', p_subscription_id,
    'from_package_id', v_sub.package_id,
    'to_package_id', p_new_package_id
  );
end;
$$;

comment on function public.atomic_upgrade_subscription is 'Atomically upgrades a subscription to a new package within a DB transaction.';

-- ════════════════════════════════════════════════════════════════════════════
-- FIX: RPC for atomic subscription status transition
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.atomic_transition_subscription(
  p_subscription_id uuid,
  p_new_status text,
  p_actor_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_valid boolean;
begin
  -- Lock the subscription row
  select * into v_sub
  from public.organization_subscriptions
  where id = p_subscription_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Subscription not found');
  end if;

  -- Validate transition (mirrors TypeScript state machine)
  select exists (
    select 1 from (values
      ('trial', 'active'), ('trial', 'expired'), ('trial', 'suspended'),
      ('active', 'suspended'), ('active', 'expired'),
      ('suspended', 'active'), ('suspended', 'expired'), ('suspended', 'cancelled'),
      ('expired', 'active'), ('cancelled', 'expired')
    ) as t(from_status, to_status)
    where t.from_status = v_sub.status and t.to_status = p_new_status
  ) into v_valid;

  if not v_valid then
    return jsonb_build_object(
      'ok', false,
      'error', format('Invalid transition: %s -> %s', v_sub.status, p_new_status)
    );
  end if;

  -- Apply transition
  update public.organization_subscriptions set
    status = p_new_status,
    updated_at = now(),
    cancelled_at = case when p_new_status = 'cancelled' then now() else cancelled_at end,
    cancellation_reason = case when p_new_status = 'cancelled' then coalesce(p_reason, cancellation_reason) else cancellation_reason end
  where id = p_subscription_id;

  -- Record event
  insert into public.subscription_events (
    organization_id, subscription_id, event_type,
    previous_state, new_state, actor_id, reason
  ) values (
    v_sub.organization_id, p_subscription_id, 'status_changed',
    jsonb_build_object('status', v_sub.status),
    jsonb_build_object('status', p_new_status),
    p_actor_id, p_reason
  );

  return jsonb_build_object('ok', true, 'subscription_id', p_subscription_id, 'new_status', p_new_status);
end;
$$;

comment on function public.atomic_transition_subscription is 'Atomically transitions a subscription status within a DB transaction.';

-- ════════════════════════════════════════════════════════════════════════════
-- FIX: RPC for checking org feature access (used by API guards)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.check_org_feature_access(
  p_organization_id uuid,
  p_feature text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
begin
  execute format(
    'select exists (
      select 1 from public.organization_subscriptions os
      join public.packages p on p.id = os.package_id
      where os.organization_id = $1
        and os.status in (''active'', ''trial'')
        and (
          os.status = ''active''
          or (
            os.status = ''trial''
            and (os.trial_ends_at is null or os.trial_ends_at > now())
          )
        )
        and p.%I = true
    )', p_feature
  ) into v_enabled using p_organization_id;

  return coalesce(v_enabled, false);
end;
$$;

comment on function public.check_org_feature_access is 'Efficiently checks whether an organization has a specific feature enabled.';

-- ════════════════════════════════════════════════════════════════════════════
-- FIX: Ensure auto_expire trigger fires on insert and update
-- ════════════════════════════════════════════════════════════════════════════

drop trigger if exists enforce_auto_expire_subscription on public.organization_subscriptions;
create trigger enforce_auto_expire_subscription
  before insert or update of expires_at, status on public.organization_subscriptions
  for each row
  execute function public.auto_expire_subscription();
