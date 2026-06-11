-- QA Phase 11 remediation.
-- Scope: prevent notification and communication write paths from claiming another tenant scope.

drop policy if exists "preferences manageable by owner or staff" on public.notification_preferences;
create policy "preferences manageable by owner or staff"
on public.notification_preferences for all to authenticated
using (
  (
    user_id = (select auth.uid())
    and (gym_id is null or gym_id = public.current_user_gym_id())
  )
  or public.is_super_admin()
  or public.can_operate_gym(gym_id)
)
with check (
  (
    user_id = (select auth.uid())
    and (gym_id is null or gym_id = public.current_user_gym_id())
  )
  or public.is_super_admin()
  or public.can_operate_gym(gym_id)
);

drop policy if exists "staff trainers can create notifications" on public.notifications;
create policy "staff trainers can create notifications"
on public.notifications for insert to authenticated
with check (
  public.is_super_admin()
  or public.can_operate_gym(gym_id)
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['trainer'])
  )
);

drop policy if exists "staff trainers can write communication history" on public.communication_history;
create policy "staff trainers can write communication history"
on public.communication_history for insert to authenticated
with check (
  public.is_super_admin()
  or public.can_operate_gym(gym_id)
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['trainer'])
  )
);
