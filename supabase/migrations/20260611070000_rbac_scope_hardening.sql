-- QA Phase 2 RBAC hardening.
-- Scope: enforce strict organization-owner vs branch/gym-scoped access boundaries.

create or replace function public.can_manage_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or public.is_organization_owner(target_organization_id);
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
          and bu.role_name = 'organization_owner'
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
          and bu.role_name = 'organization_owner'
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
          and bu.role_name = 'organization_owner'
        )
      where b.gym_id = target_gym_id
        and bu.user_id = (select auth.uid())
        and bu.status = 'active'
        and (
          bu.role_name = 'organization_owner'
          or bu.branch_role in ('owner', 'admin', 'manager', 'staff')
        )
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
          and bu.role_name = 'organization_owner'
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

update public.branch_users
set access_scope = 'single_branch'
where role_name in ('gym_admin', 'reception_staff', 'trainer', 'member')
  and access_scope = 'organization';

drop policy if exists "branches visible by organization" on public.branches;
create policy "branches visible by assigned branch"
on public.branches for select to authenticated
using (public.can_access_branch(id));

drop policy if exists "branch users visible by organization" on public.branch_users;
create policy "branch users visible by assigned branch"
on public.branch_users for select to authenticated
using (public.can_access_branch(branch_id) or user_id = (select auth.uid()));

drop policy if exists "branch metrics visible by organization" on public.branch_metrics;
create policy "branch metrics visible by assigned branch"
on public.branch_metrics for select to authenticated
using (public.can_access_branch(branch_id));

drop policy if exists "tenant configs visible by organization" on public.tenant_configs;
create policy "tenant configs visible by tenant owners"
on public.tenant_configs for select to authenticated
using (public.is_super_admin() or public.is_organization_owner(organization_id));

drop policy if exists "tenant configs manageable by managers" on public.tenant_configs;
create policy "tenant configs manageable by tenant owners"
on public.tenant_configs for all to authenticated
using (public.is_super_admin() or public.is_organization_owner(organization_id))
with check (public.is_super_admin() or public.is_organization_owner(organization_id));

drop policy if exists "feature flags visible in scope" on public.feature_flags;
create policy "feature flags visible in assigned scope"
on public.feature_flags for select to authenticated
using (
  public.is_super_admin()
  or (organization_id is not null and public.is_organization_owner(organization_id))
  or (branch_id is not null and public.can_access_branch(branch_id))
);

drop policy if exists "feature flags manageable by managers" on public.feature_flags;
create policy "feature flags manageable by tenant owners"
on public.feature_flags for all to authenticated
using (
  public.is_super_admin()
  or (organization_id is not null and public.is_organization_owner(organization_id))
)
with check (
  public.is_super_admin()
  or (organization_id is not null and public.is_organization_owner(organization_id))
);

grant execute on function public.can_manage_organization(uuid) to authenticated;
grant execute on function public.can_access_branch(uuid) to authenticated;
grant execute on function public.can_access_gym(uuid) to authenticated;
grant execute on function public.can_operate_gym(uuid) to authenticated;
grant execute on function public.can_manage_gym(uuid) to authenticated;

