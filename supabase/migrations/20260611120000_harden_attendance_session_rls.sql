create or replace function public.can_record_attendance_session(
  target_gym_id uuid,
  target_member_id uuid,
  target_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members m
    join public.memberships ms on ms.member_id = m.id
    where m.id = target_member_id
      and m.gym_id = target_gym_id
      and m.status = 'active'
      and ms.id = target_membership_id
      and ms.gym_id = target_gym_id
      and ms.status = 'active'
      and ms.payment_status in ('paid', 'waived')
      and ms.start_date <= current_date
      and ms.end_date >= current_date
  );
$$;

drop policy if exists "staff can manage attendance sessions" on public.attendance_sessions;
drop policy if exists "staff can insert valid attendance sessions" on public.attendance_sessions;
drop policy if exists "staff can update attendance sessions in scope" on public.attendance_sessions;

create policy "staff can insert valid attendance sessions"
on public.attendance_sessions
for insert
to authenticated
with check (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
    and public.can_record_attendance_session(gym_id, member_id, membership_id)
  )
);

create policy "staff can update attendance sessions in scope"
on public.attendance_sessions
for update
to authenticated
using (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
)
with check (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
    and (
      status <> 'inside'
      or public.can_record_attendance_session(gym_id, member_id, membership_id)
    )
  )
);
