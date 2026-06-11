-- QA Phase 2 RBAC hardening.
-- Gym Admins can see operational branch users, but not SaaS/organization-owner assignments.

drop policy if exists "branch users visible by assignment or manager" on public.branch_users;
create policy "branch users visible by assignment or manager"
on public.branch_users for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or public.is_organization_owner(organization_id)
  or (
    role_name not in ('super_admin', 'organization_owner')
    and public.can_view_branch_user_roster(branch_id, organization_id)
  )
);

