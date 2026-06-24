-- Custom Roles & Granular Permissions (Phase 2.3)
-- Organization Owners can define custom roles with per-resource permissions.

create table if not exists public.custom_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists custom_roles_org_id_idx on public.custom_roles (organization_id);

create table if not exists public.user_custom_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  custom_role_id uuid not null references public.custom_roles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, custom_role_id)
);

create index if not exists user_custom_roles_user_id_idx on public.user_custom_roles (user_id);
create index if not exists user_custom_roles_custom_role_id_idx on public.user_custom_roles (custom_role_id);
create index if not exists user_custom_roles_org_id_idx on public.user_custom_roles (organization_id);

alter table public.custom_roles enable row level security;
alter table public.user_custom_roles enable row level security;

-- RLS: Organization owners can read custom roles for their org
drop policy if exists "org_owners_can_read_custom_roles" on public.custom_roles;
create policy "org_owners_can_read_custom_roles"
on public.custom_roles
for select
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and r.name = 'organization_owner'
      and ur.gym_id in (
        select g.id from public.gyms g where g.organization_id = custom_roles.organization_id
      )
  )
);

-- RLS: Organization owners can insert/update/delete custom roles for their org
drop policy if exists "org_owners_can_manage_custom_roles" on public.custom_roles;
create policy "org_owners_can_manage_custom_roles"
on public.custom_roles
for insert
to authenticated
with check (
  exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and r.name = 'organization_owner'
      and ur.gym_id in (
        select g.id from public.gyms g where g.organization_id = organization_id
      )
  )
);

drop policy if exists "org_owners_can_update_custom_roles" on public.custom_roles;
create policy "org_owners_can_update_custom_roles"
on public.custom_roles
for update
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and r.name = 'organization_owner'
      and ur.gym_id in (
        select g.id from public.gyms g where g.organization_id = custom_roles.organization_id
      )
  )
)
with check (
  exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and r.name = 'organization_owner'
      and ur.gym_id in (
        select g.id from public.gyms g where g.organization_id = custom_roles.organization_id
      )
  )
);

drop policy if exists "org_owners_can_delete_custom_roles" on public.custom_roles;
create policy "org_owners_can_delete_custom_roles"
on public.custom_roles
for delete
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and r.name = 'organization_owner'
      and ur.gym_id in (
        select g.id from public.gyms g where g.organization_id = custom_roles.organization_id
      )
  )
);

-- RLS: Authenticated users can read their own custom role assignments
drop policy if exists "users_can_read_own_custom_roles" on public.user_custom_roles;
create policy "users_can_read_own_custom_roles"
on public.user_custom_roles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and r.name = 'organization_owner'
      and ur.gym_id in (
        select g.id from public.gyms g where g.organization_id = user_custom_roles.organization_id
      )
  )
);

-- RLS: Organization owners can insert/delete user_custom_roles for their org
drop policy if exists "org_owners_can_manage_user_custom_roles" on public.user_custom_roles;
create policy "org_owners_can_manage_user_custom_roles"
on public.user_custom_roles
for insert
to authenticated
with check (
  exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and r.name = 'organization_owner'
      and ur.gym_id in (
        select g.id from public.gyms g where g.organization_id = user_custom_roles.organization_id
      )
  )
);

drop policy if exists "org_owners_can_delete_user_custom_roles" on public.user_custom_roles;
create policy "org_owners_can_delete_user_custom_roles"
on public.user_custom_roles
for delete
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and r.name = 'organization_owner'
      and ur.gym_id in (
        select g.id from public.gyms g where g.organization_id = user_custom_roles.organization_id
      )
  )
);

-- Updated-at trigger for custom_roles
drop trigger if exists set_custom_roles_updated_at on public.custom_roles;
create trigger set_custom_roles_updated_at
before update on public.custom_roles
for each row execute function public.set_updated_at();
