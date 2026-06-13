-- Enterprise Subscription Management — complete data model.
-- Adds billing, add-ons, scheduled changes, events, usage tracking, and dunning.

alter table public.packages add column if not exists price int;
comment on column public.packages.price is 'Price in paise (INR) / cents (other currencies) for this plan. Null means not for direct purchase.';

alter table public.packages add column if not exists billing_period text check (billing_period in ('monthly', 'quarterly', 'half_yearly', 'annual'));
comment on column public.packages.billing_period is 'Standard billing frequency for this package tier.';

alter table public.packages add column if not exists currency text not null default 'INR';

alter table public.packages add column if not exists recommended boolean not null default false;
comment on column public.packages.recommended is 'Highlight this plan as recommended during upgrade comparison.';

alter table public.organization_subscriptions add column if not exists price_override int;
comment on column public.organization_subscriptions.price_override is 'Custom price for this org (in paise) if negotiated outside standard pricing.';

alter table public.organization_subscriptions add column if not exists billing_period text check (billing_period in ('monthly', 'quarterly', 'half_yearly', 'annual'));
comment on column public.organization_subscriptions.billing_period is 'Override billing period if different from package default.';

alter table public.organization_subscriptions add column if not exists billing_anchor timestamptz;
comment on column public.organization_subscriptions.billing_anchor is 'Reference date for billing cycle calculation. Null = started_at.';

alter table public.organization_subscriptions add column if not exists last_billing_date timestamptz;
comment on column public.organization_subscriptions.last_billing_date is 'Most recent successful billing date for this subscription.';

alter table public.organization_subscriptions add column if not exists next_billing_date timestamptz;
comment on column public.organization_subscriptions.next_billing_date is 'Next scheduled billing date. Null = no recurring billing.';

alter table public.organization_subscriptions add column if not exists cancelled_at timestamptz;
comment on column public.organization_subscriptions.cancelled_at is 'When the org owner or Super Admin cancelled this subscription.';

alter table public.organization_subscriptions add column if not exists cancellation_reason text;
comment on column public.organization_subscriptions.cancellation_reason is 'Free-text reason captured during cancellation.';

alter table public.organization_subscriptions add column if not exists data_retention_days int default 90;
comment on column public.organization_subscriptions.data_retention_days is 'How long to retain org data after cancellation before automated purging.';

alter table public.organization_subscriptions add column if not exists dunning_attempts int not null default 0;
comment on column public.organization_subscriptions.dunning_attempts is 'Number of payment retry attempts for the current failed billing cycle.';

alter table public.organization_subscriptions add column if not exists dunning_next_retry timestamptz;
comment on column public.organization_subscriptions.dunning_next_retry is 'When the next payment retry should be attempted.';

alter table public.organization_subscriptions add column if not exists scheduled_change_id uuid;
comment on column public.organization_subscriptions.scheduled_change_id is 'Pending plan change scheduled for next billing period.';

-- Subscription events: complete audit trail for every lifecycle change.
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.organization_subscriptions(id) on delete set null,
  event_type text not null check (event_type in (
    'created', 'plan_changed', 'status_changed', 'trial_started',
    'trial_converted', 'trial_expired', 'trial_extended',
    'renewed', 'renewal_failed',
    'cancelled', 'cancellation_reverted',
    'suspended', 'reactivated',
    'upgraded', 'downgraded', 'downgrade_scheduled', 'downgrade_applied', 'downgrade_cancelled',
    'payment_failed', 'payment_recovered',
    'addon_added', 'addon_removed', 'addon_quantity_changed',
    'limit_warning', 'limit_exceeded',
    'price_override_set', 'billing_period_changed',
    'dunning_started', 'dunning_attempt', 'dunning_succeeded'
  )),
  previous_state jsonb,
  new_state jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  reason text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscription_events_org_id_idx on public.subscription_events (organization_id);
create index if not exists subscription_events_sub_id_idx on public.subscription_events (subscription_id);
create index if not exists subscription_events_type_idx on public.subscription_events (event_type);
create index if not exists subscription_events_created_idx on public.subscription_events (created_at desc);

alter table public.subscription_events enable row level security;

drop policy if exists "subscription events readable by super admins" on public.subscription_events;
create policy "subscription events readable by super admins"
  on public.subscription_events for select to authenticated
  using (public.is_super_admin());

drop policy if exists "subscription events readable by tenant managers" on public.subscription_events;
create policy "subscription events readable by tenant managers"
  on public.subscription_events for select to authenticated
  using (
    public.is_organization_owner(organization_id)
    or (public.has_role('gym_admin') and organization_id = public.current_user_organization_id())
  );

drop policy if exists "subscription events insertable by service role" on public.subscription_events;
create policy "subscription events insertable by service role"
  on public.subscription_events for insert to authenticated
  with check (public.is_super_admin());

-- Package add-ons: sellable extras that can be attached to any package.
create table if not exists public.package_addons (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  name text not null,
  description text,
  type text not null check (type in ('members', 'branches', 'storage_gb', 'feature', 'api_calls', 'support')),
  unit_price int not null check (unit_price >= 0),
  max_quantity int not null default 1 check (max_quantity > 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists package_addons_package_id_idx on public.package_addons (package_id);

alter table public.package_addons enable row level security;

drop policy if exists "addons readable by authenticated" on public.package_addons;
create policy "addons readable by authenticated"
  on public.package_addons for select to authenticated
  using (true);

drop policy if exists "addons manageable by super admins" on public.package_addons;
create policy "addons manageable by super admins"
  on public.package_addons for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "addons updatable by super admins" on public.package_addons;
create policy "addons updatable by super admins"
  on public.package_addons for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "addons deletable by super admins" on public.package_addons;
create policy "addons deletable by super admins"
  on public.package_addons for delete to authenticated
  using (public.is_super_admin());

-- Org-level add-on assignments.
create table if not exists public.subscription_addons (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.organization_subscriptions(id) on delete cascade,
  addon_id uuid not null references public.package_addons(id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  unit_price int not null,
  created_at timestamptz not null default now()
);

create unique index if not exists subscription_addons_unique_idx on public.subscription_addons (subscription_id, addon_id);

alter table public.subscription_addons enable row level security;

drop policy if exists "sub addons readable by super admins" on public.subscription_addons;
create policy "sub addons readable by super admins"
  on public.subscription_addons for select to authenticated
  using (public.is_super_admin());

drop policy if exists "sub addons readable by tenant managers" on public.subscription_addons;
create policy "sub addons readable by tenant managers"
  on public.subscription_addons for select to authenticated
  using (
    public.is_organization_owner(
      (select organization_id from public.organization_subscriptions where id = subscription_id)
    )
  );

drop policy if exists "sub addons manageable by super admins" on public.subscription_addons;
create policy "sub addons manageable by super admins"
  on public.subscription_addons for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "sub addons deletable by super admins" on public.subscription_addons;
create policy "sub addons deletable by super admins"
  on public.subscription_addons for delete to authenticated
  using (public.is_super_admin());

-- Scheduled plan changes (downgrades apply at end of billing period).
create table if not exists public.scheduled_plan_changes (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.organization_subscriptions(id) on delete cascade,
  from_package_id uuid not null references public.packages(id) on delete restrict,
  to_package_id uuid not null references public.packages(id) on delete restrict,
  effective_date timestamptz not null,
  change_type text not null check (change_type in ('upgrade', 'downgrade', 'crossgrade')),
  status text not null default 'pending' check (status in ('pending', 'applied', 'cancelled', 'failed')),
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  applied_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);

create index if not exists scheduled_plan_changes_sub_id_idx on public.scheduled_plan_changes (subscription_id);
create index if not exists scheduled_plan_changes_status_idx on public.scheduled_plan_changes (status);
create index if not exists scheduled_plan_changes_effective_idx on public.scheduled_plan_changes (effective_date);

alter table public.scheduled_plan_changes enable row level security;

drop policy if exists "scheduled changes readable by super admins" on public.scheduled_plan_changes;
create policy "scheduled changes readable by super admins"
  on public.scheduled_plan_changes for select to authenticated
  using (public.is_super_admin());

drop policy if exists "scheduled changes manageable by super admins" on public.scheduled_plan_changes;
create policy "scheduled changes manageable by super admins"
  on public.scheduled_plan_changes for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "scheduled changes updatable by super admins" on public.scheduled_plan_changes;
create policy "scheduled changes updatable by super admins"
  on public.scheduled_plan_changes for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Subscription usage snapshots for limit monitoring.
create table if not exists public.subscription_usage_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_count int not null default 0,
  branch_count int not null default 0,
  storage_gb numeric(10,2) not null default 0,
  api_calls_last_30d bigint not null default 0,
  active_trainers int not null default 0,
  snapshot_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (organization_id, snapshot_date)
);

create index if not exists usage_snapshots_org_id_idx on public.subscription_usage_snapshots (organization_id);
create index if not exists usage_snapshots_date_idx on public.subscription_usage_snapshots (snapshot_date desc);

alter table public.subscription_usage_snapshots enable row level security;

drop policy if exists "usage snapshots readable by super admins" on public.subscription_usage_snapshots;
create policy "usage snapshots readable by super admins"
  on public.subscription_usage_snapshots for select to authenticated
  using (public.is_super_admin());

drop policy if exists "usage snapshots readable by org owners" on public.subscription_usage_snapshots;
create policy "usage snapshots readable by org owners"
  on public.subscription_usage_snapshots for select to authenticated
  using (public.is_organization_owner(organization_id));

-- Dunning/payment retry tracking.
alter table public.organization_subscriptions add column if not exists dunning_history jsonb default '[]'::jsonb;
comment on column public.organization_subscriptions.dunning_history is 'Array of {attempted_at, status, error_message} objects.';

-- Triggers
drop trigger if exists set_package_addons_updated_at on public.package_addons;
create trigger set_package_addons_updated_at
  before update on public.package_addons
  for each row execute function public.set_updated_at();

-- Seed add-ons for existing packages
do $$
declare
  p record;
begin
  for p in select id, name from public.packages loop
    if p.name = 'Lite' then
      insert into public.package_addons (package_id, name, description, type, unit_price, max_quantity, sort_order)
      values (p.id, 'Extra 50 members', 'Add 50 additional member seats', 'members', 49900, 10, 1)
      on conflict do nothing;
    end if;
    if p.name = 'Standard' then
      insert into public.package_addons (package_id, name, description, type, unit_price, max_quantity, sort_order)
      values
        (p.id, 'Extra 100 members', 'Add 100 additional member seats', 'members', 79900, 10, 1),
        (p.id, 'Extra branch', 'Add one additional gym branch', 'branches', 99900, 5, 2)
      on conflict do nothing;
    end if;
  end loop;
end $$;

-- Seed pricing and billing period on existing packages
update public.packages set
  price = case name
    when 'Lite' then 499900
    when 'Standard' then 1499900
    when 'Premium' then 3999900
  end,
  billing_period = case name
    when 'Lite' then 'monthly'
    when 'Standard' then 'monthly'
    when 'Premium' then 'monthly'
  end,
  recommended = (name = 'Standard')
where price is null;
