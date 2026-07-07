-- Add auto_renew to memberships table
alter table public.memberships
  add column if not exists auto_renew boolean not null default false;

comment on column public.memberships.auto_renew is 'When true, membership will auto-renew at expiry. A new invoice + Razorpay order is generated before end_date.';

-- Add dunning/retry columns to member-level invoices
alter table public.invoices
  add column if not exists dunning_status text default null
    check (dunning_status in ('none', 'payment_failed', 'retry_scheduled', 'overdue', 'grace_period', 'resolved', 'waived')),
  add column if not exists dunning_attempts integer not null default 0,
  add column if not exists dunning_last_attempt_at timestamptz,
  add column if not exists dunning_last_failure_reason text,
  add column if not exists dunning_next_retry_at timestamptz,
  add column if not exists dunning_grace_period_ends_at timestamptz,
  add column if not exists dunning_reminder_count integer not null default 0,
  add column if not exists dunning_last_reminder_sent_at timestamptz;

comment on column public.invoices.dunning_status is 'Tracks payment recovery state for this invoice.';
comment on column public.invoices.dunning_attempts is 'Number of payment retry attempts made.';
comment on column public.invoices.dunning_next_retry_at is 'When the next payment retry should be attempted.';
comment on column public.invoices.dunning_grace_period_ends_at is 'When the grace period ends before suspension.';

-- Add razorpay_order_id to member-level invoices (mirrors org_subscription_invoices)
alter table public.invoices
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text;

comment on column public.invoices.razorpay_order_id is 'Razorpay order ID for auto-generated payment orders.';
comment on column public.invoices.razorpay_payment_id is 'Razorpay payment ID on successful capture.';

-- Allow auto_renew on membership_plans so gyms can set default
alter table public.membership_plans
  add column if not exists auto_renew_default boolean not null default false;

comment on column public.membership_plans.auto_renew_default is 'Default auto_renew value when creating a new membership with this plan.';

-- Track who triggered the auto-renew (system vs manual)
alter table public.memberships
  add column if not exists last_renewed_by_cron_at timestamptz;

comment on column public.memberships.last_renewed_by_cron_at is 'When the auto-renewal cron last attempted renewal. Null if never auto-renewed.';

-- Index for the auto-renewal cron query
create index if not exists idx_memberships_auto_renew_due
  on public.memberships (end_date, status, auto_renew)
  where auto_renew = true and status = 'active';

-- Index for dunning retry queries on member invoices
create index if not exists idx_invoices_dunning_retry
  on public.invoices (dunning_next_retry_at)
  where dunning_next_retry_at is not null;

create index if not exists idx_invoices_dunning_status
  on public.invoices (dunning_status)
  where dunning_status is not null;
