-- SaaS package and organization subscription system.
-- Super Admins manage package tiers and assign exactly one package subscription
-- to each organization. Tenant roles can only read their own subscription state.

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text null,
  max_members integer not null check (max_members = -1 or max_members > 0),
  max_branches integer not null check (max_branches = -1 or max_branches > 0),
  qr_attendance_enabled boolean not null default true,
  biometric_attendance_enabled boolean not null default false,
  rfid_attendance_enabled boolean not null default false,
  class_scheduling_enabled boolean not null default false,
  trainer_assignment_enabled boolean not null default false,
  razorpay_enabled boolean not null default false,
  communications_enabled boolean not null default false,
  ai_enabled boolean not null default false,
  advanced_reports_enabled boolean not null default false,
  custom_domain_enabled boolean not null default false,
  api_access_enabled boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  package_id uuid not null references public.packages(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'trial', 'expired', 'suspended', 'cancelled')),
  trial_ends_at timestamptz null,
  started_at timestamptz not null default now(),
  expires_at timestamptz null,
  assigned_by uuid null references auth.users(id) on delete set null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.packages is 'Feature-gated SaaS package tiers assignable by Super Admins.';
comment on table public.organization_subscriptions is 'Current package subscription assigned to each organization.';
comment on column public.packages.max_members is 'Maximum member seats. Use -1 for unlimited.';
comment on column public.packages.max_branches is 'Maximum branches. Use -1 for unlimited.';
comment on column public.organization_subscriptions.expires_at is 'Null means the organization subscription does not expire.';

-- Seed default tiers. Upserts keep the migration safe if a partially restored
-- environment already contains the canonical package names.
insert into public.packages (
  name,
  description,
  max_members,
  max_branches,
  qr_attendance_enabled,
  biometric_attendance_enabled,
  rfid_attendance_enabled,
  class_scheduling_enabled,
  trainer_assignment_enabled,
  razorpay_enabled,
  communications_enabled,
  ai_enabled,
  advanced_reports_enabled,
  custom_domain_enabled,
  api_access_enabled,
  is_active,
  sort_order
)
values
  (
    'Lite',
    'Starter package for single-branch gyms with QR attendance.',
    150,
    1,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    true,
    1
  ),
  (
    'Standard',
    'Operational package for growing gyms with scheduling, payments, communications, and reports.',
    500,
    3,
    true,
    true,
    false,
    true,
    true,
    true,
    true,
    false,
    true,
    false,
    false,
    true,
    2
  ),
  (
    'Premium',
    'Unlimited enterprise package with every platform feature enabled.',
    -1,
    -1,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    3
  )
on conflict (name) do update
set
  description = excluded.description,
  max_members = excluded.max_members,
  max_branches = excluded.max_branches,
  qr_attendance_enabled = excluded.qr_attendance_enabled,
  biometric_attendance_enabled = excluded.biometric_attendance_enabled,
  rfid_attendance_enabled = excluded.rfid_attendance_enabled,
  class_scheduling_enabled = excluded.class_scheduling_enabled,
  trainer_assignment_enabled = excluded.trainer_assignment_enabled,
  razorpay_enabled = excluded.razorpay_enabled,
  communications_enabled = excluded.communications_enabled,
  ai_enabled = excluded.ai_enabled,
  advanced_reports_enabled = excluded.advanced_reports_enabled,
  custom_domain_enabled = excluded.custom_domain_enabled,
  api_access_enabled = excluded.api_access_enabled,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Indexes and one-subscription-per-organization enforcement.
create unique index if not exists organization_subscriptions_organization_id_uidx
on public.organization_subscriptions (organization_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_subscriptions_organization_id_key'
      and conrelid = 'public.organization_subscriptions'::regclass
  ) then
    alter table public.organization_subscriptions
      add constraint organization_subscriptions_organization_id_key
      unique using index organization_subscriptions_organization_id_uidx;
  end if;
end $$;

create index if not exists organization_subscriptions_package_id_idx
on public.organization_subscriptions (package_id);

create index if not exists organization_subscriptions_status_idx
on public.organization_subscriptions (status);

create index if not exists organization_subscriptions_expires_at_idx
on public.organization_subscriptions (expires_at);

-- Keep updated_at current. public.set_updated_at() is defined by the base
-- auth/RBAC migration and reused throughout this project.
drop trigger if exists set_packages_updated_at on public.packages;
create trigger set_packages_updated_at
before update on public.packages
for each row execute function public.set_updated_at();

drop trigger if exists set_organization_subscriptions_updated_at on public.organization_subscriptions;
create trigger set_organization_subscriptions_updated_at
before update on public.organization_subscriptions
for each row execute function public.set_updated_at();

alter table public.packages enable row level security;
alter table public.organization_subscriptions enable row level security;

-- Packages: readable by any signed-in user, mutable only by Super Admins.
drop policy if exists "packages readable by authenticated users" on public.packages;
create policy "packages readable by authenticated users"
on public.packages for select to authenticated
using (true);

drop policy if exists "packages insertable by super admins" on public.packages;
create policy "packages insertable by super admins"
on public.packages for insert to authenticated
with check (public.is_super_admin());

drop policy if exists "packages updatable by super admins" on public.packages;
create policy "packages updatable by super admins"
on public.packages for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "packages deletable by super admins" on public.packages;
create policy "packages deletable by super admins"
on public.packages for delete to authenticated
using (public.is_super_admin());

-- Organization subscriptions: Super Admins can read and mutate every row.
drop policy if exists "organization subscriptions readable by super admins" on public.organization_subscriptions;
create policy "organization subscriptions readable by super admins"
on public.organization_subscriptions for select to authenticated
using (public.is_super_admin());

-- Organization Owners and Gym Admins can read only their own organization's
-- package subscription. This intentionally does not grant mutation access.
drop policy if exists "organization subscriptions readable by tenant managers" on public.organization_subscriptions;
create policy "organization subscriptions readable by tenant managers"
on public.organization_subscriptions for select to authenticated
using (
  public.is_organization_owner(organization_id)
  or (
    public.has_role('gym_admin')
    and organization_id = public.current_user_organization_id()
  )
  or exists (
    select 1
    from public.branch_users bu
    where bu.organization_id = organization_subscriptions.organization_id
      and bu.user_id = (select auth.uid())
      and bu.status = 'active'
      and bu.role_name in ('organization_owner', 'gym_admin')
  )
);

drop policy if exists "organization subscriptions insertable by super admins" on public.organization_subscriptions;
create policy "organization subscriptions insertable by super admins"
on public.organization_subscriptions for insert to authenticated
with check (public.is_super_admin());

drop policy if exists "organization subscriptions updatable by super admins" on public.organization_subscriptions;
create policy "organization subscriptions updatable by super admins"
on public.organization_subscriptions for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "organization subscriptions deletable by super admins" on public.organization_subscriptions;
create policy "organization subscriptions deletable by super admins"
on public.organization_subscriptions for delete to authenticated
using (public.is_super_admin());
