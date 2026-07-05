-- ============================================================================
-- Phase 1: Core Attendance Engine — Roadmap Alignment
-- Tables: occupancy_log, streaks, attendance_analytics
-- Members: qr_code_static, is_currently_in_gym, last_attendance_date
-- Triggers: update_member_gym_status, calculate_streak_on_checkin
-- Indexes: partial for live queries, composite for date-range lookups
-- ============================================================================

-- 1. Add roadmap-spec columns to members
alter table public.members
  add column if not exists qr_code_static text,
  add column if not exists qr_generated_at timestamptz,
  add column if not exists last_attendance_date date,
  add column if not exists is_currently_in_gym boolean not null default false;

-- 2. Occupancy log — periodic snapshots for heatmap
create table if not exists public.occupancy_log (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete cascade,
  organization_id uuid null,
  timestamp timestamptz not null default now(),
  members_in_gym integer not null default 0 check (members_in_gym >= 0),
  total_capacity integer,
  occupancy_percent numeric(5,2),
  hour_of_day integer not null default 0 check (hour_of_day between 0 and 23),
  day_of_week integer not null default 0 check (day_of_week between 0 and 6),
  created_at timestamptz not null default now()
);

create index if not exists occupancy_log_branch_timestamp_idx
  on public.occupancy_log (branch_id, timestamp desc);
create index if not exists occupancy_log_trend_idx
  on public.occupancy_log (branch_id, hour_of_day, day_of_week);

-- 3. Streaks — denormalized for performance
create table if not exists public.streaks (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.members(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete set null,
  current_streak integer not null default 0 check (current_streak >= 0),
  max_streak integer not null default 0 check (max_streak >= 0),
  last_checkin_date date,
  streak_start_date date,
  milestones_reached integer[] not null default '{}'::integer[],
  milestones_claimed integer[] not null default '{}'::integer[],
  total_checkins integer not null default 0 check (total_checkins >= 0),
  total_minutes integer not null default 0 check (total_minutes >= 0),
  is_broken boolean not null default false,
  broken_date date,
  days_since_broken integer,
  updated_at timestamptz not null default now()
);

create index if not exists streaks_member_idx
  on public.streaks (member_id, current_streak desc);
create index if not exists streaks_gym_leaderboard_idx
  on public.streaks (gym_id, current_streak desc)
  where current_streak > 0;

-- 4. Attendance analytics — churn prediction & insights
create table if not exists public.attendance_analytics (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete set null,
  organization_id uuid null,
  week_start_date date,
  checkins_this_week integer not null default 0 check (checkins_this_week >= 0),
  avg_session_duration numeric(10,2),
  month integer,
  year integer,
  checkins_this_month integer not null default 0 check (checkins_this_month >= 0),
  attendance_trend numeric(5,2),
  churn_risk_score integer not null default 0 check (churn_risk_score between 0 and 100),
  last_risk_assessment timestamptz,
  predicted_checkout_date date,
  confidence_score numeric(5,2) check (confidence_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attendance_analytics_member_idx
  on public.attendance_analytics (member_id, week_start_date desc);
create index if not exists attendance_analytics_churn_risk_idx
  on public.attendance_analytics (gym_id, churn_risk_score desc)
  where churn_risk_score > 0;

-- 5. Performance indexes for real-time occupancy queries
create index if not exists attendance_sessions_live_idx
  on public.attendance_sessions (gym_id, branch_id, check_in_at desc)
  where status = 'inside';

-- Removed: date-cast index requires IMMUTABLE function; covered by attendance_sessions_live_idx

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger 1: Update member is_currently_in_gym on check-in/out
create or replace function public.update_member_gym_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.check_out_at is null then
    update public.members
    set is_currently_in_gym = true,
        last_attendance_date = new.check_in_at::date
    where id = new.member_id;
  else
    update public.members
    set is_currently_in_gym = false
    where id = new.member_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_update_member_gym_status on public.attendance_sessions;
create trigger trigger_update_member_gym_status
after insert or update of check_out_at on public.attendance_sessions
for each row
execute function public.update_member_gym_status();

-- Trigger 2: Auto-calculate streak on check-in
create or replace function public.calculate_streak_on_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  last_date date;
  current_date date := new.check_in_at::date;
  streak_count integer;
  member_gym_id uuid;
begin
  select gym_id into member_gym_id from public.members where id = new.member_id;

  if exists (
    select 1 from public.attendance_sessions
    where member_id = new.member_id
      and check_in_at::date = current_date
      and status = 'inside'
      and id != new.id
  ) then
    return new;
  end if;

  select max(check_in_at)::date into last_date
  from public.attendance_sessions
  where member_id = new.member_id
    and check_in_at::date < current_date;

  if last_date is null then
    streak_count := 1;
  elsif (current_date - last_date) = 1 then
    select coalesce(current_streak, 0) + 1 into streak_count
    from public.streaks
    where member_id = new.member_id;
    if streak_count is null then
      streak_count := 1;
    end if;
  else
    streak_count := 1;
  end if;

  insert into public.streaks (
    member_id, gym_id, branch_id,
    current_streak, max_streak,
    last_checkin_date, streak_start_date,
    total_checkins, is_broken
  ) values (
    new.member_id, member_gym_id, new.branch_id,
    streak_count, streak_count,
    current_date, current_date,
    1, false
  )
  on conflict (member_id) do update set
    current_streak = streak_count,
    max_streak = greatest(streaks.max_streak, streak_count),
    last_checkin_date = current_date,
    streak_start_date = case
      when streaks.is_broken or streaks.last_checkin_date is distinct from (current_date - 1)
      then current_date
      else streaks.streak_start_date
    end,
    total_checkins = streaks.total_checkins + 1,
    is_broken = false,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trigger_calculate_streak_on_checkin on public.attendance_sessions;
create trigger trigger_calculate_streak_on_checkin
after insert on public.attendance_sessions
for each row
execute function public.calculate_streak_on_checkin();

-- Trigger 3: Mark streak broken when session auto-closed/voided
create or replace function public.mark_streak_broken()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('auto_closed', 'void') and old.status = 'inside' then
    update public.streaks
    set is_broken = true,
        broken_date = now()::date,
        days_since_broken = 0,
        updated_at = now()
    where member_id = new.member_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_mark_streak_broken on public.attendance_sessions;
create trigger trigger_mark_streak_broken
after update of status on public.attendance_sessions
for each row
when (new.status in ('auto_closed', 'void') and old.status = 'inside')
execute function public.mark_streak_broken();

-- Updated-at triggers
drop trigger if exists set_streaks_updated_at on public.streaks;
create trigger set_streaks_updated_at
before update on public.streaks
for each row
execute function public.set_updated_at();

drop trigger if exists set_attendance_analytics_updated_at on public.attendance_analytics;
create trigger set_attendance_analytics_updated_at
before update on public.attendance_analytics
for each row
execute function public.set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.occupancy_log enable row level security;
alter table public.streaks enable row level security;
alter table public.attendance_analytics enable row level security;

grant select, insert on public.occupancy_log to authenticated;
grant select, insert, update on public.streaks to authenticated;
grant select, insert, update on public.attendance_analytics to authenticated;

drop policy if exists "occupancy_log visible to staff" on public.occupancy_log;
create policy "occupancy_log visible to staff"
on public.occupancy_log for select to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "system can insert occupancy_log" on public.occupancy_log;
create policy "system can insert occupancy_log"
on public.occupancy_log for insert to authenticated
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "streaks visible to member or staff" on public.streaks;
create policy "streaks visible to member or staff"
on public.streaks for select to authenticated
using (
  exists (select 1 from public.members where members.id = streaks.member_id and members.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "system can manage streaks" on public.streaks;
create policy "system can manage streaks"
on public.streaks for all to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
)
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "attendance_analytics visible to staff" on public.attendance_analytics;
create policy "attendance_analytics visible to staff"
on public.attendance_analytics for select to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "system can manage attendance_analytics" on public.attendance_analytics;
create policy "system can manage attendance_analytics"
on public.attendance_analytics for all to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
)
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);
