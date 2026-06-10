create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 140),
  slug text not null check (char_length(slug) between 2 and 160),
  category text not null check (category in ('chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'mobility')),
  primary_muscle_group text not null check (char_length(primary_muscle_group) between 2 and 100),
  secondary_muscle_groups text[] not null default '{}',
  equipment text not null default 'bodyweight' check (char_length(equipment) between 2 and 100),
  difficulty text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced', 'elite')),
  instructions text not null check (char_length(instructions) between 10 and 2500),
  image_url text null check (image_url is null or char_length(image_url) <= 500),
  video_url text null check (video_url is null or char_length(video_url) <= 500),
  is_system boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists exercises_gym_slug_idx on public.exercises (gym_id, slug);
create index if not exists exercises_category_difficulty_idx on public.exercises (category, difficulty, status);
create index if not exists exercises_gym_status_idx on public.exercises (gym_id, status, name);

alter table public.workout_program_exercises
add column if not exists exercise_id uuid null references public.exercises(id) on delete set null;

create index if not exists workout_program_exercises_exercise_idx on public.workout_program_exercises (exercise_id)
where exercise_id is not null;

create table if not exists public.fitness_goals (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  trainer_id uuid null references public.trainers(id) on delete set null,
  goal_type text not null check (goal_type in ('weight_loss', 'weight_gain', 'muscle_gain', 'fat_loss', 'strength_increase', 'endurance_improvement', 'general_fitness')),
  title text not null check (char_length(title) between 2 and 140),
  description text null check (description is null or char_length(description) <= 1200),
  target_value numeric(8,2) null,
  target_unit text null check (target_unit is null or char_length(target_unit) <= 40),
  start_value numeric(8,2) null,
  current_value numeric(8,2) null,
  starts_on date not null default current_date,
  target_date date null,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  completed_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_date is null or target_date >= starts_on)
);

create index if not exists fitness_goals_member_status_idx on public.fitness_goals (member_id, status, starts_on desc);
create index if not exists fitness_goals_trainer_status_idx on public.fitness_goals (trainer_id, status, starts_on desc);
create index if not exists fitness_goals_gym_status_idx on public.fitness_goals (gym_id, status, created_at desc);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  trainer_id uuid null references public.trainers(id) on delete set null,
  workout_program_id uuid null references public.workout_programs(id) on delete set null,
  workout_assignment_id uuid null references public.workout_program_assignments(id) on delete set null,
  fitness_goal_id uuid null references public.fitness_goals(id) on delete set null,
  session_date date not null default current_date,
  started_at timestamptz null,
  completed_at timestamptz null,
  duration_minutes integer null check (duration_minutes is null or duration_minutes between 1 and 480),
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'skipped', 'cancelled')),
  workout_title text not null check (char_length(workout_title) between 2 and 160),
  source text not null default 'manual' check (source in ('manual', 'assigned_program', 'trainer_logged', 'imported')),
  notes text null check (notes is null or char_length(notes) <= 1500),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

create index if not exists workout_sessions_member_date_idx on public.workout_sessions (member_id, session_date desc, status);
create index if not exists workout_sessions_trainer_date_idx on public.workout_sessions (trainer_id, session_date desc)
where trainer_id is not null;
create index if not exists workout_sessions_gym_date_idx on public.workout_sessions (gym_id, session_date desc);

create table if not exists public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  exercise_id uuid null references public.exercises(id) on delete set null,
  exercise_name text not null check (char_length(exercise_name) between 2 and 140),
  set_number integer not null default 1 check (set_number between 1 and 100),
  target_reps text null check (target_reps is null or char_length(target_reps) <= 60),
  reps_completed integer null check (reps_completed is null or reps_completed >= 0),
  weight_used numeric(8,2) null check (weight_used is null or weight_used >= 0),
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb', 'bodyweight')),
  duration_seconds integer null check (duration_seconds is null or duration_seconds >= 0),
  distance numeric(8,2) null check (distance is null or distance >= 0),
  distance_unit text null check (distance_unit is null or distance_unit in ('km', 'mile', 'meter')),
  perceived_effort integer null check (perceived_effort is null or perceived_effort between 1 and 10),
  notes text null check (notes is null or char_length(notes) <= 800),
  logged_at timestamptz not null default now()
);

create index if not exists exercise_logs_session_set_idx on public.exercise_logs (workout_session_id, set_number, logged_at);
create index if not exists exercise_logs_member_exercise_idx on public.exercise_logs (member_id, exercise_id, logged_at desc);
create index if not exists exercise_logs_gym_logged_idx on public.exercise_logs (gym_id, logged_at desc);

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  recorded_on date not null default current_date,
  weight_kg numeric(6,2) null check (weight_kg is null or weight_kg between 20 and 350),
  height_cm numeric(6,2) null check (height_cm is null or height_cm between 80 and 260),
  bmi numeric(5,2) generated always as (
    case when weight_kg is not null and height_cm is not null and height_cm > 0
      then round((weight_kg / ((height_cm / 100) * (height_cm / 100)))::numeric, 2)
      else null
    end
  ) stored,
  body_fat_percentage numeric(5,2) null check (body_fat_percentage is null or body_fat_percentage between 1 and 80),
  muscle_mass_kg numeric(6,2) null check (muscle_mass_kg is null or muscle_mass_kg between 1 and 200),
  chest_cm numeric(6,2) null check (chest_cm is null or chest_cm between 20 and 250),
  waist_cm numeric(6,2) null check (waist_cm is null or waist_cm between 20 and 250),
  hips_cm numeric(6,2) null check (hips_cm is null or hips_cm between 20 and 250),
  arms_cm numeric(6,2) null check (arms_cm is null or arms_cm between 10 and 120),
  thighs_cm numeric(6,2) null check (thighs_cm is null or thighs_cm between 10 and 150),
  custom_measurements jsonb not null default '{}'::jsonb,
  notes text null check (notes is null or char_length(notes) <= 1000),
  recorded_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists body_measurements_member_date_idx on public.body_measurements (member_id, recorded_on);
create index if not exists body_measurements_gym_date_idx on public.body_measurements (gym_id, recorded_on desc);

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  photo_date date not null default current_date,
  view_type text not null check (view_type in ('front', 'side', 'back')),
  storage_path text not null check (char_length(storage_path) between 5 and 500),
  image_url text null check (image_url is null or char_length(image_url) <= 500),
  visibility text not null default 'member_and_trainer' check (visibility in ('member_only', 'member_and_trainer', 'staff')),
  notes text null check (notes is null or char_length(notes) <= 800),
  uploaded_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists progress_photos_member_date_idx on public.progress_photos (member_id, photo_date desc, view_type);
create index if not exists progress_photos_gym_date_idx on public.progress_photos (gym_id, photo_date desc);

create table if not exists public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  trainer_id uuid null references public.trainers(id) on delete set null,
  name text not null check (char_length(name) between 2 and 140),
  plan_type text not null check (plan_type in ('weight_loss', 'muscle_gain', 'maintenance', 'custom')),
  description text null check (description is null or char_length(description) <= 1200),
  target_calories integer not null check (target_calories between 800 and 8000),
  target_protein_g numeric(7,2) not null default 0 check (target_protein_g >= 0),
  target_carbs_g numeric(7,2) not null default 0 check (target_carbs_g >= 0),
  target_fat_g numeric(7,2) not null default 0 check (target_fat_g >= 0),
  water_target_ml integer not null default 2500 check (water_target_ml between 0 and 12000),
  starts_on date not null default current_date,
  ends_on date null,
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'completed', 'archived')),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create index if not exists nutrition_plans_member_status_idx on public.nutrition_plans (member_id, status, starts_on desc);
create index if not exists nutrition_plans_trainer_status_idx on public.nutrition_plans (trainer_id, status, starts_on desc);
create index if not exists nutrition_plans_gym_status_idx on public.nutrition_plans (gym_id, status, created_at desc);

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  nutrition_plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  title text not null check (char_length(title) between 2 and 140),
  description text null check (description is null or char_length(description) <= 1000),
  calories integer not null default 0 check (calories >= 0),
  protein_g numeric(7,2) not null default 0 check (protein_g >= 0),
  carbs_g numeric(7,2) not null default 0 check (carbs_g >= 0),
  fat_g numeric(7,2) not null default 0 check (fat_g >= 0),
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meal_plans_plan_order_idx on public.meal_plans (nutrition_plan_id, meal_type, display_order);
create index if not exists meal_plans_member_idx on public.meal_plans (member_id, created_at desc);

create table if not exists public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  nutrition_plan_id uuid null references public.nutrition_plans(id) on delete set null,
  meal_plan_id uuid null references public.meal_plans(id) on delete set null,
  entry_date date not null default current_date,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name text not null check (char_length(food_name) between 2 and 160),
  calories integer not null default 0 check (calories >= 0),
  protein_g numeric(7,2) not null default 0 check (protein_g >= 0),
  carbs_g numeric(7,2) not null default 0 check (carbs_g >= 0),
  fat_g numeric(7,2) not null default 0 check (fat_g >= 0),
  water_ml integer not null default 0 check (water_ml >= 0),
  adherence_status text not null default 'logged' check (adherence_status in ('planned', 'logged', 'off_plan', 'skipped')),
  notes text null check (notes is null or char_length(notes) <= 800),
  logged_at timestamptz not null default now()
);

create index if not exists meal_entries_member_date_idx on public.meal_entries (member_id, entry_date desc, meal_type);
create index if not exists meal_entries_plan_date_idx on public.meal_entries (nutrition_plan_id, entry_date desc)
where nutrition_plan_id is not null;
create index if not exists meal_entries_gym_date_idx on public.meal_entries (gym_id, entry_date desc);

create table if not exists public.fitness_milestones (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  fitness_goal_id uuid null references public.fitness_goals(id) on delete set null,
  milestone_type text not null check (milestone_type in ('first_workout', 'workouts_completed', 'weight_change', 'attendance_count', 'goal_completed', 'streak', 'custom')),
  title text not null check (char_length(title) between 2 and 140),
  description text null check (description is null or char_length(description) <= 1000),
  metric_value numeric(10,2) null,
  badge_key text null check (badge_key is null or char_length(badge_key) <= 80),
  achieved_at timestamptz not null default now(),
  awarded_by uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists fitness_milestones_member_date_idx on public.fitness_milestones (member_id, achieved_at desc);
create index if not exists fitness_milestones_gym_type_idx on public.fitness_milestones (gym_id, milestone_type, achieved_at desc);

create table if not exists public.fitness_notification_events (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  trainer_id uuid null references public.trainers(id) on delete set null,
  event_type text not null check (event_type in ('goal_created', 'goal_completed', 'workout_logged', 'missed_workout', 'measurement_logged', 'progress_photo_added', 'nutrition_plan_assigned', 'meal_logged', 'milestone_earned')),
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'whatsapp', 'push')),
  status text not null default 'pending' check (status in ('pending', 'queued', 'sent', 'failed', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz null
);

create index if not exists fitness_notification_events_member_status_idx on public.fitness_notification_events (member_id, status, created_at desc);
create index if not exists fitness_notification_events_gym_status_idx on public.fitness_notification_events (gym_id, status, created_at desc);

drop trigger if exists set_exercises_updated_at on public.exercises;
create trigger set_exercises_updated_at before update on public.exercises for each row execute function public.set_updated_at();
drop trigger if exists set_fitness_goals_updated_at on public.fitness_goals;
create trigger set_fitness_goals_updated_at before update on public.fitness_goals for each row execute function public.set_updated_at();
drop trigger if exists set_workout_sessions_updated_at on public.workout_sessions;
create trigger set_workout_sessions_updated_at before update on public.workout_sessions for each row execute function public.set_updated_at();
drop trigger if exists set_body_measurements_updated_at on public.body_measurements;
create trigger set_body_measurements_updated_at before update on public.body_measurements for each row execute function public.set_updated_at();
drop trigger if exists set_nutrition_plans_updated_at on public.nutrition_plans;
create trigger set_nutrition_plans_updated_at before update on public.nutrition_plans for each row execute function public.set_updated_at();
drop trigger if exists set_meal_plans_updated_at on public.meal_plans;
create trigger set_meal_plans_updated_at before update on public.meal_plans for each row execute function public.set_updated_at();

create or replace view public.fitness_member_progress_summary
with (security_invoker = true) as
select
  m.gym_id,
  m.id as member_id,
  m.full_name,
  count(distinct ws.id) filter (where ws.status = 'completed') as completed_workouts,
  count(distinct ws.id) filter (where ws.session_date >= current_date - interval '30 days') as workouts_last_30_days,
  max(ws.session_date) as last_workout_date,
  count(distinct fg.id) filter (where fg.status = 'active') as active_goals,
  count(distinct fg.id) filter (where fg.status = 'completed') as completed_goals,
  max(bm.recorded_on) as last_measurement_date,
  max(me.entry_date) as last_meal_log_date,
  count(distinct fm.id) as milestone_count
from public.members m
left join public.workout_sessions ws on ws.member_id = m.id
left join public.fitness_goals fg on fg.member_id = m.id
left join public.body_measurements bm on bm.member_id = m.id
left join public.meal_entries me on me.member_id = m.id
left join public.fitness_milestones fm on fm.member_id = m.id
group by m.gym_id, m.id, m.full_name;

create or replace view public.fitness_weight_trends
with (security_invoker = true) as
select
  gym_id,
  member_id,
  recorded_on,
  weight_kg,
  body_fat_percentage,
  muscle_mass_kg,
  bmi
from public.body_measurements
where weight_kg is not null
order by recorded_on;

create or replace view public.nutrition_daily_summary
with (security_invoker = true) as
select
  gym_id,
  member_id,
  entry_date,
  sum(calories)::integer as calories,
  round(sum(protein_g)::numeric, 2) as protein_g,
  round(sum(carbs_g)::numeric, 2) as carbs_g,
  round(sum(fat_g)::numeric, 2) as fat_g,
  sum(water_ml)::integer as water_ml,
  count(*) as meal_count
from public.meal_entries
group by gym_id, member_id, entry_date;

create or replace view public.workout_adherence_summary
with (security_invoker = true) as
select
  gym_id,
  member_id,
  date_trunc('week', session_date)::date as week_start,
  count(*) as planned_workouts,
  count(*) filter (where status = 'completed') as completed_workouts,
  count(*) filter (where status = 'skipped') as skipped_workouts,
  round((count(*) filter (where status = 'completed')::numeric / nullif(count(*), 0)) * 100, 2) as adherence_rate
from public.workout_sessions
group by gym_id, member_id, date_trunc('week', session_date)::date;

alter table public.exercises enable row level security;
alter table public.fitness_goals enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.body_measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.nutrition_plans enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_entries enable row level security;
alter table public.fitness_milestones enable row level security;
alter table public.fitness_notification_events enable row level security;

grant select, insert, update on public.exercises to authenticated;
grant select, insert, update on public.fitness_goals to authenticated;
grant select, insert, update on public.workout_sessions to authenticated;
grant select, insert, update, delete on public.exercise_logs to authenticated;
grant select, insert, update on public.body_measurements to authenticated;
grant select, insert, update, delete on public.progress_photos to authenticated;
grant select, insert, update on public.nutrition_plans to authenticated;
grant select, insert, update, delete on public.meal_plans to authenticated;
grant select, insert, update, delete on public.meal_entries to authenticated;
grant select, insert on public.fitness_milestones to authenticated;
grant select, insert, update on public.fitness_notification_events to authenticated;
grant select on public.fitness_member_progress_summary, public.fitness_weight_trends, public.nutrition_daily_summary, public.workout_adherence_summary to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'progress-photos',
  'progress-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated can read progress photos" on storage.objects;
create policy "authenticated can read progress photos"
on storage.objects for select to authenticated
using (bucket_id = 'progress-photos');

drop policy if exists "authenticated can upload progress photos" on storage.objects;
create policy "authenticated can upload progress photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'progress-photos');

drop policy if exists "authenticated can update progress photos" on storage.objects;
create policy "authenticated can update progress photos"
on storage.objects for update to authenticated
using (bucket_id = 'progress-photos')
with check (bucket_id = 'progress-photos');

drop policy if exists "authenticated can delete progress photos" on storage.objects;
create policy "authenticated can delete progress photos"
on storage.objects for delete to authenticated
using (bucket_id = 'progress-photos');

drop policy if exists "exercises visible in gym or system" on public.exercises;
create policy "exercises visible in gym or system"
on public.exercises for select to authenticated
using (is_system or gym_id is null or public.is_super_admin() or gym_id = public.current_user_gym_id());

drop policy if exists "staff trainers can manage exercises" on public.exercises;
create policy "staff trainers can manage exercises"
on public.exercises for all to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff', 'trainer']))
)
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff', 'trainer']))
);

drop policy if exists "fitness goals visible in scope" on public.fitness_goals;
create policy "fitness goals visible in scope"
on public.fitness_goals for select to authenticated
using (
  exists (select 1 from public.members m where m.id = fitness_goals.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "fitness goals manageable in scope" on public.fitness_goals;
create policy "fitness goals manageable in scope"
on public.fitness_goals for all to authenticated
using (
  exists (select 1 from public.members m where m.id = fitness_goals.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
)
with check (
  exists (select 1 from public.members m where m.id = fitness_goals.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "workout sessions visible in scope" on public.workout_sessions;
create policy "workout sessions visible in scope"
on public.workout_sessions for select to authenticated
using (
  exists (select 1 from public.members m where m.id = workout_sessions.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "workout sessions manageable in scope" on public.workout_sessions;
create policy "workout sessions manageable in scope"
on public.workout_sessions for all to authenticated
using (
  exists (select 1 from public.members m where m.id = workout_sessions.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
)
with check (
  exists (select 1 from public.members m where m.id = workout_sessions.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "exercise logs visible with session" on public.exercise_logs;
create policy "exercise logs visible with session"
on public.exercise_logs for select to authenticated
using (exists (select 1 from public.workout_sessions ws where ws.id = exercise_logs.workout_session_id));

drop policy if exists "exercise logs manageable with session" on public.exercise_logs;
create policy "exercise logs manageable with session"
on public.exercise_logs for all to authenticated
using (exists (select 1 from public.workout_sessions ws where ws.id = exercise_logs.workout_session_id))
with check (exists (select 1 from public.workout_sessions ws where ws.id = exercise_logs.workout_session_id));

drop policy if exists "measurements visible in scope" on public.body_measurements;
create policy "measurements visible in scope"
on public.body_measurements for select to authenticated
using (
  exists (select 1 from public.members m where m.id = body_measurements.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "measurements manageable in scope" on public.body_measurements;
create policy "measurements manageable in scope"
on public.body_measurements for all to authenticated
using (
  exists (select 1 from public.members m where m.id = body_measurements.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
)
with check (
  exists (select 1 from public.members m where m.id = body_measurements.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "progress photos visible in scope" on public.progress_photos;
create policy "progress photos visible in scope"
on public.progress_photos for select to authenticated
using (
  exists (select 1 from public.members m where m.id = progress_photos.member_id and m.user_id = (select auth.uid()))
  or (visibility in ('member_and_trainer', 'staff') and public.is_trainer_for_member(member_id))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "progress photos manageable in scope" on public.progress_photos;
create policy "progress photos manageable in scope"
on public.progress_photos for all to authenticated
using (
  exists (select 1 from public.members m where m.id = progress_photos.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
)
with check (
  exists (select 1 from public.members m where m.id = progress_photos.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "nutrition plans visible in scope" on public.nutrition_plans;
create policy "nutrition plans visible in scope"
on public.nutrition_plans for select to authenticated
using (
  exists (select 1 from public.members m where m.id = nutrition_plans.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "nutrition plans manageable in scope" on public.nutrition_plans;
create policy "nutrition plans manageable in scope"
on public.nutrition_plans for all to authenticated
using (
  exists (select 1 from public.members m where m.id = nutrition_plans.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
)
with check (
  exists (select 1 from public.members m where m.id = nutrition_plans.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "meal plans visible with nutrition plan" on public.meal_plans;
create policy "meal plans visible with nutrition plan"
on public.meal_plans for select to authenticated
using (exists (select 1 from public.nutrition_plans np where np.id = meal_plans.nutrition_plan_id));

drop policy if exists "meal plans manageable with nutrition plan" on public.meal_plans;
create policy "meal plans manageable with nutrition plan"
on public.meal_plans for all to authenticated
using (exists (select 1 from public.nutrition_plans np where np.id = meal_plans.nutrition_plan_id))
with check (exists (select 1 from public.nutrition_plans np where np.id = meal_plans.nutrition_plan_id));

drop policy if exists "meal entries visible in scope" on public.meal_entries;
create policy "meal entries visible in scope"
on public.meal_entries for select to authenticated
using (
  exists (select 1 from public.members m where m.id = meal_entries.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "meal entries manageable in scope" on public.meal_entries;
create policy "meal entries manageable in scope"
on public.meal_entries for all to authenticated
using (
  exists (select 1 from public.members m where m.id = meal_entries.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
)
with check (
  exists (select 1 from public.members m where m.id = meal_entries.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "milestones visible in scope" on public.fitness_milestones;
create policy "milestones visible in scope"
on public.fitness_milestones for select to authenticated
using (
  exists (select 1 from public.members m where m.id = fitness_milestones.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "milestones insertable in scope" on public.fitness_milestones;
create policy "milestones insertable in scope"
on public.fitness_milestones for insert to authenticated
with check (
  exists (select 1 from public.members m where m.id = fitness_milestones.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "fitness notifications visible in scope" on public.fitness_notification_events;
create policy "fitness notifications visible in scope"
on public.fitness_notification_events for select to authenticated
using (
  exists (select 1 from public.members m where m.id = fitness_notification_events.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "fitness notifications insertable in scope" on public.fitness_notification_events;
create policy "fitness notifications insertable in scope"
on public.fitness_notification_events for insert to authenticated
with check (
  exists (select 1 from public.members m where m.id = fitness_notification_events.member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

with system_exercises (name, slug, category, primary_muscle_group, equipment, difficulty, instructions) as (
  values
    ('Barbell Back Squat', 'barbell-back-squat', 'legs', 'Quadriceps', 'barbell', 'intermediate', 'Set the bar across the upper back, brace the trunk, squat to controlled depth, and drive through the floor to stand.'),
    ('Dumbbell Bench Press', 'dumbbell-bench-press', 'chest', 'Chest', 'dumbbells', 'beginner', 'Press dumbbells from chest level while keeping shoulder blades controlled and feet planted.'),
    ('Lat Pulldown', 'lat-pulldown', 'back', 'Lats', 'cable machine', 'beginner', 'Pull the bar toward the upper chest with elbows driving down, then return with control.'),
    ('Romanian Deadlift', 'romanian-deadlift', 'legs', 'Hamstrings', 'barbell', 'intermediate', 'Hinge from the hips with a neutral spine, lower until hamstrings load, and extend hips to stand.'),
    ('Plank Hold', 'plank-hold', 'core', 'Core', 'bodyweight', 'beginner', 'Hold a straight line from shoulders to heels while keeping ribs down and glutes engaged.'),
    ('Assault Bike Intervals', 'assault-bike-intervals', 'cardio', 'Cardiovascular System', 'air bike', 'intermediate', 'Alternate hard efforts with recovery intervals while maintaining stable posture and full pedal range.'),
    ('Half-Kneeling Hip Flexor Stretch', 'half-kneeling-hip-flexor-stretch', 'mobility', 'Hip Flexors', 'bodyweight', 'beginner', 'Tuck the pelvis, shift forward gently, and breathe through the front of the hip without arching the back.'),
    ('Seated Dumbbell Shoulder Press', 'seated-dumbbell-shoulder-press', 'shoulders', 'Shoulders', 'dumbbells', 'intermediate', 'Press dumbbells overhead from shoulder height while keeping ribs stacked and wrists controlled.')
)
insert into public.exercises (gym_id, name, slug, category, primary_muscle_group, equipment, difficulty, instructions, is_system)
select null, name, slug, category, primary_muscle_group, equipment, difficulty, instructions, true
from system_exercises
where not exists (
  select 1
  from public.exercises existing
  where existing.gym_id is null
    and existing.slug = system_exercises.slug
);
