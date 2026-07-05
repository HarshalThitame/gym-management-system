create table if not exists public.attendance_location_events (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete set null,
  member_id uuid not null references public.members(id) on delete cascade,
  attendance_session_id uuid null references public.attendance_sessions(id) on delete set null,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  accuracy_m numeric(10, 2) null check (accuracy_m is null or accuracy_m >= 0),
  inside_geofence boolean not null default true,
  geofence_radius_m integer null check (geofence_radius_m is null or geofence_radius_m >= 0),
  source text not null default 'member_app' check (source in ('member_app', 'device', 'system')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists attendance_location_events_gym_member_idx
on public.attendance_location_events (gym_id, member_id, occurred_at desc);

create index if not exists attendance_location_events_branch_time_idx
on public.attendance_location_events (branch_id, occurred_at desc);
