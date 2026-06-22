-- Phase 1.5: Trainer Commissions + Payroll
-- Tables: trainer_commission_rates, trainer_commissions
-- ALTER: trainers.base_salary

-- Commission rate configuration per trainer per source type
-- trainer_id can be NULL for org-wide default rates (fallback when no trainer-specific rate)
create table if not exists public.trainer_commission_rates (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trainer_id uuid null references public.trainers(id) on delete cascade,
  source_type text not null check (source_type in ('pt_session', 'class', 'membership_sale')),
  rate numeric(5,2) not null check (rate >= 0 and rate <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trainer_commission_rates_org_idx on public.trainer_commission_rates (organization_id, trainer_id, source_type);
create unique index if not exists trainer_commission_rates_trainer_unique_idx on public.trainer_commission_rates (organization_id, trainer_id, source_type) where trainer_id is not null;
create unique index if not exists trainer_commission_rates_default_unique_idx on public.trainer_commission_rates (organization_id, source_type) where trainer_id is null;

-- Commission entries auto-generated when a PT session completes or class attendance is marked
create table if not exists public.trainer_commissions (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  source_type text not null check (source_type in ('pt_session', 'class', 'membership_sale')),
  source_id uuid not null,
  description text,
  amount integer not null check (amount >= 0),
  rate numeric(5,2) not null default 0,
  calculated_at timestamptz not null default now(),
  paid_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trainer_commissions_org_idx on public.trainer_commissions (organization_id, status, calculated_at desc);
create index if not exists trainer_commissions_trainer_idx on public.trainer_commissions (trainer_id, status, calculated_at desc);
create index if not exists trainer_commissions_status_idx on public.trainer_commissions (status);
create index if not exists trainer_commissions_calc_at_idx on public.trainer_commissions (calculated_at);

-- ALTER trainers: add base_salary (in rupees, integer)
alter table public.trainers
  add column if not exists base_salary integer not null default 0 check (base_salary >= 0);

-- RLS
alter table if exists public.trainer_commission_rates enable row level security;
alter table if exists public.trainer_commissions enable row level security;

-- Policies: organization owner has full access
drop policy if exists "Organization owners can manage commission rates" on public.trainer_commission_rates;
create policy "Organization owners can manage commission rates"
  on public.trainer_commission_rates for all
  to authenticated
  using (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  );

drop policy if exists "Organization owners can manage commissions" on public.trainer_commissions;
create policy "Organization owners can manage commissions"
  on public.trainer_commissions for all
  to authenticated
  using (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  );

-- Trainers can view their own commissions
drop policy if exists "Trainers can view own commissions" on public.trainer_commissions;
create policy "Trainers can view own commissions"
  on public.trainer_commissions for select
  to authenticated
  using (
    exists (
      select 1 from public.trainers t
      where t.id = trainer_commissions.trainer_id
        and t.user_id = auth.uid()
    )
  );

-- Service role full access
drop policy if exists "Service role full access on commission rates" on public.trainer_commission_rates;
create policy "Service role full access on commission rates"
  on public.trainer_commission_rates for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role full access on commissions" on public.trainer_commissions;
create policy "Service role full access on commissions"
  on public.trainer_commissions for all
  to service_role
  using (true)
  with check (true);

-- Trigger for updated_at
drop trigger if exists set_trainer_commission_rates_updated_at on public.trainer_commission_rates;
create trigger set_trainer_commission_rates_updated_at before update on public.trainer_commission_rates for each row execute function public.set_updated_at();

drop trigger if exists set_trainer_commissions_updated_at on public.trainer_commissions;
create trigger set_trainer_commissions_updated_at before update on public.trainer_commissions for each row execute function public.set_updated_at();

-- Grants
grant select, insert, update, delete on public.trainer_commission_rates to authenticated;
grant select, insert, update on public.trainer_commissions to authenticated;
