-- Phase 1: add Organization Owner as a first-class SaaS tenant role.

alter table public.roles drop constraint if exists roles_name_check;
alter table public.roles
  add constraint roles_name_check
  check (name in ('super_admin', 'organization_owner', 'gym_admin', 'reception_staff', 'trainer', 'member'));

insert into public.roles (name, display_name, description)
values (
  'organization_owner',
  'Organization Owner',
  'Tenant owner with organization-wide access across all gyms, branches, staff, trainers, members, billing, analytics, domains, and branding inside one organization.'
)
on conflict (name) do update
set
  display_name = excluded.display_name,
  description = excluded.description;

alter table public.branch_users drop constraint if exists branch_users_role_name_check;
alter table public.branch_users
  add constraint branch_users_role_name_check
  check (role_name in ('super_admin', 'organization_owner', 'gym_admin', 'reception_staff', 'trainer', 'member'));

alter table public.dashboard_configs drop constraint if exists dashboard_configs_role_name_check;
alter table public.dashboard_configs
  add constraint dashboard_configs_role_name_check
  check (role_name in ('super_admin', 'organization_owner', 'gym_admin', 'reception_staff', 'trainer', 'member'));

create or replace function public.is_organization_owner(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.branch_users bu
    where bu.organization_id = target_organization_id
      and bu.user_id = (select auth.uid())
      and bu.status = 'active'
      and bu.role_name = 'organization_owner'
      and bu.access_scope = 'organization'
  );
$$;

create or replace function public.can_access_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or public.is_organization_owner(target_organization_id)
    or exists (
      select 1
      from public.branch_users bu
      where bu.organization_id = target_organization_id
        and bu.user_id = (select auth.uid())
        and bu.status = 'active'
    );
$$;

create or replace function public.can_manage_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or public.is_organization_owner(target_organization_id)
    or exists (
      select 1
      from public.branch_users bu
      where bu.organization_id = target_organization_id
        and bu.user_id = (select auth.uid())
        and bu.status = 'active'
        and bu.branch_role in ('owner', 'admin', 'manager')
    );
$$;

create or replace function public.can_access_branch(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.branches b
      join public.branch_users bu
        on bu.branch_id = b.id
        or (
          bu.organization_id = b.organization_id
          and bu.access_scope = 'organization'
        )
      where b.id = target_branch_id
        and bu.user_id = (select auth.uid())
        and bu.status = 'active'
    );
$$;

create or replace function public.can_access_gym(target_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or (
      target_gym_id is not null
      and target_gym_id = public.current_user_gym_id()
      and public.has_any_role(array['gym_admin', 'reception_staff', 'trainer', 'member'])
    )
    or exists (
      select 1
      from public.branches b
      join public.branch_users bu
        on bu.branch_id = b.id
        or (
          bu.organization_id = b.organization_id
          and bu.access_scope = 'organization'
        )
      where b.gym_id = target_gym_id
        and bu.user_id = (select auth.uid())
        and bu.status = 'active'
    );
$$;

create or replace function public.can_operate_gym(target_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or (
      target_gym_id is not null
      and target_gym_id = public.current_user_gym_id()
      and public.has_any_role(array['gym_admin', 'reception_staff'])
    )
    or exists (
      select 1
      from public.branches b
      join public.branch_users bu
        on bu.branch_id = b.id
        or (
          bu.organization_id = b.organization_id
          and bu.access_scope = 'organization'
        )
      where b.gym_id = target_gym_id
        and bu.user_id = (select auth.uid())
        and bu.status = 'active'
        and bu.branch_role in ('owner', 'admin', 'manager', 'staff')
    );
$$;

create or replace function public.can_manage_gym(target_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or (
      target_gym_id is not null
      and target_gym_id = public.current_user_gym_id()
      and public.has_any_role(array['gym_admin'])
    )
    or exists (
      select 1
      from public.branches b
      join public.branch_users bu
        on bu.branch_id = b.id
        or (
          bu.organization_id = b.organization_id
          and bu.access_scope = 'organization'
        )
      where b.gym_id = target_gym_id
        and bu.user_id = (select auth.uid())
        and bu.status = 'active'
        and (
          bu.role_name = 'organization_owner'
          or bu.branch_role in ('owner', 'admin', 'manager')
        )
    );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  selected_role text;
  selected_role_id uuid;
  selected_gym_id uuid;
begin
  requested_role := coalesce(new.raw_app_meta_data->>'default_role', 'member');
  selected_role := case
    when requested_role in ('super_admin', 'organization_owner', 'gym_admin', 'reception_staff', 'trainer', 'member') then requested_role
    else 'member'
  end;

  selected_gym_id := nullif(new.raw_app_meta_data->>'gym_id', '')::uuid;

  insert into public.profiles (id, gym_id, full_name, email, phone, status)
  values (
    new.id,
    selected_gym_id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    nullif(new.raw_user_meta_data->>'phone', ''),
    case when new.raw_app_meta_data ? 'invited_by' then 'invited' else 'active' end
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end,
    phone = coalesce(public.profiles.phone, excluded.phone),
    updated_at = now();

  select id into selected_role_id from public.roles where name = selected_role;

  if selected_role_id is not null then
    insert into public.user_roles (user_id, role_id, gym_id)
    values (
      new.id,
      selected_role_id,
      case when selected_role in ('super_admin', 'organization_owner') then null else selected_gym_id end
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

with auth_user_defaults as (
  select
    u.id,
    case
      when coalesce(u.raw_app_meta_data->>'default_role', 'member') in ('super_admin', 'organization_owner', 'gym_admin', 'reception_staff', 'trainer', 'member')
        then coalesce(u.raw_app_meta_data->>'default_role', 'member')
      else 'member'
    end as role_name,
    case
      when nullif(u.raw_app_meta_data->>'gym_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then nullif(u.raw_app_meta_data->>'gym_id', '')::uuid
      else null
    end as gym_id
  from auth.users u
)
insert into public.user_roles (user_id, role_id, gym_id)
select
  aud.id,
  r.id,
  case when aud.role_name in ('super_admin', 'organization_owner') then null else aud.gym_id end
from auth_user_defaults aud
join public.roles r on r.name = aud.role_name
where aud.role_name = 'organization_owner'
  and not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = aud.id
      and ur.role_id = r.id
      and ur.gym_id is null
  )
on conflict do nothing;

grant execute on function public.is_organization_owner(uuid) to authenticated;
grant execute on function public.can_access_organization(uuid) to authenticated;
grant execute on function public.can_manage_organization(uuid) to authenticated;
grant execute on function public.can_access_branch(uuid) to authenticated;
grant execute on function public.can_access_gym(uuid) to authenticated;
grant execute on function public.can_operate_gym(uuid) to authenticated;
grant execute on function public.can_manage_gym(uuid) to authenticated;
