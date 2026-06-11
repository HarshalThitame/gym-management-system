-- QA Phase 12 remediation.
-- Align organization-owner visibility with organization-scoped gym assignments
-- while preserving member/trainer self-scope and cross-tenant denial.

drop policy if exists "members visible to owner assigned trainer or staff" on public.members;
create policy "members visible to owner assigned trainer or staff"
on public.members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or assigned_trainer_id = (select auth.uid())
  or public.is_super_admin()
  or public.can_operate_gym(gym_id)
);

drop policy if exists "staff can create members in scope" on public.members;
create policy "staff can create members in scope"
on public.members
for insert
to authenticated
with check (public.can_operate_gym(gym_id));

drop policy if exists "staff can update members in scope" on public.members;
create policy "staff can update members in scope"
on public.members
for update
to authenticated
using (public.can_operate_gym(gym_id))
with check (public.can_operate_gym(gym_id));

drop policy if exists "plans visible to authenticated users in scope" on public.membership_plans;
create policy "plans visible to authenticated users in scope"
on public.membership_plans
for select
to authenticated
using (
  public.is_super_admin()
  or gym_id is null
  or public.can_operate_gym(gym_id)
  or (status = 'active' and public.can_access_gym(gym_id))
);

drop policy if exists "admins can create plans in scope" on public.membership_plans;
create policy "admins can create plans in scope"
on public.membership_plans
for insert
to authenticated
with check (public.can_manage_gym(gym_id));

drop policy if exists "admins can update plans in scope" on public.membership_plans;
create policy "admins can update plans in scope"
on public.membership_plans
for update
to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));

drop policy if exists "memberships visible to owner assigned trainer or staff" on public.memberships;
create policy "memberships visible to owner assigned trainer or staff"
on public.memberships
for select
to authenticated
using (
  exists (
    select 1
    from public.members
    where members.id = memberships.member_id
      and (
        members.user_id = (select auth.uid())
        or members.assigned_trainer_id = (select auth.uid())
      )
  )
  or public.is_super_admin()
  or public.can_operate_gym(gym_id)
);

drop policy if exists "staff can create memberships in scope" on public.memberships;
create policy "staff can create memberships in scope"
on public.memberships
for insert
to authenticated
with check (public.can_operate_gym(gym_id));

drop policy if exists "staff can update memberships in scope" on public.memberships;
create policy "staff can update memberships in scope"
on public.memberships
for update
to authenticated
using (public.can_operate_gym(gym_id))
with check (public.can_operate_gym(gym_id));

drop policy if exists "membership history visible in membership scope" on public.membership_history;
create policy "membership history visible in membership scope"
on public.membership_history
for select
to authenticated
using (
  public.is_super_admin()
  or public.can_operate_gym(gym_id)
  or exists (
    select 1
    from public.members
    where members.id = membership_history.member_id
      and members.user_id = (select auth.uid())
  )
);

drop policy if exists "staff can insert membership history" on public.membership_history;
create policy "staff can insert membership history"
on public.membership_history
for insert
to authenticated
with check (public.can_operate_gym(gym_id));

drop policy if exists "membership status logs visible in membership scope" on public.membership_status_logs;
create policy "membership status logs visible in membership scope"
on public.membership_status_logs
for select
to authenticated
using (
  public.is_super_admin()
  or public.can_operate_gym(gym_id)
  or exists (
    select 1
    from public.members
    where members.id = membership_status_logs.member_id
      and members.user_id = (select auth.uid())
  )
);

drop policy if exists "staff can insert membership status logs" on public.membership_status_logs;
create policy "staff can insert membership status logs"
on public.membership_status_logs
for insert
to authenticated
with check (public.can_operate_gym(gym_id));

drop policy if exists "member documents visible in member scope" on public.member_documents;
create policy "member documents visible in member scope"
on public.member_documents
for select
to authenticated
using (
  public.is_super_admin()
  or public.can_operate_gym(gym_id)
  or exists (
    select 1
    from public.members
    where members.id = member_documents.member_id
      and (
        members.user_id = (select auth.uid())
        or members.assigned_trainer_id = (select auth.uid())
      )
  )
);

drop policy if exists "staff can manage member documents" on public.member_documents;
create policy "staff can manage member documents"
on public.member_documents
for all
to authenticated
using (public.can_operate_gym(gym_id))
with check (public.can_operate_gym(gym_id));

drop policy if exists "staff can manage membership notifications" on public.membership_notification_events;
create policy "staff can manage membership notifications"
on public.membership_notification_events
for all
to authenticated
using (public.can_operate_gym(gym_id))
with check (public.can_operate_gym(gym_id));

drop policy if exists "staff can read audit logs in scope" on public.audit_logs;
create policy "staff can read audit logs in scope"
on public.audit_logs
for select
to authenticated
using (
  public.is_super_admin()
  or actor_id = (select auth.uid())
  or public.can_manage_gym(gym_id)
);

drop policy if exists "member documents visible in owner or tenant staff scope" on storage.objects;
create policy "member documents visible in owner or tenant staff scope"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'member-documents'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.members m
      where m.id = public.storage_object_first_uuid(storage.objects.name)
        and (
          m.user_id = (select auth.uid())
          or public.can_operate_gym(m.gym_id)
        )
    )
  )
);

drop policy if exists "member documents uploadable by tenant staff" on storage.objects;
create policy "member documents uploadable by tenant staff"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'member-documents'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.members m
      where m.id = public.storage_object_first_uuid(storage.objects.name)
        and public.can_operate_gym(m.gym_id)
    )
  )
);

drop policy if exists "member documents updatable by tenant staff" on storage.objects;
create policy "member documents updatable by tenant staff"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'member-documents'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.members m
      where m.id = public.storage_object_first_uuid(storage.objects.name)
        and public.can_operate_gym(m.gym_id)
    )
  )
)
with check (
  bucket_id = 'member-documents'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.members m
      where m.id = public.storage_object_first_uuid(storage.objects.name)
        and public.can_operate_gym(m.gym_id)
    )
  )
);

drop policy if exists "member documents deletable by tenant staff" on storage.objects;
create policy "member documents deletable by tenant staff"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'member-documents'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.members m
      where m.id = public.storage_object_first_uuid(storage.objects.name)
        and public.can_operate_gym(m.gym_id)
    )
  )
);
