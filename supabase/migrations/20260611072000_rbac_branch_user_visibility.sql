-- QA Phase 2 RBAC hardening.
-- Prevent reception, trainer, and member users from listing staff assignments.

create or replace function public.can_view_branch_user_roster(target_branch_id uuid, target_organization_id uuid)
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
      where bu.branch_id = target_branch_id
        and bu.user_id = (select auth.uid())
        and bu.status = 'active'
        and bu.role_name = 'gym_admin'
    );
$$;

drop policy if exists "branch users visible by assigned branch" on public.branch_users;
create policy "branch users visible by assignment or manager"
on public.branch_users for select to authenticated
using (
  user_id = (select auth.uid())
  or public.can_view_branch_user_roster(branch_id, organization_id)
);

grant execute on function public.can_view_branch_user_roster(uuid, uuid) to authenticated;

