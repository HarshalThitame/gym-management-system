-- Phase 2.4: Corporate / Bulk Memberships
-- Enterprise plan feature: corporate_bulk_memberships

create table if not exists public.corporate_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_name text not null check (char_length(company_name) between 1 and 200),
  contact_person text null check (contact_person is null or char_length(contact_person) <= 120),
  contact_email text null check (contact_email is null or char_length(contact_email) <= 254),
  contact_phone text null check (contact_phone is null or char_length(contact_phone) between 8 and 20),
  billing_email text null check (billing_email is null or char_length(billing_email) <= 254),
  discount_percentage numeric(5,2) not null default 0 check (discount_percentage >= 0 and discount_percentage <= 100),
  address text null check (address is null or char_length(address) <= 500),
  notes text null check (notes is null or char_length(notes) <= 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, company_name)
);

create index if not exists idx_corporate_accounts_org on public.corporate_accounts (organization_id);
create index if not exists idx_corporate_accounts_org_active on public.corporate_accounts (organization_id, is_active);

-- Link members to corporate accounts
alter table public.members
  add column if not exists corporate_account_id uuid null references public.corporate_accounts(id) on delete set null;

create index if not exists idx_members_corporate_account on public.members (corporate_account_id);

-- RLS for corporate_accounts
alter table public.corporate_accounts enable row level security;

drop policy if exists "Org owners can manage corporate accounts" on public.corporate_accounts;
create policy "Org owners can manage corporate accounts" on public.corporate_accounts
  for all
  using (
    exists (
      select 1 from public.branch_users
      where branch_users.user_id = auth.uid()
        and branch_users.organization_id = corporate_accounts.organization_id
        and branch_users.role_name = 'organization_owner'
        and branch_users.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.branch_users
      where branch_users.user_id = auth.uid()
        and branch_users.organization_id = corporate_accounts.organization_id
        and branch_users.role_name = 'organization_owner'
        and branch_users.status = 'active'
    )
  );

-- Updated_at trigger
drop trigger if exists set_corporate_accounts_updated_at on public.corporate_accounts;
create trigger set_corporate_accounts_updated_at
  before update on public.corporate_accounts
  for each row execute function public.set_updated_at();
