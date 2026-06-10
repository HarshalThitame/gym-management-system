create extension if not exists pgcrypto;

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('cash', 'upi', 'credit_card', 'debit_card', 'net_banking', 'razorpay')),
  name text not null,
  provider text not null default 'manual' check (provider in ('manual', 'razorpay')),
  is_active boolean not null default true,
  display_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.discounts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  description text null check (description is null or char_length(description) <= 500),
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  value_amount integer not null check (value_amount >= 0),
  max_discount_amount integer null check (max_discount_amount is null or max_discount_amount >= 0),
  starts_at timestamptz null,
  ends_at timestamptz null,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  code text not null,
  name text not null check (char_length(name) between 2 and 120),
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  value_amount integer not null check (value_amount >= 0),
  minimum_amount integer not null default 0 check (minimum_amount >= 0),
  max_discount_amount integer null check (max_discount_amount is null or max_discount_amount >= 0),
  usage_limit integer null check (usage_limit is null or usage_limit > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz null,
  status text not null default 'active' check (status in ('active', 'inactive', 'expired', 'archived')),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, code)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  membership_id uuid null references public.memberships(id) on delete set null,
  invoice_number text not null,
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'partially_paid', 'cancelled', 'refunded')),
  currency text not null default 'INR',
  subtotal_amount integer not null default 0 check (subtotal_amount >= 0),
  discount_amount integer not null default 0 check (discount_amount >= 0),
  tax_amount integer not null default 0 check (tax_amount >= 0),
  total_amount integer generated always as (greatest(subtotal_amount - discount_amount + tax_amount, 0)) stored,
  amount_paid integer not null default 0 check (amount_paid >= 0),
  amount_due integer generated always as (greatest(subtotal_amount - discount_amount + tax_amount - amount_paid, 0)) stored,
  issued_at timestamptz null,
  due_at timestamptz null,
  paid_at timestamptz null,
  pdf_path text null,
  notes text null check (notes is null or char_length(notes) <= 1000),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, invoice_number)
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  item_type text not null check (item_type in ('membership', 'registration_fee', 'personal_training', 'class_fee', 'discount', 'tax', 'other')),
  description text not null check (char_length(description) between 2 and 240),
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_amount integer not null check (unit_amount >= 0),
  discount_amount integer not null default 0 check (discount_amount >= 0),
  tax_amount integer not null default 0 check (tax_amount >= 0),
  total_amount integer generated always as (greatest((quantity * unit_amount)::integer - discount_amount + tax_amount, 0)) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  membership_id uuid null references public.memberships(id) on delete set null,
  invoice_id uuid null references public.invoices(id) on delete set null,
  payment_number text not null,
  payment_type text not null check (payment_type in ('membership_purchase', 'membership_renewal', 'registration_fee', 'personal_training', 'class_fee', 'other')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'failed', 'refunded', 'partially_refunded', 'cancelled')),
  method text not null check (method in ('cash', 'upi', 'credit_card', 'debit_card', 'net_banking', 'razorpay')),
  provider text not null default 'manual' check (provider in ('manual', 'razorpay')),
  amount integer not null check (amount > 0),
  currency text not null default 'INR',
  discount_amount integer not null default 0 check (discount_amount >= 0),
  tax_amount integer not null default 0 check (tax_amount >= 0),
  provider_order_id text null,
  provider_payment_id text null,
  provider_signature text null,
  receipt_number text null,
  collected_at timestamptz null,
  paid_at timestamptz null,
  failed_at timestamptz null,
  failure_reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, payment_number)
);

create unique index if not exists payments_provider_order_id_idx on public.payments (provider_order_id) where provider_order_id is not null;
create unique index if not exists payments_provider_payment_id_idx on public.payments (provider_payment_id) where provider_payment_id is not null;

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  invoice_id uuid null references public.invoices(id) on delete set null,
  provider text not null check (provider in ('manual', 'razorpay')),
  provider_order_id text null,
  provider_payment_id text null,
  status text not null default 'created' check (status in ('created', 'attempted', 'authorized', 'captured', 'failed', 'verified')),
  amount integer not null check (amount > 0),
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_code text null,
  error_description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid null references public.members(id) on delete set null,
  invoice_id uuid null references public.invoices(id) on delete set null,
  payment_id uuid null references public.payments(id) on delete set null,
  refund_id uuid null,
  transaction_type text not null check (transaction_type in ('invoice_created', 'payment_collected', 'payment_failed', 'refund_requested', 'refund_approved', 'refund_processed', 'discount_applied')),
  direction text not null check (direction in ('debit', 'credit', 'none')),
  amount integer not null default 0 check (amount >= 0),
  currency text not null default 'INR',
  description text not null check (char_length(description) between 3 and 300),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  invoice_id uuid null references public.invoices(id) on delete set null,
  member_id uuid not null references public.members(id) on delete cascade,
  amount integer not null check (amount > 0),
  currency text not null default 'INR',
  status text not null default 'requested' check (status in ('requested', 'approved', 'processing', 'processed', 'failed', 'cancelled')),
  reason text not null check (char_length(reason) between 3 and 500),
  provider_refund_id text null,
  approved_by uuid null references auth.users(id) on delete set null,
  requested_by uuid null references auth.users(id) on delete set null,
  processed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactions
drop constraint if exists transactions_refund_id_fkey;
alter table public.transactions
add constraint transactions_refund_id_fkey foreign key (refund_id) references public.refunds(id) on delete set null;

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  event_type text not null check (event_type in ('membership_created', 'membership_renewed', 'invoice_generated', 'payment_completed', 'payment_failed', 'refund_issued', 'webhook_received')),
  entity_type text not null,
  entity_id uuid null,
  status text not null default 'recorded' check (status in ('queued', 'processed', 'failed', 'recorded')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'razorpay' check (provider in ('razorpay')),
  event_id text not null,
  event_type text not null,
  signature text null,
  payload jsonb not null,
  processed_at timestamptz null,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  error_message text null,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

insert into public.payment_methods (code, name, provider, display_order)
values
  ('cash', 'Cash', 'manual', 10),
  ('upi', 'UPI', 'manual', 20),
  ('credit_card', 'Credit Card', 'razorpay', 30),
  ('debit_card', 'Debit Card', 'razorpay', 40),
  ('net_banking', 'Net Banking', 'razorpay', 50),
  ('razorpay', 'Razorpay Online Payment', 'razorpay', 60)
on conflict (code) do update
set name = excluded.name,
    provider = excluded.provider,
    display_order = excluded.display_order,
    is_active = true;

create index if not exists discounts_gym_status_idx on public.discounts (gym_id, status);
create index if not exists coupons_gym_code_idx on public.coupons (gym_id, upper(code));
create index if not exists coupons_gym_status_idx on public.coupons (gym_id, status, expires_at);
create index if not exists invoices_gym_status_idx on public.invoices (gym_id, status, created_at desc);
create index if not exists invoices_member_created_idx on public.invoices (member_id, created_at desc);
create index if not exists invoices_membership_idx on public.invoices (membership_id);
create index if not exists invoice_items_invoice_idx on public.invoice_items (invoice_id);
create index if not exists payments_gym_status_idx on public.payments (gym_id, status, created_at desc);
create index if not exists payments_member_created_idx on public.payments (member_id, created_at desc);
create index if not exists payments_invoice_idx on public.payments (invoice_id);
create index if not exists payments_method_created_idx on public.payments (gym_id, method, created_at desc);
create index if not exists payment_attempts_payment_idx on public.payment_attempts (payment_id, created_at desc);
create index if not exists transactions_gym_created_idx on public.transactions (gym_id, created_at desc);
create index if not exists transactions_payment_idx on public.transactions (payment_id);
create index if not exists refunds_gym_status_idx on public.refunds (gym_id, status, created_at desc);
create index if not exists refunds_payment_idx on public.refunds (payment_id);
create index if not exists billing_events_gym_created_idx on public.billing_events (gym_id, created_at desc);
create index if not exists payment_provider_events_status_idx on public.payment_provider_events (provider, status, created_at desc);

drop trigger if exists set_discounts_updated_at on public.discounts;
create trigger set_discounts_updated_at before update on public.discounts for each row execute function public.set_updated_at();
drop trigger if exists set_coupons_updated_at on public.coupons;
create trigger set_coupons_updated_at before update on public.coupons for each row execute function public.set_updated_at();
drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at before update on public.invoices for each row execute function public.set_updated_at();
drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
drop trigger if exists set_payment_attempts_updated_at on public.payment_attempts;
create trigger set_payment_attempts_updated_at before update on public.payment_attempts for each row execute function public.set_updated_at();
drop trigger if exists set_refunds_updated_at on public.refunds;
create trigger set_refunds_updated_at before update on public.refunds for each row execute function public.set_updated_at();

create or replace function public.generate_invoice_number(target_gym_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  select coalesce(count(*), 0) + 1 into next_number
  from public.invoices
  where gym_id is not distinct from target_gym_id
    and created_at >= date_trunc('year', now());

  return 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(next_number::text, 6, '0');
end;
$$;

create or replace function public.generate_payment_number(target_gym_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  select coalesce(count(*), 0) + 1 into next_number
  from public.payments
  where gym_id is not distinct from target_gym_id
    and created_at >= date_trunc('year', now());

  return 'PAY-' || to_char(now(), 'YYYY') || '-' || lpad(next_number::text, 6, '0');
end;
$$;

create or replace view public.revenue_daily_summary as
select
  gym_id,
  date_trunc('day', paid_at)::date as revenue_date,
  sum(amount) filter (where status in ('paid', 'partially_refunded')) as gross_revenue,
  sum(coalesce(discount_amount, 0)) as discounts,
  count(*) as payment_count
from public.payments
where paid_at is not null
group by gym_id, date_trunc('day', paid_at)::date;

create or replace view public.payment_method_breakdown as
select
  gym_id,
  method,
  count(*) as payment_count,
  sum(amount) as total_amount
from public.payments
where status in ('paid', 'partially_refunded')
group by gym_id, method;

alter table public.payment_methods enable row level security;
alter table public.discounts enable row level security;
alter table public.coupons enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.transactions enable row level security;
alter table public.refunds enable row level security;
alter table public.billing_events enable row level security;
alter table public.payment_provider_events enable row level security;

grant select on public.payment_methods to authenticated;
grant select, insert, update on public.discounts to authenticated;
grant select, insert, update on public.coupons to authenticated;
grant select, insert, update on public.invoices to authenticated;
grant select, insert on public.invoice_items to authenticated;
grant select, insert, update on public.payments to authenticated;
grant select, insert, update on public.payment_attempts to authenticated;
grant select, insert on public.transactions to authenticated;
grant select, insert, update on public.refunds to authenticated;
grant select, insert on public.billing_events to authenticated;
grant select on public.revenue_daily_summary to authenticated;
grant select on public.payment_method_breakdown to authenticated;

drop policy if exists "authenticated users can read payment methods" on public.payment_methods;
create policy "authenticated users can read payment methods"
on public.payment_methods for select to authenticated using (is_active = true);

drop policy if exists "staff can manage discounts" on public.discounts;
create policy "staff can manage discounts"
on public.discounts for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "staff can manage coupons" on public.coupons;
create policy "staff can manage coupons"
on public.coupons for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "financial records visible to owner or staff invoices" on public.invoices;
create policy "financial records visible to owner or staff invoices"
on public.invoices for select to authenticated
using (
  exists (select 1 from public.members where members.id = invoices.member_id and members.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can write invoices" on public.invoices;
create policy "staff can write invoices"
on public.invoices for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "invoice items visible with invoice" on public.invoice_items;
create policy "invoice items visible with invoice"
on public.invoice_items for select to authenticated
using (
  exists (
    select 1 from public.invoices
    where invoices.id = invoice_items.invoice_id
      and (
        exists (select 1 from public.members where members.id = invoices.member_id and members.user_id = (select auth.uid()))
        or public.is_super_admin()
        or (invoices.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
      )
  )
);

drop policy if exists "staff can insert invoice items" on public.invoice_items;
create policy "staff can insert invoice items"
on public.invoice_items for insert to authenticated
with check (
  exists (
    select 1 from public.invoices
    where invoices.id = invoice_items.invoice_id
      and (public.is_super_admin() or (invoices.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
  )
);

drop policy if exists "payments visible to owner or staff" on public.payments;
create policy "payments visible to owner or staff"
on public.payments for select to authenticated
using (
  exists (select 1 from public.members where members.id = payments.member_id and members.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can write payments" on public.payments;
create policy "staff can write payments"
on public.payments for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "staff can manage payment attempts" on public.payment_attempts;
create policy "staff can manage payment attempts"
on public.payment_attempts for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "transactions visible to owner or staff" on public.transactions;
create policy "transactions visible to owner or staff"
on public.transactions for select to authenticated
using (
  exists (select 1 from public.members where members.id = transactions.member_id and members.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can insert transactions" on public.transactions;
create policy "staff can insert transactions"
on public.transactions for insert to authenticated
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "refunds visible to owner or staff" on public.refunds;
create policy "refunds visible to owner or staff"
on public.refunds for select to authenticated
using (
  exists (select 1 from public.members where members.id = refunds.member_id and members.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can manage refunds" on public.refunds;
create policy "staff can manage refunds"
on public.refunds for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])));

drop policy if exists "staff can read billing events" on public.billing_events;
create policy "staff can read billing events"
on public.billing_events for select to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "staff can insert billing events" on public.billing_events;
create policy "staff can insert billing events"
on public.billing_events for insert to authenticated
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "service role can manage provider events" on public.payment_provider_events;
create policy "service role can manage provider events"
on public.payment_provider_events for all to service_role using (true) with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 5242880, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "staff can read invoice PDFs" on storage.objects;
create policy "staff can read invoice PDFs"
on storage.objects for select to authenticated
using (bucket_id = 'invoices' and (public.is_super_admin() or public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "staff can upload invoice PDFs" on storage.objects;
create policy "staff can upload invoice PDFs"
on storage.objects for insert to authenticated
with check (bucket_id = 'invoices' and (public.is_super_admin() or public.has_any_role(array['gym_admin', 'reception_staff'])));
