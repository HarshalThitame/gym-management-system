create extension if not exists pgcrypto;

create table if not exists public.trainers (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  employee_code text not null,
  display_name text not null check (char_length(display_name) between 2 and 120),
  email text null,
  phone text null check (phone is null or char_length(phone) between 8 and 20),
  photo_url text null,
  status text not null default 'active' check (status in ('active', 'inactive', 'on_leave', 'archived')),
  employment_type text not null default 'full_time' check (employment_type in ('full_time', 'part_time', 'contract', 'consultant')),
  joined_at date not null default current_date,
  years_experience integer not null default 0 check (years_experience >= 0 and years_experience <= 60),
  hourly_rate_amount integer not null default 0 check (hourly_rate_amount >= 0),
  created_by uuid null references auth.users(id) on delete set null,
  archived_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, employee_code)
);

create unique index if not exists trainers_gym_user_idx
on public.trainers (gym_id, user_id)
where user_id is not null;

create table if not exists public.trainer_profiles (
  trainer_id uuid primary key references public.trainers(id) on delete cascade,
  headline text not null default 'Performance Coach' check (char_length(headline) between 2 and 160),
  bio text not null default '' check (char_length(bio) <= 1500),
  achievements text null check (achievements is null or char_length(achievements) <= 1200),
  coaching_philosophy text null check (coaching_philosophy is null or char_length(coaching_philosophy) <= 1200),
  instagram_url text null,
  rating numeric(3,2) not null default 0 check (rating >= 0 and rating <= 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  public_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trainer_specializations (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  specialization text not null check (specialization in ('weight_loss', 'muscle_building', 'strength_training', 'powerlifting', 'bodybuilding', 'hiit', 'crossfit', 'yoga', 'functional_training', 'senior_fitness', 'sports_conditioning', 'rehabilitation')),
  proficiency text not null default 'advanced' check (proficiency in ('primary', 'advanced', 'specialist')),
  created_at timestamptz not null default now(),
  unique (trainer_id, specialization)
);

create table if not exists public.trainer_certifications (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  certification_name text not null check (char_length(certification_name) between 2 and 160),
  issuing_organization text not null check (char_length(issuing_organization) between 2 and 160),
  issue_date date null,
  expiry_date date null,
  alert_at date null,
  certificate_file_path text null,
  certificate_file_url text null,
  status text not null default 'active' check (status in ('active', 'expired', 'archived')),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expiry_date is null or issue_date is null or expiry_date >= issue_date)
);

create table if not exists public.trainer_availability (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  break_starts_at time null,
  break_ends_at time null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trainer_id, day_of_week, starts_at, ends_at),
  check (ends_at > starts_at),
  check (break_starts_at is null or break_ends_at is null or break_ends_at > break_starts_at)
);

create table if not exists public.trainer_time_off (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null check (char_length(reason) between 3 and 300),
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'cancelled')),
  approved_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.trainer_assignments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  assignment_type text not null default 'primary' check (assignment_type in ('primary', 'secondary', 'personal_training')),
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  assigned_at timestamptz not null default now(),
  ended_at timestamptz null,
  reason text null check (reason is null or char_length(reason) <= 500),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= assigned_at)
);

create unique index if not exists trainer_assignments_one_active_primary_idx
on public.trainer_assignments (member_id)
where status = 'active' and assignment_type = 'primary';

create unique index if not exists trainer_assignments_active_pair_idx
on public.trainer_assignments (trainer_id, member_id, assignment_type)
where status = 'active';

create table if not exists public.personal_training_packages (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null check (char_length(description) between 10 and 800),
  session_count integer not null check (session_count > 0 and session_count <= 200),
  validity_days integer not null check (validity_days > 0 and validity_days <= 730),
  price_amount integer not null check (price_amount >= 0),
  currency text not null default 'INR',
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  is_public boolean not null default true,
  display_order integer not null default 100,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, slug)
);

create table if not exists public.member_pt_packages (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  trainer_id uuid null references public.trainers(id) on delete set null,
  pt_package_id uuid not null references public.personal_training_packages(id) on delete restrict,
  invoice_id uuid null references public.invoices(id) on delete set null,
  payment_id uuid null references public.payments(id) on delete set null,
  status text not null default 'pending_payment' check (status in ('pending_payment', 'active', 'completed', 'expired', 'cancelled')),
  purchased_at timestamptz not null default now(),
  starts_on date not null default current_date,
  expires_on date not null,
  total_sessions integer not null check (total_sessions > 0),
  used_sessions integer not null default 0 check (used_sessions >= 0),
  remaining_sessions integer generated always as (greatest(total_sessions - used_sessions, 0)) stored,
  price_amount integer not null check (price_amount >= 0),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on >= starts_on),
  check (used_sessions <= total_sessions)
);

create table if not exists public.workout_programs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  member_id uuid null references public.members(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 140),
  goal text not null check (char_length(goal) between 2 and 180),
  description text null check (description is null or char_length(description) <= 1000),
  difficulty text not null default 'intermediate' check (difficulty in ('beginner', 'intermediate', 'advanced', 'elite')),
  duration_weeks integer not null default 4 check (duration_weeks > 0 and duration_weeks <= 52),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  day_number integer not null default 1 check (day_number between 1 and 14),
  exercise_name text not null check (char_length(exercise_name) between 2 and 140),
  category text null check (category is null or char_length(category) <= 80),
  sets text not null default '3' check (char_length(sets) between 1 and 40),
  reps text not null default '10' check (char_length(reps) between 1 and 60),
  rest_seconds integer null check (rest_seconds is null or rest_seconds between 0 and 900),
  tempo text null check (tempo is null or char_length(tempo) <= 40),
  instructions text null check (instructions is null or char_length(instructions) <= 800),
  display_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_program_assignments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  starts_on date not null default current_date,
  ends_on date null,
  assigned_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create unique index if not exists workout_program_assignments_active_idx
on public.workout_program_assignments (program_id, member_id)
where status = 'active';

create table if not exists public.trainer_sessions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  member_pt_package_id uuid null references public.member_pt_packages(id) on delete set null,
  workout_program_id uuid null references public.workout_programs(id) on delete set null,
  session_date date not null,
  starts_at time not null,
  ends_at time not null,
  duration_minutes integer not null check (duration_minutes between 15 and 240),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'missed', 'cancelled', 'rescheduled')),
  workout_type text not null check (char_length(workout_type) between 2 and 120),
  notes text null check (notes is null or char_length(notes) <= 1200),
  completion_notes text null check (completion_notes is null or char_length(completion_notes) <= 1200),
  cancel_reason text null check (cancel_reason is null or char_length(cancel_reason) <= 500),
  created_by uuid null references auth.users(id) on delete set null,
  completed_at timestamptz null,
  cancelled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create unique index if not exists trainer_sessions_no_double_booking_idx
on public.trainer_sessions (trainer_id, session_date, starts_at)
where status in ('scheduled', 'rescheduled');

create table if not exists public.trainer_session_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  session_id uuid not null references public.trainer_sessions(id) on delete cascade,
  from_status text null,
  to_status text not null check (to_status in ('scheduled', 'completed', 'missed', 'cancelled', 'rescheduled')),
  reason text null check (reason is null or char_length(reason) <= 500),
  actor_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.trainer_notes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  session_id uuid null references public.trainer_sessions(id) on delete set null,
  note_type text not null default 'progress' check (note_type in ('progress', 'recommendation', 'observation', 'injury', 'goal', 'private')),
  title text not null check (char_length(title) between 2 and 140),
  body text not null check (char_length(body) between 3 and 2000),
  visibility text not null default 'staff' check (visibility in ('trainer_only', 'staff', 'trainer_and_member')),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trainer_feedback (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  session_id uuid null references public.trainer_sessions(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  feedback text null check (feedback is null or char_length(feedback) <= 1000),
  is_public boolean not null default false,
  status text not null default 'submitted' check (status in ('submitted', 'reviewed', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  employee_code text not null,
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text null,
  phone text null check (phone is null or char_length(phone) between 8 and 20),
  staff_role text not null check (staff_role in ('manager', 'reception', 'support', 'admin')),
  status text not null default 'active' check (status in ('active', 'on_leave', 'suspended', 'archived')),
  employment_type text not null default 'full_time' check (employment_type in ('full_time', 'part_time', 'contract')),
  joined_at date not null default current_date,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, employee_code)
);

create unique index if not exists staff_profiles_gym_user_idx
on public.staff_profiles (gym_id, user_id)
where user_id is not null;

create table if not exists public.staff_activity_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  staff_user_id uuid null references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 3 and 100),
  entity_type text not null check (char_length(entity_type) between 2 and 80),
  entity_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trainer_notification_events (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  trainer_id uuid null references public.trainers(id) on delete cascade,
  member_id uuid null references public.members(id) on delete cascade,
  session_id uuid null references public.trainer_sessions(id) on delete cascade,
  member_pt_package_id uuid null references public.member_pt_packages(id) on delete cascade,
  event_type text not null check (event_type in ('session_scheduled', 'session_reminder', 'session_cancelled', 'trainer_assignment', 'package_expiry', 'workout_assigned')),
  channel text not null default 'system' check (channel in ('system', 'email', 'whatsapp', 'sms', 'push')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'cancelled')),
  scheduled_for timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists trainers_gym_status_idx on public.trainers (gym_id, status, display_name);
create index if not exists trainer_specializations_trainer_idx on public.trainer_specializations (trainer_id);
create index if not exists trainer_certifications_expiry_idx on public.trainer_certifications (trainer_id, expiry_date, status);
create index if not exists trainer_availability_trainer_day_idx on public.trainer_availability (trainer_id, day_of_week, is_active);
create index if not exists trainer_time_off_trainer_status_idx on public.trainer_time_off (trainer_id, status, starts_at);
create index if not exists trainer_assignments_trainer_status_idx on public.trainer_assignments (trainer_id, status, assigned_at desc);
create index if not exists trainer_assignments_member_status_idx on public.trainer_assignments (member_id, status, assigned_at desc);
create index if not exists personal_training_packages_gym_status_idx on public.personal_training_packages (gym_id, status, display_order);
create index if not exists member_pt_packages_member_status_idx on public.member_pt_packages (member_id, status, expires_on);
create index if not exists member_pt_packages_trainer_status_idx on public.member_pt_packages (trainer_id, status, expires_on);
create index if not exists workout_programs_trainer_status_idx on public.workout_programs (trainer_id, status, created_at desc);
create index if not exists workout_programs_member_status_idx on public.workout_programs (member_id, status, created_at desc);
create index if not exists workout_program_exercises_program_idx on public.workout_program_exercises (program_id, day_number, display_order);
create index if not exists workout_program_assignments_member_status_idx on public.workout_program_assignments (member_id, status, starts_on desc);
create index if not exists trainer_sessions_trainer_date_idx on public.trainer_sessions (trainer_id, session_date, starts_at);
create index if not exists trainer_sessions_member_date_idx on public.trainer_sessions (member_id, session_date desc);
create index if not exists trainer_sessions_status_idx on public.trainer_sessions (gym_id, status, session_date);
create index if not exists trainer_session_logs_session_idx on public.trainer_session_logs (session_id, created_at desc);
create index if not exists trainer_notes_member_created_idx on public.trainer_notes (member_id, created_at desc);
create index if not exists trainer_notes_trainer_created_idx on public.trainer_notes (trainer_id, created_at desc);
create index if not exists trainer_feedback_trainer_created_idx on public.trainer_feedback (trainer_id, created_at desc);
create index if not exists staff_profiles_gym_status_idx on public.staff_profiles (gym_id, status, staff_role);
create index if not exists staff_activity_logs_gym_created_idx on public.staff_activity_logs (gym_id, created_at desc);
create index if not exists trainer_notification_events_due_idx on public.trainer_notification_events (event_type, status, scheduled_for);

drop trigger if exists set_trainers_updated_at on public.trainers;
create trigger set_trainers_updated_at before update on public.trainers for each row execute function public.set_updated_at();
drop trigger if exists set_trainer_profiles_updated_at on public.trainer_profiles;
create trigger set_trainer_profiles_updated_at before update on public.trainer_profiles for each row execute function public.set_updated_at();
drop trigger if exists set_trainer_certifications_updated_at on public.trainer_certifications;
create trigger set_trainer_certifications_updated_at before update on public.trainer_certifications for each row execute function public.set_updated_at();
drop trigger if exists set_trainer_availability_updated_at on public.trainer_availability;
create trigger set_trainer_availability_updated_at before update on public.trainer_availability for each row execute function public.set_updated_at();
drop trigger if exists set_trainer_time_off_updated_at on public.trainer_time_off;
create trigger set_trainer_time_off_updated_at before update on public.trainer_time_off for each row execute function public.set_updated_at();
drop trigger if exists set_trainer_assignments_updated_at on public.trainer_assignments;
create trigger set_trainer_assignments_updated_at before update on public.trainer_assignments for each row execute function public.set_updated_at();
drop trigger if exists set_personal_training_packages_updated_at on public.personal_training_packages;
create trigger set_personal_training_packages_updated_at before update on public.personal_training_packages for each row execute function public.set_updated_at();
drop trigger if exists set_member_pt_packages_updated_at on public.member_pt_packages;
create trigger set_member_pt_packages_updated_at before update on public.member_pt_packages for each row execute function public.set_updated_at();
drop trigger if exists set_workout_programs_updated_at on public.workout_programs;
create trigger set_workout_programs_updated_at before update on public.workout_programs for each row execute function public.set_updated_at();
drop trigger if exists set_workout_program_assignments_updated_at on public.workout_program_assignments;
create trigger set_workout_program_assignments_updated_at before update on public.workout_program_assignments for each row execute function public.set_updated_at();
drop trigger if exists set_trainer_sessions_updated_at on public.trainer_sessions;
create trigger set_trainer_sessions_updated_at before update on public.trainer_sessions for each row execute function public.set_updated_at();
drop trigger if exists set_trainer_notes_updated_at on public.trainer_notes;
create trigger set_trainer_notes_updated_at before update on public.trainer_notes for each row execute function public.set_updated_at();
drop trigger if exists set_trainer_feedback_updated_at on public.trainer_feedback;
create trigger set_trainer_feedback_updated_at before update on public.trainer_feedback for each row execute function public.set_updated_at();
drop trigger if exists set_staff_profiles_updated_at on public.staff_profiles;
create trigger set_staff_profiles_updated_at before update on public.staff_profiles for each row execute function public.set_updated_at();

create or replace function public.generate_trainer_code(target_gym_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  select coalesce(count(*), 0) + 1 into next_number
  from public.trainers
  where gym_id is not distinct from target_gym_id;

  return 'TRN-' || lpad(next_number::text, 4, '0');
end;
$$;

create or replace function public.generate_staff_code(target_gym_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  select coalesce(count(*), 0) + 1 into next_number
  from public.staff_profiles
  where gym_id is not distinct from target_gym_id;

  return 'STF-' || lpad(next_number::text, 4, '0');
end;
$$;

create or replace function public.current_trainer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id
  from public.trainers t
  where t.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.is_trainer_for_member(target_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trainer_assignments ta
    join public.trainers t on t.id = ta.trainer_id
    where ta.member_id = target_member_id
      and ta.status = 'active'
      and t.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.members m
    where m.id = target_member_id
      and m.assigned_trainer_id = (select auth.uid())
  );
$$;

create or replace view public.trainer_performance_summary
with (security_invoker = true)
as
select
  t.gym_id,
  t.id as trainer_id,
  t.display_name,
  count(distinct ta.member_id) filter (where ta.status = 'active') as assigned_members,
  count(ts.id) filter (where ts.status = 'scheduled' and ts.session_date >= current_date) as upcoming_sessions,
  count(ts.id) filter (where ts.status = 'completed') as completed_sessions,
  count(ts.id) filter (where ts.status = 'missed') as missed_sessions,
  coalesce(sum(mpp.price_amount) filter (where mpp.status in ('active', 'completed')), 0) as pt_revenue,
  coalesce(avg(tf.rating), 0)::numeric(3,2) as average_rating,
  count(tf.id) as rating_count
from public.trainers t
left join public.trainer_assignments ta on ta.trainer_id = t.id
left join public.trainer_sessions ts on ts.trainer_id = t.id
left join public.member_pt_packages mpp on mpp.trainer_id = t.id
left join public.trainer_feedback tf on tf.trainer_id = t.id and tf.status <> 'hidden'
group by t.gym_id, t.id, t.display_name;

create or replace view public.trainer_daily_session_summary
with (security_invoker = true)
as
select
  gym_id,
  trainer_id,
  session_date,
  count(*) as session_count,
  count(*) filter (where status = 'completed') as completed_count,
  count(*) filter (where status = 'cancelled') as cancelled_count
from public.trainer_sessions
group by gym_id, trainer_id, session_date;

alter table public.trainers enable row level security;
alter table public.trainer_profiles enable row level security;
alter table public.trainer_specializations enable row level security;
alter table public.trainer_certifications enable row level security;
alter table public.trainer_availability enable row level security;
alter table public.trainer_time_off enable row level security;
alter table public.trainer_assignments enable row level security;
alter table public.personal_training_packages enable row level security;
alter table public.member_pt_packages enable row level security;
alter table public.workout_programs enable row level security;
alter table public.workout_program_exercises enable row level security;
alter table public.workout_program_assignments enable row level security;
alter table public.trainer_sessions enable row level security;
alter table public.trainer_session_logs enable row level security;
alter table public.trainer_notes enable row level security;
alter table public.trainer_feedback enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.staff_activity_logs enable row level security;
alter table public.trainer_notification_events enable row level security;

grant select, insert, update on public.trainers to authenticated;
grant select, insert, update on public.trainer_profiles to authenticated;
grant select, insert, update, delete on public.trainer_specializations to authenticated;
grant select, insert, update, delete on public.trainer_certifications to authenticated;
grant select, insert, update, delete on public.trainer_availability to authenticated;
grant select, insert, update on public.trainer_time_off to authenticated;
grant select, insert, update on public.trainer_assignments to authenticated;
grant select, insert, update on public.personal_training_packages to authenticated;
grant select, insert, update on public.member_pt_packages to authenticated;
grant select, insert, update on public.workout_programs to authenticated;
grant select, insert, update, delete on public.workout_program_exercises to authenticated;
grant select, insert, update on public.workout_program_assignments to authenticated;
grant select, insert, update on public.trainer_sessions to authenticated;
grant select, insert on public.trainer_session_logs to authenticated;
grant select, insert, update on public.trainer_notes to authenticated;
grant select, insert, update on public.trainer_feedback to authenticated;
grant select, insert, update on public.staff_profiles to authenticated;
grant select, insert on public.staff_activity_logs to authenticated;
grant select, insert, update on public.trainer_notification_events to authenticated;
grant select on public.trainer_performance_summary to authenticated;
grant select on public.trainer_daily_session_summary to authenticated;

drop policy if exists "trainers visible in operational scope" on public.trainers;
create policy "trainers visible in operational scope"
on public.trainers for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff', 'trainer', 'member'])
  )
);

drop policy if exists "staff can create trainers" on public.trainers;
create policy "staff can create trainers"
on public.trainers for insert to authenticated
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
);

drop policy if exists "staff or own trainer can update trainers" on public.trainers;
create policy "staff or own trainer can update trainers"
on public.trainers for update to authenticated
using (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
)
with check (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
);

drop policy if exists "trainer profile details visible in scope" on public.trainer_profiles;
create policy "trainer profile details visible in scope"
on public.trainer_profiles for select to authenticated
using (
  exists (
    select 1 from public.trainers t
    where t.id = trainer_profiles.trainer_id
      and (
        t.user_id = (select auth.uid())
        or public.is_super_admin()
        or (t.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff', 'trainer', 'member']))
      )
  )
);

drop policy if exists "staff or own trainer can manage trainer profile details" on public.trainer_profiles;
create policy "staff or own trainer can manage trainer profile details"
on public.trainer_profiles for all to authenticated
using (
  exists (
    select 1 from public.trainers t
    where t.id = trainer_profiles.trainer_id
      and (
        t.user_id = (select auth.uid())
        or public.is_super_admin()
        or (t.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
      )
  )
)
with check (
  exists (
    select 1 from public.trainers t
    where t.id = trainer_profiles.trainer_id
      and (
        t.user_id = (select auth.uid())
        or public.is_super_admin()
        or (t.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
      )
  )
);

drop policy if exists "trainer dependent records visible in trainer scope" on public.trainer_specializations;
create policy "trainer dependent records visible in trainer scope"
on public.trainer_specializations for select to authenticated
using (exists (select 1 from public.trainers t where t.id = trainer_specializations.trainer_id and (t.user_id = (select auth.uid()) or public.is_super_admin() or (t.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff', 'trainer', 'member')))));

drop policy if exists "trainer dependent records manageable in trainer scope" on public.trainer_specializations;
create policy "trainer dependent records manageable in trainer scope"
on public.trainer_specializations for all to authenticated
using (exists (select 1 from public.trainers t where t.id = trainer_specializations.trainer_id and (t.user_id = (select auth.uid()) or public.is_super_admin() or (t.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))))
with check (exists (select 1 from public.trainers t where t.id = trainer_specializations.trainer_id and (t.user_id = (select auth.uid()) or public.is_super_admin() or (t.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))));

drop policy if exists "trainer certifications visible in scope" on public.trainer_certifications;
create policy "trainer certifications visible in scope"
on public.trainer_certifications for select to authenticated
using (exists (select 1 from public.trainers t where t.id = trainer_certifications.trainer_id and (t.user_id = (select auth.uid()) or public.is_super_admin() or (t.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff', 'trainer'])))));

drop policy if exists "trainer certifications manageable in scope" on public.trainer_certifications;
create policy "trainer certifications manageable in scope"
on public.trainer_certifications for all to authenticated
using (exists (select 1 from public.trainers t where t.id = trainer_certifications.trainer_id and (t.user_id = (select auth.uid()) or public.is_super_admin() or (t.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))))
with check (exists (select 1 from public.trainers t where t.id = trainer_certifications.trainer_id and (t.user_id = (select auth.uid()) or public.is_super_admin() or (t.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))));

drop policy if exists "trainer availability visible in scope" on public.trainer_availability;
create policy "trainer availability visible in scope"
on public.trainer_availability for select to authenticated
using (exists (select 1 from public.trainers t where t.id = trainer_availability.trainer_id and (t.user_id = (select auth.uid()) or public.is_super_admin() or (t.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff', 'trainer', 'member')))));

drop policy if exists "trainer availability manageable in scope" on public.trainer_availability;
create policy "trainer availability manageable in scope"
on public.trainer_availability for all to authenticated
using (exists (select 1 from public.trainers t where t.id = trainer_availability.trainer_id and (t.user_id = (select auth.uid()) or public.is_super_admin() or (t.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))))
with check (exists (select 1 from public.trainers t where t.id = trainer_availability.trainer_id and (t.user_id = (select auth.uid()) or public.is_super_admin() or (t.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))));

drop policy if exists "trainer time off visible in scope" on public.trainer_time_off;
create policy "trainer time off visible in scope"
on public.trainer_time_off for select to authenticated
using (exists (select 1 from public.trainers t where t.id = trainer_time_off.trainer_id and (t.user_id = (select auth.uid()) or public.is_super_admin() or (t.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))));

drop policy if exists "trainer time off manageable in scope" on public.trainer_time_off;
create policy "trainer time off manageable in scope"
on public.trainer_time_off for all to authenticated
using (exists (select 1 from public.trainers t where t.id = trainer_time_off.trainer_id and (t.user_id = (select auth.uid()) or public.is_super_admin() or (t.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))))
with check (exists (select 1 from public.trainers t where t.id = trainer_time_off.trainer_id and (t.user_id = (select auth.uid()) or public.is_super_admin() or (t.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))));

drop policy if exists "assignments visible to staff trainers and members" on public.trainer_assignments;
create policy "assignments visible to staff trainers and members"
on public.trainer_assignments for select to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or exists (select 1 from public.trainers t where t.id = trainer_assignments.trainer_id and t.user_id = (select auth.uid()))
  or exists (select 1 from public.members m where m.id = trainer_assignments.member_id and m.user_id = (select auth.uid()))
);

drop policy if exists "staff can manage trainer assignments" on public.trainer_assignments;
create policy "staff can manage trainer assignments"
on public.trainer_assignments for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "pt packages visible in scope" on public.personal_training_packages;
create policy "pt packages visible in scope"
on public.personal_training_packages for select to authenticated
using (
  public.is_super_admin()
  or gym_id is null
  or (gym_id = public.current_user_gym_id() and (status = 'active' or public.has_any_role(array['gym_admin', 'reception_staff'])))
);

drop policy if exists "staff can manage pt packages" on public.personal_training_packages;
create policy "staff can manage pt packages"
on public.personal_training_packages for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])));

drop policy if exists "member pt packages visible in scope" on public.member_pt_packages;
create policy "member pt packages visible in scope"
on public.member_pt_packages for select to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or public.is_trainer_for_member(member_id)
  or exists (select 1 from public.members m where m.id = member_pt_packages.member_id and m.user_id = (select auth.uid()))
);

drop policy if exists "staff can manage member pt packages" on public.member_pt_packages;
create policy "staff can manage member pt packages"
on public.member_pt_packages for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "workout programs visible in scope" on public.workout_programs;
create policy "workout programs visible in scope"
on public.workout_programs for select to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or exists (select 1 from public.trainers t where t.id = workout_programs.trainer_id and t.user_id = (select auth.uid()))
  or (member_id is not null and exists (select 1 from public.members m where m.id = workout_programs.member_id and m.user_id = (select auth.uid())))
  or (member_id is not null and public.is_trainer_for_member(member_id))
);

drop policy if exists "staff or trainer can manage workout programs" on public.workout_programs;
create policy "staff or trainer can manage workout programs"
on public.workout_programs for all to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or exists (select 1 from public.trainers t where t.id = workout_programs.trainer_id and t.user_id = (select auth.uid()))
)
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or exists (select 1 from public.trainers t where t.id = workout_programs.trainer_id and t.user_id = (select auth.uid()))
);

drop policy if exists "workout exercises visible with program" on public.workout_program_exercises;
create policy "workout exercises visible with program"
on public.workout_program_exercises for select to authenticated
using (exists (select 1 from public.workout_programs wp where wp.id = workout_program_exercises.program_id));

drop policy if exists "workout exercises manageable with program" on public.workout_program_exercises;
create policy "workout exercises manageable with program"
on public.workout_program_exercises for all to authenticated
using (
  exists (
    select 1 from public.workout_programs wp
    join public.trainers t on t.id = wp.trainer_id
    where wp.id = workout_program_exercises.program_id
      and (public.is_super_admin() or (wp.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])) or t.user_id = (select auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.workout_programs wp
    join public.trainers t on t.id = wp.trainer_id
    where wp.id = workout_program_exercises.program_id
      and (public.is_super_admin() or (wp.gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])) or t.user_id = (select auth.uid()))
  )
);

drop policy if exists "workout assignments visible in scope" on public.workout_program_assignments;
create policy "workout assignments visible in scope"
on public.workout_program_assignments for select to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or exists (select 1 from public.trainers t where t.id = workout_program_assignments.trainer_id and t.user_id = (select auth.uid()))
  or exists (select 1 from public.members m where m.id = workout_program_assignments.member_id and m.user_id = (select auth.uid()))
);

drop policy if exists "staff or trainer can manage workout assignments" on public.workout_program_assignments;
create policy "staff or trainer can manage workout assignments"
on public.workout_program_assignments for all to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or exists (select 1 from public.trainers t where t.id = workout_program_assignments.trainer_id and t.user_id = (select auth.uid()))
)
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or exists (select 1 from public.trainers t where t.id = workout_program_assignments.trainer_id and t.user_id = (select auth.uid()))
);

drop policy if exists "sessions visible in scope" on public.trainer_sessions;
create policy "sessions visible in scope"
on public.trainer_sessions for select to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or exists (select 1 from public.trainers t where t.id = trainer_sessions.trainer_id and t.user_id = (select auth.uid()))
  or exists (select 1 from public.members m where m.id = trainer_sessions.member_id and m.user_id = (select auth.uid()))
);

drop policy if exists "staff or trainer can manage sessions" on public.trainer_sessions;
create policy "staff or trainer can manage sessions"
on public.trainer_sessions for all to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or exists (select 1 from public.trainers t where t.id = trainer_sessions.trainer_id and t.user_id = (select auth.uid()))
)
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or exists (select 1 from public.trainers t where t.id = trainer_sessions.trainer_id and t.user_id = (select auth.uid()))
);

drop policy if exists "session logs visible in session scope" on public.trainer_session_logs;
create policy "session logs visible in session scope"
on public.trainer_session_logs for select to authenticated
using (exists (select 1 from public.trainer_sessions ts where ts.id = trainer_session_logs.session_id));

drop policy if exists "staff or trainer can insert session logs" on public.trainer_session_logs;
create policy "staff or trainer can insert session logs"
on public.trainer_session_logs for insert to authenticated
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or exists (select 1 from public.trainer_sessions ts join public.trainers t on t.id = ts.trainer_id where ts.id = trainer_session_logs.session_id and t.user_id = (select auth.uid()))
);

drop policy if exists "trainer notes visible by visibility" on public.trainer_notes;
create policy "trainer notes visible by visibility"
on public.trainer_notes for select to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or exists (select 1 from public.trainers t where t.id = trainer_notes.trainer_id and t.user_id = (select auth.uid()))
  or (visibility = 'trainer_and_member' and exists (select 1 from public.members m where m.id = trainer_notes.member_id and m.user_id = (select auth.uid())))
);

drop policy if exists "staff or trainer can manage trainer notes" on public.trainer_notes;
create policy "staff or trainer can manage trainer notes"
on public.trainer_notes for all to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or exists (select 1 from public.trainers t where t.id = trainer_notes.trainer_id and t.user_id = (select auth.uid()))
)
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or exists (select 1 from public.trainers t where t.id = trainer_notes.trainer_id and t.user_id = (select auth.uid()))
);

drop policy if exists "trainer feedback visible in scope" on public.trainer_feedback;
create policy "trainer feedback visible in scope"
on public.trainer_feedback for select to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or exists (select 1 from public.trainers t where t.id = trainer_feedback.trainer_id and t.user_id = (select auth.uid()))
  or exists (select 1 from public.members m where m.id = trainer_feedback.member_id and m.user_id = (select auth.uid()))
);

drop policy if exists "members can submit trainer feedback" on public.trainer_feedback;
create policy "members can submit trainer feedback"
on public.trainer_feedback for insert to authenticated
with check (
  exists (select 1 from public.members m where m.id = trainer_feedback.member_id and m.user_id = (select auth.uid()))
);

drop policy if exists "staff can moderate trainer feedback" on public.trainer_feedback;
create policy "staff can moderate trainer feedback"
on public.trainer_feedback for update to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "staff profiles visible to admin staff" on public.staff_profiles;
create policy "staff profiles visible to admin staff"
on public.staff_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "admins can manage staff profiles" on public.staff_profiles;
create policy "admins can manage staff profiles"
on public.staff_profiles for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])));

drop policy if exists "staff activity logs visible to admins" on public.staff_activity_logs;
create policy "staff activity logs visible to admins"
on public.staff_activity_logs for select to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])));

drop policy if exists "staff can insert activity logs" on public.staff_activity_logs;
create policy "staff can insert activity logs"
on public.staff_activity_logs for insert to authenticated
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff', 'trainer'])));

drop policy if exists "trainer notifications visible in scope" on public.trainer_notification_events;
create policy "trainer notifications visible in scope"
on public.trainer_notification_events for select to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or (trainer_id is not null and exists (select 1 from public.trainers t where t.id = trainer_notification_events.trainer_id and t.user_id = (select auth.uid())))
  or (member_id is not null and exists (select 1 from public.members m where m.id = trainer_notification_events.member_id and m.user_id = (select auth.uid())))
);

drop policy if exists "staff or trainer can create trainer notifications" on public.trainer_notification_events;
create policy "staff or trainer can create trainer notifications"
on public.trainer_notification_events for insert to authenticated
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
  or (trainer_id is not null and exists (select 1 from public.trainers t where t.id = trainer_notification_events.trainer_id and t.user_id = (select auth.uid())))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trainer-certificates',
  'trainer-certificates',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "staff can read trainer certificate files" on storage.objects;
create policy "staff can read trainer certificate files"
on storage.objects for select to authenticated
using (
  bucket_id = 'trainer-certificates'
  and (public.is_super_admin() or public.has_any_role(array['gym_admin', 'reception_staff', 'trainer']))
);

drop policy if exists "staff or trainers can upload trainer certificates" on storage.objects;
create policy "staff or trainers can upload trainer certificates"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'trainer-certificates'
  and (public.is_super_admin() or public.has_any_role(array['gym_admin', 'trainer']))
);
