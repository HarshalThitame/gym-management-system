create extension if not exists pgcrypto;

create table if not exists public.class_categories (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text null check (description is null or char_length(description) <= 500),
  color_token text not null default 'accent' check (char_length(color_token) between 2 and 40),
  status text not null default 'active' check (status in ('active', 'archived')),
  is_system boolean not null default false,
  display_order integer not null default 100,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, slug)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  category_id uuid null references public.class_categories(id) on delete set null,
  name text not null check (char_length(name) between 2 and 140),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null check (char_length(description) between 10 and 1400),
  class_type text not null default 'group_class' check (class_type in ('group_class', 'workshop', 'special_event', 'challenge', 'camp', 'group_pt')),
  difficulty text not null default 'all_levels' check (difficulty in ('beginner', 'intermediate', 'advanced', 'all_levels')),
  duration_minutes integer not null check (duration_minutes between 15 and 240),
  default_capacity integer not null check (default_capacity between 1 and 500),
  reserved_capacity integer not null default 0 check (reserved_capacity >= 0),
  booking_window_days integer not null default 14 check (booking_window_days between 0 and 365),
  cancellation_window_hours integer not null default 4 check (cancellation_window_hours between 0 and 240),
  requirements text null check (requirements is null or char_length(requirements) <= 1000),
  location text null check (location is null or char_length(location) <= 160),
  membership_access text not null default 'active_members' check (membership_access in ('active_members', 'premium_only', 'staff_approval', 'public_event')),
  requires_approval boolean not null default false,
  price_amount integer not null default 0 check (price_amount >= 0),
  currency text not null default 'INR',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived', 'cancelled')),
  calendar_integration jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, slug),
  check (reserved_capacity <= default_capacity)
);

create table if not exists public.class_trainers (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  role text not null default 'primary' check (role in ('primary', 'co_trainer', 'substitute')),
  status text not null default 'active' check (status in ('active', 'inactive', 'replaced')),
  assigned_at timestamptz not null default now(),
  replaced_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, trainer_id, role)
);

create unique index if not exists class_trainers_one_primary_idx
on public.class_trainers (class_id)
where role = 'primary' and status = 'active';

create table if not exists public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  recurrence text not null default 'one_time' check (recurrence in ('one_time', 'daily', 'weekly', 'monthly', 'custom')),
  start_date date not null,
  end_date date null,
  day_of_week integer null check (day_of_week is null or day_of_week between 0 and 6),
  day_of_month integer null check (day_of_month is null or day_of_month between 1 and 31),
  starts_at time not null,
  ends_at time not null,
  timezone text not null default 'Asia/Kolkata',
  capacity_override integer null check (capacity_override is null or capacity_override between 1 and 500),
  status text not null default 'active' check (status in ('active', 'paused', 'ended', 'archived')),
  notes text null check (notes is null or char_length(notes) <= 800),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (end_date is null or end_date >= start_date)
);

create table if not exists public.class_schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  schedule_id uuid not null references public.class_schedules(id) on delete cascade,
  exception_date date not null,
  exception_type text not null check (exception_type in ('cancelled', 'holiday', 'trainer_leave', 'rescheduled', 'capacity_change')),
  replacement_starts_at time null,
  replacement_ends_at time null,
  replacement_trainer_id uuid null references public.trainers(id) on delete set null,
  capacity_override integer null check (capacity_override is null or capacity_override between 1 and 500),
  reason text not null check (char_length(reason) between 3 and 500),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, exception_date),
  check (replacement_ends_at is null or replacement_starts_at is null or replacement_ends_at > replacement_starts_at)
);

create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  schedule_id uuid null references public.class_schedules(id) on delete set null,
  primary_trainer_id uuid null references public.trainers(id) on delete set null,
  substitute_trainer_id uuid null references public.trainers(id) on delete set null,
  session_date date not null,
  starts_at time not null,
  ends_at time not null,
  capacity integer not null check (capacity between 1 and 500),
  reserved_capacity integer not null default 0 check (reserved_capacity >= 0),
  booked_count integer not null default 0 check (booked_count >= 0),
  waitlist_count integer not null default 0 check (waitlist_count >= 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled', 'closed')),
  cancellation_reason text null check (cancellation_reason is null or char_length(cancellation_reason) <= 500),
  location text null check (location is null or char_length(location) <= 160),
  notes text null check (notes is null or char_length(notes) <= 1200),
  calendar_payload jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  completed_at timestamptz null,
  cancelled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, session_date, starts_at),
  check (ends_at > starts_at),
  check (reserved_capacity <= capacity),
  check (booked_count <= capacity)
);

create table if not exists public.class_bookings (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  status text not null default 'booked' check (status in ('booked', 'checked_in', 'attended', 'absent', 'cancelled', 'no_show')),
  booking_source text not null default 'member_portal' check (booking_source in ('member_portal', 'admin', 'trainer', 'reception', 'auto_promoted')),
  booked_at timestamptz not null default now(),
  cancelled_at timestamptz null,
  cancellation_reason text null check (cancellation_reason is null or char_length(cancellation_reason) <= 500),
  waitlist_id uuid null,
  checked_in_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists class_bookings_one_active_booking_idx
on public.class_bookings (session_id, member_id)
where status in ('booked', 'checked_in', 'attended');

create table if not exists public.class_waitlists (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  position integer not null check (position > 0),
  status text not null default 'waiting' check (status in ('waiting', 'promoted', 'expired', 'cancelled')),
  joined_at timestamptz not null default now(),
  promoted_at timestamptz null,
  promoted_booking_id uuid null references public.class_bookings(id) on delete set null,
  notified_at timestamptz null,
  expires_at timestamptz null,
  cancelled_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.class_bookings
  drop constraint if exists class_bookings_waitlist_id_fkey;
alter table public.class_bookings
  add constraint class_bookings_waitlist_id_fkey foreign key (waitlist_id) references public.class_waitlists(id) on delete set null;

create unique index if not exists class_waitlists_one_waiting_idx
on public.class_waitlists (session_id, member_id)
where status = 'waiting';

create table if not exists public.class_attendance (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  booking_id uuid null references public.class_bookings(id) on delete set null,
  class_id uuid not null references public.classes(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  status text not null check (status in ('attended', 'absent', 'cancelled', 'late')),
  method text not null default 'trainer' check (method in ('qr', 'trainer', 'reception', 'system')),
  marked_by uuid null references auth.users(id) on delete set null,
  marked_at timestamptz not null default now(),
  notes text null check (notes is null or char_length(notes) <= 800),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, member_id)
);

create table if not exists public.class_session_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  session_id uuid null references public.class_sessions(id) on delete cascade,
  class_id uuid null references public.classes(id) on delete cascade,
  action text not null check (char_length(action) between 3 and 100),
  from_status text null,
  to_status text null,
  reason text null check (reason is null or char_length(reason) <= 500),
  actor_id uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.class_notification_events (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  session_id uuid null references public.class_sessions(id) on delete cascade,
  class_id uuid null references public.classes(id) on delete cascade,
  booking_id uuid null references public.class_bookings(id) on delete cascade,
  waitlist_id uuid null references public.class_waitlists(id) on delete cascade,
  member_id uuid null references public.members(id) on delete cascade,
  trainer_id uuid null references public.trainers(id) on delete cascade,
  event_type text not null check (event_type in ('booking_confirmed', 'booking_cancelled', 'class_reminder', 'trainer_change', 'schedule_change', 'waitlist_promotion', 'class_cancelled')),
  channel text not null default 'system' check (channel in ('system', 'email', 'whatsapp', 'sms', 'push')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'cancelled')),
  scheduled_for timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists class_categories_gym_status_idx on public.class_categories (gym_id, status, display_order);
create index if not exists classes_gym_status_idx on public.classes (gym_id, status, class_type);
create index if not exists classes_category_idx on public.classes (category_id, status);
create index if not exists class_trainers_trainer_status_idx on public.class_trainers (trainer_id, status);
create index if not exists class_schedules_class_status_idx on public.class_schedules (class_id, status, start_date);
create index if not exists class_schedule_exceptions_schedule_date_idx on public.class_schedule_exceptions (schedule_id, exception_date);
create index if not exists class_sessions_gym_date_status_idx on public.class_sessions (gym_id, session_date, status, starts_at);
create index if not exists class_sessions_class_date_idx on public.class_sessions (class_id, session_date, starts_at);
create index if not exists class_sessions_primary_trainer_idx on public.class_sessions (primary_trainer_id, session_date, starts_at);
create index if not exists class_bookings_member_status_idx on public.class_bookings (member_id, status, booked_at desc);
create index if not exists class_bookings_session_status_idx on public.class_bookings (session_id, status, booked_at);
create index if not exists class_waitlists_session_position_idx on public.class_waitlists (session_id, status, position);
create index if not exists class_waitlists_member_status_idx on public.class_waitlists (member_id, status, joined_at desc);
create index if not exists class_attendance_session_status_idx on public.class_attendance (session_id, status, marked_at desc);
create index if not exists class_attendance_member_idx on public.class_attendance (member_id, marked_at desc);
create index if not exists class_session_logs_session_idx on public.class_session_logs (session_id, created_at desc);
create index if not exists class_notification_events_due_idx on public.class_notification_events (event_type, status, scheduled_for);

drop trigger if exists set_class_categories_updated_at on public.class_categories;
create trigger set_class_categories_updated_at before update on public.class_categories for each row execute function public.set_updated_at();
drop trigger if exists set_classes_updated_at on public.classes;
create trigger set_classes_updated_at before update on public.classes for each row execute function public.set_updated_at();
drop trigger if exists set_class_trainers_updated_at on public.class_trainers;
create trigger set_class_trainers_updated_at before update on public.class_trainers for each row execute function public.set_updated_at();
drop trigger if exists set_class_schedules_updated_at on public.class_schedules;
create trigger set_class_schedules_updated_at before update on public.class_schedules for each row execute function public.set_updated_at();
drop trigger if exists set_class_schedule_exceptions_updated_at on public.class_schedule_exceptions;
create trigger set_class_schedule_exceptions_updated_at before update on public.class_schedule_exceptions for each row execute function public.set_updated_at();
drop trigger if exists set_class_sessions_updated_at on public.class_sessions;
create trigger set_class_sessions_updated_at before update on public.class_sessions for each row execute function public.set_updated_at();
drop trigger if exists set_class_bookings_updated_at on public.class_bookings;
create trigger set_class_bookings_updated_at before update on public.class_bookings for each row execute function public.set_updated_at();
drop trigger if exists set_class_waitlists_updated_at on public.class_waitlists;
create trigger set_class_waitlists_updated_at before update on public.class_waitlists for each row execute function public.set_updated_at();
drop trigger if exists set_class_attendance_updated_at on public.class_attendance;
create trigger set_class_attendance_updated_at before update on public.class_attendance for each row execute function public.set_updated_at();

create or replace function public.recalculate_class_session_counts(target_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.class_sessions
  set
    booked_count = (
      select count(*)::integer
      from public.class_bookings
      where session_id = target_session_id
        and status in ('booked', 'checked_in', 'attended')
    ),
    waitlist_count = (
      select count(*)::integer
      from public.class_waitlists
      where session_id = target_session_id
        and status = 'waiting'
    ),
    updated_at = now()
  where id = target_session_id;
end;
$$;

create or replace function public.is_trainer_for_class_session(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_sessions cs
    left join public.class_trainers ct on ct.class_id = cs.class_id and ct.status = 'active'
    left join public.trainers t on t.id = coalesce(cs.substitute_trainer_id, cs.primary_trainer_id, ct.trainer_id)
    where cs.id = target_session_id
      and t.user_id = (select auth.uid())
  );
$$;

create or replace view public.class_session_utilization
with (security_invoker = true)
as
select
  cs.gym_id,
  cs.class_id,
  c.name as class_name,
  cs.id as session_id,
  cs.session_date,
  cs.status,
  cs.capacity,
  cs.booked_count,
  cs.waitlist_count,
  case when cs.capacity > 0 then round((cs.booked_count::numeric / cs.capacity::numeric) * 100, 2) else 0 end as fill_rate,
  count(ca.id) filter (where ca.status in ('attended', 'late')) as attended_count,
  count(ca.id) filter (where ca.status in ('absent')) as absent_count
from public.class_sessions cs
join public.classes c on c.id = cs.class_id
left join public.class_attendance ca on ca.session_id = cs.id
group by cs.gym_id, cs.class_id, c.name, cs.id, cs.session_date, cs.status, cs.capacity, cs.booked_count, cs.waitlist_count;

create or replace view public.class_booking_trends
with (security_invoker = true)
as
select
  gym_id,
  booked_at::date as booking_date,
  count(*) as total_bookings,
  count(*) filter (where status = 'cancelled') as cancellations,
  count(*) filter (where status in ('booked', 'checked_in', 'attended')) as active_bookings
from public.class_bookings
group by gym_id, booked_at::date;

create or replace view public.class_trainer_summary
with (security_invoker = true)
as
select
  cs.gym_id,
  coalesce(cs.substitute_trainer_id, cs.primary_trainer_id, ct.trainer_id) as trainer_id,
  count(distinct cs.id) as session_count,
  count(distinct cs.id) filter (where cs.status = 'completed') as completed_sessions,
  coalesce(avg(case when cs.capacity > 0 then (cs.booked_count::numeric / cs.capacity::numeric) * 100 else 0 end), 0)::numeric(5,2) as average_fill_rate,
  count(ca.id) filter (where ca.status in ('attended', 'late')) as attended_count
from public.class_sessions cs
left join public.class_trainers ct on ct.class_id = cs.class_id and ct.role = 'primary' and ct.status = 'active'
left join public.class_attendance ca on ca.session_id = cs.id
group by cs.gym_id, coalesce(cs.substitute_trainer_id, cs.primary_trainer_id, ct.trainer_id);

alter table public.class_categories enable row level security;
alter table public.classes enable row level security;
alter table public.class_trainers enable row level security;
alter table public.class_schedules enable row level security;
alter table public.class_schedule_exceptions enable row level security;
alter table public.class_sessions enable row level security;
alter table public.class_bookings enable row level security;
alter table public.class_waitlists enable row level security;
alter table public.class_attendance enable row level security;
alter table public.class_session_logs enable row level security;
alter table public.class_notification_events enable row level security;

grant select, insert, update on public.class_categories to authenticated;
grant select, insert, update on public.classes to authenticated;
grant select, insert, update, delete on public.class_trainers to authenticated;
grant select, insert, update on public.class_schedules to authenticated;
grant select, insert, update on public.class_schedule_exceptions to authenticated;
grant select, insert, update on public.class_sessions to authenticated;
grant select, insert, update on public.class_bookings to authenticated;
grant select, insert, update on public.class_waitlists to authenticated;
grant select, insert, update on public.class_attendance to authenticated;
grant select, insert on public.class_session_logs to authenticated;
grant select, insert, update on public.class_notification_events to authenticated;
grant select on public.class_session_utilization to authenticated;
grant select on public.class_booking_trends to authenticated;
grant select on public.class_trainer_summary to authenticated;
grant execute on function public.recalculate_class_session_counts(uuid) to authenticated;
grant execute on function public.is_trainer_for_class_session(uuid) to authenticated;

drop policy if exists "class categories visible in scope" on public.class_categories;
create policy "class categories visible in scope"
on public.class_categories for select to authenticated
using (public.is_super_admin() or gym_id is null or gym_id = public.current_user_gym_id());

drop policy if exists "staff can manage class categories" on public.class_categories;
create policy "staff can manage class categories"
on public.class_categories for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])));

drop policy if exists "classes visible in scope" on public.classes;
create policy "classes visible in scope"
on public.classes for select to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and (status = 'active' or public.has_any_role(array['gym_admin', 'reception_staff', 'trainer'])))
);

drop policy if exists "staff can manage classes" on public.classes;
create policy "staff can manage classes"
on public.classes for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])));

drop policy if exists "class trainers visible in class scope" on public.class_trainers;
create policy "class trainers visible in class scope"
on public.class_trainers for select to authenticated
using (
  exists (
    select 1 from public.classes c
    where c.id = class_trainers.class_id
      and (public.is_super_admin() or c.gym_id = public.current_user_gym_id())
  )
);

drop policy if exists "staff can manage class trainers" on public.class_trainers;
create policy "staff can manage class trainers"
on public.class_trainers for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])));

drop policy if exists "class schedules visible in scope" on public.class_schedules;
create policy "class schedules visible in scope"
on public.class_schedules for select to authenticated
using (public.is_super_admin() or gym_id = public.current_user_gym_id());

drop policy if exists "staff can manage class schedules" on public.class_schedules;
create policy "staff can manage class schedules"
on public.class_schedules for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])));

drop policy if exists "schedule exceptions visible in scope" on public.class_schedule_exceptions;
create policy "schedule exceptions visible in scope"
on public.class_schedule_exceptions for select to authenticated
using (public.is_super_admin() or gym_id = public.current_user_gym_id());

drop policy if exists "staff can manage schedule exceptions" on public.class_schedule_exceptions;
create policy "staff can manage schedule exceptions"
on public.class_schedule_exceptions for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])));

drop policy if exists "class sessions visible in scope" on public.class_sessions;
create policy "class sessions visible in scope"
on public.class_sessions for select to authenticated
using (
  public.is_super_admin()
  or gym_id = public.current_user_gym_id()
  or public.is_trainer_for_class_session(id)
);

drop policy if exists "staff can manage class sessions" on public.class_sessions;
create policy "staff can manage class sessions"
on public.class_sessions for all to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or public.is_trainer_for_class_session(id)
)
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or public.is_trainer_for_class_session(id)
);

drop policy if exists "class bookings visible in scope" on public.class_bookings;
create policy "class bookings visible in scope"
on public.class_bookings for select to authenticated
using (
  exists (select 1 from public.members m where m.id = class_bookings.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_class_session(session_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "members and staff can create class bookings" on public.class_bookings;
create policy "members and staff can create class bookings"
on public.class_bookings for insert to authenticated
with check (
  exists (select 1 from public.members m where m.id = class_bookings.member_id and m.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "bookings manageable by owner staff or trainer" on public.class_bookings;
create policy "bookings manageable by owner staff or trainer"
on public.class_bookings for update to authenticated
using (
  exists (select 1 from public.members m where m.id = class_bookings.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_class_session(session_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
)
with check (
  exists (select 1 from public.members m where m.id = class_bookings.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_class_session(session_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "class waitlists visible in scope" on public.class_waitlists;
create policy "class waitlists visible in scope"
on public.class_waitlists for select to authenticated
using (
  exists (select 1 from public.members m where m.id = class_waitlists.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_class_session(session_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "members and staff can create waitlists" on public.class_waitlists;
create policy "members and staff can create waitlists"
on public.class_waitlists for insert to authenticated
with check (
  exists (select 1 from public.members m where m.id = class_waitlists.member_id and m.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "waitlists manageable by owner staff or trainer" on public.class_waitlists;
create policy "waitlists manageable by owner staff or trainer"
on public.class_waitlists for update to authenticated
using (
  exists (select 1 from public.members m where m.id = class_waitlists.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_class_session(session_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
)
with check (
  exists (select 1 from public.members m where m.id = class_waitlists.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_class_session(session_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "class attendance visible in scope" on public.class_attendance;
create policy "class attendance visible in scope"
on public.class_attendance for select to authenticated
using (
  exists (select 1 from public.members m where m.id = class_attendance.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_class_session(session_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff or trainer can manage class attendance" on public.class_attendance;
create policy "staff or trainer can manage class attendance"
on public.class_attendance for all to authenticated
using (
  public.is_trainer_for_class_session(session_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
)
with check (
  public.is_trainer_for_class_session(session_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "class logs visible to staff trainers" on public.class_session_logs;
create policy "class logs visible to staff trainers"
on public.class_session_logs for select to authenticated
using (
  session_id is not null and public.is_trainer_for_class_session(session_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "class logs insertable by staff trainers" on public.class_session_logs;
create policy "class logs insertable by staff trainers"
on public.class_session_logs for insert to authenticated
with check (
  session_id is not null and public.is_trainer_for_class_session(session_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "class notification events visible in scope" on public.class_notification_events;
create policy "class notification events visible in scope"
on public.class_notification_events for select to authenticated
using (
  exists (select 1 from public.members m where m.id = class_notification_events.member_id and m.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff', 'trainer']))
);

drop policy if exists "staff can manage class notification events" on public.class_notification_events;
create policy "staff can manage class notification events"
on public.class_notification_events for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

with system_categories (name, slug, description, color_token, display_order) as (
  values
    ('Yoga', 'yoga', 'Mobility, breathwork, and controlled strength sessions.', 'success', 10),
    ('Zumba', 'zumba', 'High-energy dance cardio group sessions.', 'accent', 20),
    ('HIIT', 'hiit', 'Interval sessions built for conditioning and fat loss.', 'warning', 30),
    ('CrossFit', 'crossfit', 'Functional strength and metabolic conditioning.', 'primary', 40),
    ('Strength Training', 'strength-training', 'Barbell and resistance-led strength classes.', 'secondary', 50),
    ('Pilates', 'pilates', 'Core control, posture, and movement quality.', 'success', 60),
    ('Functional Training', 'functional-training', 'Everyday movement patterns and athletic capacity.', 'primary', 70),
    ('Cardio Sessions', 'cardio-sessions', 'Heart-rate-led conditioning classes.', 'warning', 80),
    ('Bootcamp', 'bootcamp', 'Team-style conditioning and strength circuits.', 'accent', 90),
    ('Group PT', 'group-pt', 'Small-group coaching with trainer-led progression.', 'primary', 100),
    ('Workshops', 'workshops', 'Technique clinics and education-focused sessions.', 'secondary', 110),
    ('Special Events', 'special-events', 'Challenges, camps, and transformation programs.', 'accent', 120)
)
insert into public.class_categories (gym_id, name, slug, description, color_token, is_system, display_order)
select null, name, slug, description, color_token, true, display_order
from system_categories
where not exists (
  select 1
  from public.class_categories existing
  where existing.gym_id is null
    and existing.slug = system_categories.slug
);
