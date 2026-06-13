alter table public.roles add column if not exists is_system boolean not null default false;

update public.roles set is_system = true where name in ('super_admin', 'organization_owner', 'gym_admin', 'reception_staff', 'trainer', 'member');

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  resource text not null,
  actions text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (role_id, resource)
);

create index if not exists role_permissions_role_id_idx on public.role_permissions (role_id);

insert into public.roles (name, display_name, description, is_system)
values ('organization_owner', 'Organization Owner', 'Organization-level administrator with full operational control across all branches.', true)
on conflict (name) do nothing;
