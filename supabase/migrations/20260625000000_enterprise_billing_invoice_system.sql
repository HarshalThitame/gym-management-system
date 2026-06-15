-- Enterprise Billing & Invoice System — extends existing tables

-- ════════════════════════════════════════════════════════════════════════
-- 1. Extend invoices table with GST and billing fields
-- ════════════════════════════════════════════════════════════════════════

alter table public.invoices add column if not exists invoice_number text unique;
alter table public.invoices add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.invoices add column if not exists subscription_id uuid references public.organization_subscriptions(id) on delete set null;
alter table public.invoices add column if not exists invoice_type text check (invoice_type in ('subscription', 'renewal', 'upgrade', 'downgrade', 'addon', 'credit', 'manual', 'refund'));
alter table public.invoices add column if not exists subtotal int not null default 0;
alter table public.invoices add column if not exists tax_amount int not null default 0;
alter table public.invoices add column if not exists total_amount int not null default 0;
alter table public.invoices add column if not exists amount_paid int not null default 0;
alter table public.invoices add column if not exists amount_due int not null default 0;
alter table public.invoices add column if not exists currency text not null default 'INR';
alter table public.invoices add column if not exists status text not null default 'draft' check (status in ('draft', 'pending', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded', 'credit_applied'));
alter table public.invoices add column if not exists billing_period_start date;
alter table public.invoices add column if not exists billing_period_end date;
alter table public.invoices add column if not exists due_date date;
alter table public.invoices add column if not exists paid_at timestamptz;
alter table public.invoices add column if not exists notes text;

-- GST fields
alter table public.invoices add column if not exists gst_invoice boolean not null default false;
alter table public.invoices add column if not exists gst_breakdown jsonb default '{}'::jsonb;
alter table public.invoices add column if not exists place_of_supply text;
alter table public.invoices add column if not exists reverse_charge boolean not null default false;

-- Billing address
alter table public.invoices add column if not exists billing_name text;
alter table public.invoices add column if not exists billing_address text;
alter table public.invoices add column if not exists billing_city text;
alter table public.invoices add column if not exists billing_state text;
alter table public.invoices add column if not exists billing_zip text;
alter table public.invoices add column if not exists billing_gstin text;

create index if not exists invoices_org_idx on public.invoices (organization_id);
create index if not exists invoices_status_idx on public.invoices (status);
create index if not exists invoices_number_idx on public.invoices (invoice_number);
create index if not exists invoices_created_idx on public.invoices (created_at desc);

-- ════════════════════════════════════════════════════════════════════════
-- 2. Extend invoice_items
-- ════════════════════════════════════════════════════════════════════════

alter table public.invoice_items add column if not exists invoice_id uuid references public.invoices(id) on delete cascade;
alter table public.invoice_items add column if not exists description text;
alter table public.invoice_items add column if not exists quantity int not null default 1;
alter table public.invoice_items add column if not exists unit_price int not null default 0;
alter table public.invoice_items add column if not exists amount int not null default 0;
alter table public.invoice_items add column if not exists tax_rate numeric(5,2) default 0;
alter table public.invoice_items add column if not exists tax_amount int not null default 0;
alter table public.invoice_items add column if not exists item_type text check (item_type in ('subscription', 'addon', 'credit', 'refund', 'adjustment', 'setup_fee', 'other'));

create index if not exists invoice_items_inv_idx on public.invoice_items (invoice_id);

-- ════════════════════════════════════════════════════════════════════════
-- 3. Extend payments
-- ════════════════════════════════════════════════════════════════════════

alter table public.payments add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.payments add column if not exists invoice_id uuid references public.invoices(id) on delete set null;
alter table public.payments add column if not exists amount int not null default 0;
alter table public.payments add column if not exists currency text not null default 'INR';
alter table public.payments add column if not exists payment_method text;
alter table public.payments add column if not exists transaction_id text;
alter table public.payments add column if not exists gateway text;
alter table public.payments add column if not exists gateway_order_id text;
alter table public.payments add column if not exists gateway_payment_id text;
alter table public.payments add column if not exists status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded'));
alter table public.payments add column if not exists paid_at timestamptz;

create index if not exists payments_org_idx on public.payments (organization_id);
create index if not exists payments_inv_idx on public.payments (invoice_id);
create index if not exists payments_status_idx on public.payments (status);

-- ════════════════════════════════════════════════════════════════════════
-- 4. Extend billing_events with org context
-- ════════════════════════════════════════════════════════════════════════

alter table public.billing_events add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.billing_events add column if not exists invoice_id uuid references public.invoices(id) on delete set null;
alter table public.billing_events add column if not exists payment_id uuid references public.payments(id) on delete set null;
alter table public.billing_events add column if not exists amount int default 0;

create index if not exists billing_events_org_idx on public.billing_events (organization_id);

-- ════════════════════════════════════════════════════════════════════════
-- 5. Invoice number generation sequence
-- ════════════════════════════════════════════════════════════════════════

create sequence if not exists public.invoice_number_seq start 1 increment 1;

create or replace function public.generate_invoice_number()
returns text
language sql
as $$
  select 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 6. Tax rates for GST
-- ════════════════════════════════════════════════════════════════════════

-- Tax rates already seeded from prior migrations
-- Uncomment to add new rates:
-- insert into public.tax_rates (name, rate_percent, tax_type, is_active) values
--   ('GST 5%', 5.00, 'gst', true),
--   ('GST 12%', 12.00, 'gst', true),
--   ('GST 18%', 18.00, 'gst', true),
--   ('GST 28%', 28.00, 'gst', true)
-- on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- 7. RLS policies for new billing tables
-- ════════════════════════════════════════════════════════════════════════

alter table public.invoices enable row level security;
drop policy if exists "invoices super admin" on public.invoices;
create policy "invoices super admin"
  on public.invoices for select to authenticated
  using (public.is_super_admin());
drop policy if exists "invoices org owner" on public.invoices;
create policy "invoices org owner"
  on public.invoices for select to authenticated
  using (public.is_organization_owner(organization_id));
drop policy if exists "invoices super admin insert" on public.invoices;
create policy "invoices super admin insert"
  on public.invoices for insert to authenticated
  with check (public.is_super_admin());
drop policy if exists "invoices super admin update" on public.invoices;
create policy "invoices super admin update"
  on public.invoices for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

alter table public.payments enable row level security;
drop policy if exists "payments super admin" on public.payments;
create policy "payments super admin"
  on public.payments for select to authenticated
  using (public.is_super_admin());
drop policy if exists "payments org owner" on public.payments;
create policy "payments org owner"
  on public.payments for select to authenticated
  using (public.is_organization_owner(organization_id));
drop policy if exists "payments super admin insert" on public.payments;
create policy "payments super admin insert"
  on public.payments for insert to authenticated
  with check (public.is_super_admin());
