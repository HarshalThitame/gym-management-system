-- Phase 2.5: Branch Revenue Split
-- Tables: revenue_split_rules, revenue_split_logs
-- Feature key: branch_revenue_split

create table if not exists public.revenue_split_rules (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  source_branch_id uuid not null references public.branches(id) on delete cascade,
  target_branch_id uuid not null references public.branches(id) on delete cascade,
  split_percentage numeric(5,2) not null check (split_percentage >= 0 and split_percentage <= 100),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists revenue_split_rules_org_idx on public.revenue_split_rules (organization_id);
create index if not exists revenue_split_rules_src_tgt_idx on public.revenue_split_rules (source_branch_id, target_branch_id);
create unique index if not exists revenue_split_rules_org_src_tgt_active_uidx
  on public.revenue_split_rules (organization_id, source_branch_id, target_branch_id)
  where is_active = true;

create table if not exists public.revenue_split_logs (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  source_branch_id uuid references public.branches(id) on delete set null,
  target_branch_id uuid references public.branches(id) on delete set null,
  original_amount integer not null,
  split_amount integer not null,
  split_percentage numeric(5,2) not null,
  rule_id uuid references public.revenue_split_rules(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists revenue_split_logs_org_idx on public.revenue_split_logs (organization_id);
create index if not exists revenue_split_logs_payment_idx on public.revenue_split_logs (payment_id);
create index if not exists revenue_split_logs_org_date_idx on public.revenue_split_logs (organization_id, created_at desc);

-- RLS
alter table if exists public.revenue_split_rules enable row level security;
alter table if exists public.revenue_split_logs enable row level security;

drop policy if exists "Organization owners can manage revenue split rules" on public.revenue_split_rules;
create policy "Organization owners can manage revenue split rules"
  on public.revenue_split_rules for all
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

drop policy if exists "Organization owners can manage revenue split logs" on public.revenue_split_logs;
create policy "Organization owners can manage revenue split logs"
  on public.revenue_split_logs for all
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
