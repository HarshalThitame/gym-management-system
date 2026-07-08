-- Member payment methods table for saved cards/NACH used by auto_billing
-- Allows members to store tokenized payment methods for recurring charges.

create table if not exists public.member_payment_methods (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  provider text not null check (provider in ('razorpay', 'payu')),
  provider_customer_id text not null,
  provider_payment_method_id text not null,
  payment_type text not null check (payment_type in ('card', 'upi', 'net_banking', 'emandate')),
  display_name text not null,
  last_four text,
  card_network text,
  expiry_month int,
  expiry_year int,
  is_default boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, provider_payment_method_id)
);

create index if not exists idx_member_payment_methods_member
  on public.member_payment_methods (member_id)
  where is_active = true;

create index if not exists idx_member_payment_methods_provider
  on public.member_payment_methods (provider_customer_id);

-- RLS: members can see their own methods; gym staff can see their gym's methods
alter table public.member_payment_methods enable row level security;

create policy "members can view own payment methods"
  on public.member_payment_methods for select
  using (member_id = auth.uid()::text::uuid);

create policy "members can manage own payment methods"
  on public.member_payment_methods for insert
  with check (member_id = auth.uid()::text::uuid);

create policy "members can update own payment methods"
  on public.member_payment_methods for update
  using (member_id = auth.uid()::text::uuid);

create policy "gym staff can view member payment methods"
  on public.member_payment_methods for select
  using (gym_id = public.current_user_gym_id());

-- Member subscriptions table for recurring billing linked to memberships
create table if not exists public.member_subscriptions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  provider text not null check (provider in ('razorpay', 'payu')),
  provider_subscription_id text,
  provider_plan_id text,
  provider_customer_id text,
  provider_payment_method_id text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'cancelled', 'expired', 'failed')),
  billing_period text not null check (billing_period in ('monthly', 'quarterly', 'half_yearly', 'annual')),
  amount integer not null,
  currency text not null default 'INR',
  current_period_start timestamptz,
  current_period_end timestamptz,
  last_charged_at timestamptz,
  next_charge_at timestamptz,
  cancelled_at timestamptz,
  failure_count int not null default 0,
  last_failure_reason text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_member_subscriptions_member
  on public.member_subscriptions (member_id, status);

create index if not exists idx_member_subscriptions_next_charge
  on public.member_subscriptions (next_charge_at)
  where status = 'active';

create index if not exists idx_member_subscriptions_provider
  on public.member_subscriptions (provider_subscription_id)
  where provider_subscription_id is not null;

alter table public.member_subscriptions enable row level security;

create policy "members can view own subscriptions"
  on public.member_subscriptions for select
  using (member_id = auth.uid()::text::uuid);

create policy "gym staff can view member subscriptions"
  on public.member_subscriptions for select
  using (gym_id = public.current_user_gym_id());

create policy "gym staff can manage subscriptions"
  on public.member_subscriptions for insert
  with check (gym_id = public.current_user_gym_id());

create policy "gym staff can update subscriptions"
  on public.member_subscriptions for update
  using (gym_id = public.current_user_gym_id());
