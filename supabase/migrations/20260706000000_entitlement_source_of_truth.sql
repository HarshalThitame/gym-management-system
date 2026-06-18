-- ============================================================================
-- Phase 2: Entitlement source-of-truth foundation.
-- Reuses existing tables (feature_catalog, package_features, package_limits,
-- organization_subscriptions, organization_entitlements) — no duplicate systems.
--
-- Decisions:
--   * feature_catalog IS the feature registry (122 rows already seeded).
--     Its `code` column is the canonical feature key and matches
--     package_features.feature_code exactly (0 orphans verified).
--   * package_features is the canonical package→feature mapping (unchanged).
--   * package_limits is the canonical package→limit mapping (unchanged).
--   * organization_subscriptions keeps its hard unique on organization_id
--     (one subscription row per org). Scheduled plans use the existing
--     scheduled_plan_changes table, not a second subscription row.
--   * Hybrid entitlement architecture: package_features is the live source of
--     truth read by the resolver; organization_entitlements is an audit/
--     snapshot copy already synced after payment (kept, not newly created).
--
-- All statements are idempotent and additive. Safe to re-run.
-- ============================================================================

-- ─── 2B: feature_catalog registry hardening ───────────────────────────────
-- Add is_system flag to distinguish platform-defined features from
-- org-customizable ones. Defaults false for all existing rows.
alter table public.feature_catalog
  add column if not exists is_system boolean not null default false;

-- Ensure the `code` column (canonical feature key) stays unique. A unique
-- constraint already exists (feature_catalog_code_key); this is a no-op safety.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'feature_catalog_code_key'
      and conrelid = 'public.feature_catalog'::regclass
  ) then
    alter table public.feature_catalog
      add constraint feature_catalog_code_key unique (code);
  end if;
end $$;

-- Backfill is_system = true for the core platform features that every package
-- should always expose (not removable from the registry).
update public.feature_catalog
  set is_system = true
  where code in (
    'member_management','manual_attendance','qr_attendance','expiry_tracking',
    'membership_renewals','trainer_management','workout_assignment',
    'class_booking','basic_reports','attendance_reports','billing_invoices',
    'payment_tracking','email_notifications','in_app_notifications',
    'member_portal','trainer_portal','staff_management'
  )
  and is_system = false;

-- ─── 2C: Referential integrity package_features → feature_catalog ─────────
-- Every feature_code written by the Super Admin package editor must reference
-- a real registry row. 0 orphans verified in production before adding this FK.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'package_features_feature_code_fkey'
      and conrelid = 'public.package_features'::regclass
  ) then
    alter table public.package_features
      add constraint package_features_feature_code_fkey
      foreign key (feature_code) references public.feature_catalog(code)
      on delete restrict;
  end if;
end $$;

-- ─── 2D: package_limits referential integrity (self-documenting) ──────────
-- package_limits has no separate limit_catalog table; limit_code is a free
-- text key constrained by application code. We add a CHECK that it is a
-- non-empty snake_case-ish string (defensive, does not restrict existing
-- values which are all already valid).
alter table public.package_limits
  drop constraint if exists package_limits_limit_code_nonempty;
alter table public.package_limits
  add constraint package_limits_limit_code_nonempty
  check (length(btrim(limit_code)) > 0 and limit_code ~ '^[a-z][a-z0-9_]*$');

-- ─── 2E: organization_subscriptions — add forward-looking columns ─────────
alter table public.organization_subscriptions
  add column if not exists replaced_at timestamptz null;
alter table public.organization_subscriptions
  add column if not exists scheduled_start_date timestamptz null;

comment on column public.organization_subscriptions.replaced_at
  is 'When this subscription was immediately replaced by a new purchase. Null for subscriptions that expired/cancelled naturally.';
comment on column public.organization_subscriptions.scheduled_start_date
  is 'For future-dated/scheduled activations. The active scheduled-plan workflow uses the scheduled_plan_changes table; this column is reserved for inline scheduled statuses.';

-- Index for scheduled-start lookups (cron activation).
create index if not exists organization_subscriptions_scheduled_start_idx
  on public.organization_subscriptions (scheduled_start_date)
  where scheduled_start_date is not null;

-- ─── 2F: Subscription status constraint + transition trigger ──────────────
-- Extend the allowed status set with the new lifecycle statuses while keeping
-- the existing 5 (active, trial, expired, suspended, cancelled) intact.
alter table public.organization_subscriptions
  drop constraint if exists organization_subscriptions_status_check;

alter table public.organization_subscriptions
  add constraint organization_subscriptions_status_check
  check (status in (
    'active','trial','expired','suspended','cancelled',
    'pending_activation','payment_pending','payment_failed',
    'replaced','scheduled'
  ));

-- Replace the transition trigger to cover the new statuses. The original 5
-- keep their strict matrix; new statuses are allowed to transition to/from
-- their natural lifecycle targets. This is intentionally permissive for the
-- new statuses so the Razorpay flow (which uses pending_activation) is not
-- blocked — Phase 3 may tighten specific transitions.
create or replace function public.validate_subscription_status_transition()
returns trigger
language plpgsql
as $$
declare
  valid boolean;
begin
  if tg_op = 'INSERT' then
    if new.status not in (
      'active','trial','expired','suspended','cancelled',
      'pending_activation','payment_pending','payment_failed',
      'replaced','scheduled'
    ) then
      raise exception 'Invalid subscription status: %', new.status;
    end if;
    return new;
  end if;

  if new.status = old.status then
    return new;
  end if;

  -- Enforce the strict matrix for the original 5 lifecycle statuses.
  select exists (
    select 1
    from (values
      ('trial','active'),('trial','expired'),('trial','suspended'),('trial','cancelled'),
      ('active','suspended'),('active','expired'),('active','cancelled'),('active','replaced'),('active','pending_activation'),
      ('suspended','active'),('suspended','expired'),('suspended','cancelled'),
      ('expired','active'),('expired','cancelled'),('expired','replaced'),
      ('cancelled','expired'),('cancelled','active')
    ) as transitions(from_status, to_status)
    where transitions.from_status = old.status
      and transitions.to_status = new.status
  ) into valid;

  -- New statuses: allow their natural lifecycle transitions.
  if not valid then
    select exists (
      select 1
      from (values
        ('pending_activation','active'),('pending_activation','payment_failed'),('pending_activation','cancelled'),
        ('payment_pending','active'),('payment_pending','pending_activation'),('payment_pending','payment_failed'),('payment_pending','cancelled'),
        ('payment_failed','pending_activation'),('payment_failed','cancelled'),
        ('scheduled','active'),('scheduled','cancelled'),
        ('active','scheduled'),('active','payment_pending')
      ) as transitions(from_status, to_status)
      where transitions.from_status = old.status
        and transitions.to_status = new.status
    ) into valid;
  end if;

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

-- ─── 2F note: duplicate-active prevention ─────────────────────────────────
-- The existing unique constraint organization_subscriptions_organization_id_key
-- (unique on organization_id) already enforces ONE subscription row per org,
-- which is stronger than "one active per org". This is intentional and is
-- relied upon by finalize_razorpay_subscription_payment (on conflict clause).
-- We do NOT weaken it to a partial unique. Scheduled plans are managed via
-- the separate scheduled_plan_changes table, not a second subscription row.

-- ─── 2G: organization_entitlements (snapshot/audit) is reused as-is ───────
-- It already exists and is populated by syncOrganizationEntitlements after
-- payment. The live resolver reads package_features (dynamic source of truth);
-- organization_entitlements remains an audit/snapshot copy. No new table.

-- ─── Record this migration ────────────────────────────────────────────────
-- (Supabase CLI records via schema_migrations; this is a safety no-op here.)
