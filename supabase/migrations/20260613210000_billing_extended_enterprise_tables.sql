-- Billing Extended Enterprise Tables
-- Adds credit_notes, write_offs, disputes, reconciliation, revenue_recognition,
-- financial_periods, org_payment_methods — all at the gym level.

-- ============================================================
-- 1. CREDIT NOTES
-- ============================================================
create table if not exists public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  credit_note_number text not null,
  reason text not null check (char_length(reason) between 3 and 500),
  amount int not null check (amount > 0),
  remaining_amount int not null check (remaining_amount >= 0),
  currency text not null default 'INR',
  status text not null default 'draft' check (status in ('draft','issued','applied','fully_applied','cancelled')),
  issued_by uuid references auth.users(id) on delete set null,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, credit_note_number)
);

create index if not exists credit_notes_gym_status_idx on public.credit_notes (gym_id, status, created_at desc);
create index if not exists credit_notes_invoice_idx on public.credit_notes (invoice_id);

comment on table public.credit_notes is 'Credit notes issued against invoices.';
comment on column public.credit_notes.remaining_amount is 'Unapplied balance that can still be used.';

-- ============================================================
-- 2. WRITE-OFFS (bad debt)
-- ============================================================
create table if not exists public.write_offs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  amount int not null check (amount > 0),
  currency text not null default 'INR',
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'pending_approval' check (status in ('pending_approval','approved','applied','rejected')),
  approved_by uuid references auth.users(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists write_offs_gym_status_idx on public.write_offs (gym_id, status, created_at desc);
create index if not exists write_offs_invoice_idx on public.write_offs (invoice_id);

comment on table public.write_offs is 'Bad-debt write-offs for uncollectible invoices or payments.';

-- ============================================================
-- 3. DISPUTES
-- ============================================================
create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  member_id uuid not null references public.members(id) on delete cascade,
  reason text not null check (reason in ('duplicate_charge','product_not_received','service_not_as_described','subscription_cancelled','amount_incorrect','fraudulent','other')),
  description text not null check (char_length(description) between 3 and 1000),
  amount int not null check (amount > 0),
  currency text not null default 'INR',
  status text not null default 'opened' check (status in ('opened','under_review','won','lost','closed')),
  evidence_notes text,
  response_notes text,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists disputes_gym_status_idx on public.disputes (gym_id, status, created_at desc);
create index if not exists disputes_payment_idx on public.disputes (payment_id);

comment on table public.disputes is 'Payment disputes and chargebacks.';

-- ============================================================
-- 4. RECONCILIATION (gateway vs system)
-- ============================================================
create table if not exists public.reconciliation (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  date date not null,
  provider text not null check (provider in ('razorpay','manual')),
  gateway_amount int not null default 0,
  system_amount int not null default 0,
  difference int generated always as (gateway_amount - system_amount) stored,
  status text not null default 'unmatched' check (status in ('unmatched','matched','flagged','resolved')),
  notes text,
  reconciled_by uuid references auth.users(id) on delete set null,
  reconciled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reconciliation_gym_date_idx on public.reconciliation (gym_id, date desc);
create unique index if not exists reconciliation_gym_date_provider_idx on public.reconciliation (gym_id, date, provider);

comment on table public.reconciliation is 'Daily reconciliation between payment gateway and system records.';
comment on column public.reconciliation.difference is 'Computed as gateway_amount - system_amount. Zero = fully matched.';

-- ============================================================
-- 5. REVENUE RECOGNITION
-- ============================================================
create table if not exists public.revenue_recognition (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  recognized_amount int not null default 0 check (recognized_amount >= 0),
  deferred_amount int not null default 0 check (deferred_amount >= 0),
  recognized_date date not null default current_date,
  period_start date not null,
  period_end date not null,
  status text not null default 'pending' check (status in ('pending','recognized','deferred')),
  created_at timestamptz not null default now(),
  check (recognized_amount + deferred_amount > 0),
  check (period_end >= period_start)
);

create index if not exists revenue_recognition_gym_status_idx on public.revenue_recognition (gym_id, status, recognized_date desc);
create index if not exists revenue_recognition_invoice_idx on public.revenue_recognition (invoice_id);
create index if not exists revenue_recognition_period_idx on public.revenue_recognition (gym_id, period_start, period_end);

comment on table public.revenue_recognition is 'Revenue recognition schedule for deferred/subscription revenue.';

-- ============================================================
-- 6. FINANCIAL PERIODS (month-end close)
-- ============================================================
create table if not exists public.financial_periods (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open','closing','closed','reopened')),
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  lock_version int not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (gym_id, period_start, period_end)
);

create index if not exists financial_periods_gym_status_idx on public.financial_periods (gym_id, status, period_start desc);

comment on table public.financial_periods is 'Accounting periods with month-end close lock to prevent post-close edits.';

-- ============================================================
-- 7. ORG PAYMENT METHODS (recurring billing)
-- ============================================================
create table if not exists public.org_payment_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('razorpay','stripe','manual')),
  provider_customer_id text,
  payment_type text not null check (payment_type in ('card','upi','net_banking','emandate')),
  display_name text not null,
  last_four text,
  expiry_month int check (expiry_month between 1 and 12),
  expiry_year int,
  card_network text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_payment_methods_org_idx on public.org_payment_methods (organization_id, is_active);

comment on table public.org_payment_methods is 'Saved payment methods for recurring subscription billing per organization.';

-- ============================================================
-- 8. CREDIT NOTE NUMBER GENERATOR
-- ============================================================
create or replace function public.generate_credit_note_number(target_gym_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  select coalesce(count(*), 0) + 1 into next_number
  from public.credit_notes
  where gym_id is not distinct from target_gym_id
    and created_at >= date_trunc('year', now());

  return 'CN-' || to_char(now(), 'YYYY') || '-' || lpad(next_number::text, 6, '0');
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.credit_notes enable row level security;
alter table public.write_offs enable row level security;
alter table public.disputes enable row level security;
alter table public.reconciliation enable row level security;
alter table public.revenue_recognition enable row level security;
alter table public.financial_periods enable row level security;
alter table public.org_payment_methods enable row level security;

-- Grant base access
grant select, insert, update on public.credit_notes to authenticated;
grant select, insert, update on public.write_offs to authenticated;
grant select, insert, update on public.disputes to authenticated;
grant select, insert, update on public.reconciliation to authenticated;
grant select, insert, update on public.revenue_recognition to authenticated;
grant select, insert, update on public.financial_periods to authenticated;
grant select, insert, update on public.org_payment_methods to authenticated;

-- ============================================================
-- RLS POLICIES — CREDIT NOTES
-- ============================================================
drop policy if exists "credit notes visible to gym staff" on public.credit_notes;
create policy "credit notes visible to gym staff"
  on public.credit_notes for select to authenticated
  using (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  );

drop policy if exists "credit notes manageable by gym staff" on public.credit_notes;
create policy "credit notes manageable by gym staff"
  on public.credit_notes for insert to authenticated
  with check (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
  );

drop policy if exists "credit notes updatable by gym staff" on public.credit_notes;
create policy "credit notes updatable by gym staff"
  on public.credit_notes for update to authenticated
  using (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
  )
  with check (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
  );

-- ============================================================
-- RLS POLICIES — WRITE-OFFS
-- ============================================================
drop policy if exists "write offs visible to gym staff" on public.write_offs;
create policy "write offs visible to gym staff"
  on public.write_offs for select to authenticated
  using (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  );

drop policy if exists "write offs manageable by gym admins" on public.write_offs;
create policy "write offs manageable by gym admins"
  on public.write_offs for insert to authenticated
  with check (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
  );

drop policy if exists "write offs updatable by gym admins" on public.write_offs;
create policy "write offs updatable by gym admins"
  on public.write_offs for update to authenticated
  using (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
  )
  with check (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
  );

-- ============================================================
-- RLS POLICIES — DISPUTES
-- ============================================================
drop policy if exists "disputes visible to gym staff" on public.disputes;
create policy "disputes visible to gym staff"
  on public.disputes for select to authenticated
  using (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  );

drop policy if exists "disputes manageable by gym admins" on public.disputes;
create policy "disputes manageable by gym admins"
  on public.disputes for insert to authenticated
  with check (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
  );

drop policy if exists "disputes updatable by gym admins" on public.disputes;
create policy "disputes updatable by gym admins"
  on public.disputes for update to authenticated
  using (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
  )
  with check (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
  );

-- ============================================================
-- RLS POLICIES — RECONCILIATION
-- ============================================================
drop policy if exists "reconciliation visible to gym admins" on public.reconciliation;
create policy "reconciliation visible to gym admins"
  on public.reconciliation for select to authenticated
  using (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
  );

drop policy if exists "reconciliation manageable by gym admins" on public.reconciliation;
create policy "reconciliation manageable by gym admins"
  on public.reconciliation for insert to authenticated
  with check (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
  );

drop policy if exists "reconciliation updatable by gym admins" on public.reconciliation;
create policy "reconciliation updatable by gym admins"
  on public.reconciliation for update to authenticated
  using (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
  )
  with check (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
  );

-- ============================================================
-- RLS POLICIES — REVENUE RECOGNITION
-- ============================================================
drop policy if exists "revenue rec visible to gym admins" on public.revenue_recognition;
create policy "revenue rec visible to gym admins"
  on public.revenue_recognition for select to authenticated
  using (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
  );

drop policy if exists "revenue rec manageable by super admins" on public.revenue_recognition;
create policy "revenue rec manageable by super admins"
  on public.revenue_recognition for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "revenue rec updatable by super admins" on public.revenue_recognition;
create policy "revenue rec updatable by super admins"
  on public.revenue_recognition for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- RLS POLICIES — FINANCIAL PERIODS
-- ============================================================
drop policy if exists "financial periods visible to gym admins" on public.financial_periods;
create policy "financial periods visible to gym admins"
  on public.financial_periods for select to authenticated
  using (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
  );

drop policy if exists "financial periods manageable by gym admins" on public.financial_periods;
create policy "financial periods manageable by gym admins"
  on public.financial_periods for insert to authenticated
  with check (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
  );

drop policy if exists "financial periods updatable by gym admins" on public.financial_periods;
create policy "financial periods updatable by gym admins"
  on public.financial_periods for update to authenticated
  using (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
  )
  with check (
    public.is_super_admin()
    or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
  );

-- ============================================================
-- RLS POLICIES — ORG PAYMENT METHODS
-- ============================================================
drop policy if exists "org payment methods visible to org owners" on public.org_payment_methods;
create policy "org payment methods visible to org owners"
  on public.org_payment_methods for select to authenticated
  using (
    public.is_super_admin()
    or public.is_organization_owner(organization_id)
  );

drop policy if exists "org payment methods manageable by org owners" on public.org_payment_methods;
create policy "org payment methods manageable by org owners"
  on public.org_payment_methods for insert to authenticated
  with check (
    public.is_super_admin()
    or public.is_organization_owner(organization_id)
  );

drop policy if exists "org payment methods updatable by org owners" on public.org_payment_methods;
create policy "org payment methods updatable by org owners"
  on public.org_payment_methods for update to authenticated
  using (
    public.is_super_admin()
    or (organization_id = public.current_user_organization_id() and public.is_organization_owner(organization_id))
  )
  with check (
    public.is_super_admin()
    or (organization_id = public.current_user_organization_id() and public.is_organization_owner(organization_id))
  );

-- ============================================================
-- TRIGGERS
-- ============================================================
drop trigger if exists set_credit_notes_updated_at on public.credit_notes;
create trigger set_credit_notes_updated_at
  before update on public.credit_notes
  for each row execute function public.set_updated_at();

drop trigger if exists set_write_offs_updated_at on public.write_offs;
create trigger set_write_offs_updated_at
  before update on public.write_offs
  for each row execute function public.set_updated_at();

drop trigger if exists set_disputes_updated_at on public.disputes;
create trigger set_disputes_updated_at
  before update on public.disputes
  for each row execute function public.set_updated_at();

drop trigger if exists set_financial_periods_updated_at on public.financial_periods;
create trigger set_financial_periods_updated_at
  before update on public.financial_periods
  for each row execute function public.set_updated_at();

drop trigger if exists set_org_payment_methods_updated_at on public.org_payment_methods;
create trigger set_org_payment_methods_updated_at
  before update on public.org_payment_methods
  for each row execute function public.set_updated_at();

-- ============================================================
-- 9. ORG SUBSCRIPTION INVOICES (SaaS billing)
-- ============================================================
create table if not exists public.org_subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid not null references public.organization_subscriptions(id) on delete cascade,
  invoice_number text not null,
  status text not null default 'draft' check (status in ('draft','issued','paid','partially_paid','cancelled','refunded')),
  currency text not null default 'INR',
  subtotal_amount int not null default 0 check (subtotal_amount >= 0),
  discount_amount int not null default 0 check (discount_amount >= 0),
  tax_amount int not null default 0 check (tax_amount >= 0),
  total_amount int generated always as (greatest(subtotal_amount - discount_amount + tax_amount, 0)) stored,
  amount_paid int not null default 0 check (amount_paid >= 0),
  amount_due int generated always as (greatest(subtotal_amount - discount_amount + tax_amount - amount_paid, 0)) stored,
  billing_period_start date,
  billing_period_end date,
  razorpay_order_id text,
  razorpay_payment_id text,
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, invoice_number)
);

create index if not exists org_sub_invoices_org_status_idx on public.org_subscription_invoices (organization_id, status, created_at desc);
create index if not exists org_sub_invoices_sub_id_idx on public.org_subscription_invoices (subscription_id);

comment on table public.org_subscription_invoices is 'Invoices generated for SaaS subscription billing per organization.';

-- ============================================================
-- 10. ORG SUBSCRIPTION PAYMENTS
-- ============================================================
create table if not exists public.org_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid not null references public.organization_subscriptions(id) on delete cascade,
  invoice_id uuid references public.org_subscription_invoices(id) on delete set null,
  payment_number text not null,
  status text not null default 'pending' check (status in ('pending','processing','paid','failed','refunded','partially_refunded','cancelled')),
  provider text not null default 'razorpay' check (provider in ('razorpay','stripe','manual')),
  amount int not null check (amount > 0),
  currency text not null default 'INR',
  provider_order_id text,
  provider_payment_id text,
  provider_customer_id text,
  payment_method_id uuid references public.org_payment_methods(id) on delete set null,
  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, payment_number)
);

create index if not exists org_sub_payments_org_status_idx on public.org_subscription_payments (organization_id, status, created_at desc);
create index if not exists org_sub_payments_invoice_idx on public.org_subscription_payments (invoice_id);
create index if not exists org_sub_payments_order_id_idx on public.org_subscription_payments (provider_order_id) where provider_order_id is not null;

comment on table public.org_subscription_payments is 'Payments received for SaaS subscription invoices.';

-- ============================================================
-- 11. INVOICE NUMBER GENERATOR FOR ORG SUBSCRIPTIONS
-- ============================================================
create or replace function public.generate_org_subscription_invoice_number(target_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  select coalesce(count(*), 0) + 1 into next_number
  from public.org_subscription_invoices
  where organization_id is not distinct from target_org_id
    and created_at >= date_trunc('year', now());

  return 'SUB-INV-' || to_char(now(), 'YYYY') || '-' || lpad(next_number::text, 6, '0');
end;
$$;

create or replace function public.generate_org_subscription_payment_number(target_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  select coalesce(count(*), 0) + 1 into next_number
  from public.org_subscription_payments
  where organization_id is not distinct from target_org_id
    and created_at >= date_trunc('year', now());

  return 'SUB-PAY-' || to_char(now(), 'YYYY') || '-' || lpad(next_number::text, 6, '0');
end;
$$;

-- ============================================================
-- RLS POLICIES — ORG SUBSCRIPTION INVOICES
-- ============================================================
alter table public.org_subscription_invoices enable row level security;
alter table public.org_subscription_payments enable row level security;

grant select, insert, update on public.org_subscription_invoices to authenticated;
grant select, insert, update on public.org_subscription_payments to authenticated;

drop policy if exists "org sub invoices visible to super admins" on public.org_subscription_invoices;
create policy "org sub invoices visible to super admins"
  on public.org_subscription_invoices for select to authenticated
  using (public.is_super_admin());

drop policy if exists "org sub invoices visible to org owners" on public.org_subscription_invoices;
create policy "org sub invoices visible to org owners"
  on public.org_subscription_invoices for select to authenticated
  using (public.is_organization_owner(organization_id));

drop policy if exists "org sub invoices manageable by super admins" on public.org_subscription_invoices;
create policy "org sub invoices manageable by super admins"
  on public.org_subscription_invoices for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "org sub invoices updatable by super admins" on public.org_subscription_invoices;
create policy "org sub invoices updatable by super admins"
  on public.org_subscription_invoices for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- RLS POLICIES — ORG SUBSCRIPTION PAYMENTS
-- ============================================================
drop policy if exists "org sub payments visible to super admins" on public.org_subscription_payments;
create policy "org sub payments visible to super admins"
  on public.org_subscription_payments for select to authenticated
  using (public.is_super_admin());

drop policy if exists "org sub payments visible to org owners" on public.org_subscription_payments;
create policy "org sub payments visible to org owners"
  on public.org_subscription_payments for select to authenticated
  using (public.is_organization_owner(organization_id));

drop policy if exists "org sub payments insertable by super admins" on public.org_subscription_payments;
create policy "org sub payments insertable by super admins"
  on public.org_subscription_payments for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "org sub payments updatable by super admins" on public.org_subscription_payments;
create policy "org sub payments updatable by super admins"
  on public.org_subscription_payments for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Add cancellation_category to organization_subscriptions for structured cancellation reasons
alter table public.organization_subscriptions add column if not exists cancellation_category text;

comment on column public.organization_subscriptions.cancellation_category
  is 'Structured category: too_expensive, missing_features, poor_support, not_using, switching_competitor, business_closed, technical_issues, other';

drop trigger if exists set_org_subscription_invoices_updated_at on public.org_subscription_invoices;
create trigger set_org_subscription_invoices_updated_at
  before update on public.org_subscription_invoices
  for each row execute function public.set_updated_at();

drop trigger if exists set_org_subscription_payments_updated_at on public.org_subscription_payments;
create trigger set_org_subscription_payments_updated_at
  before update on public.org_subscription_payments
  for each row execute function public.set_updated_at();
