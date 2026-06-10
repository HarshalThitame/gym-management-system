create extension if not exists pgcrypto;

create table if not exists public.access_devices (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  device_code text not null,
  name text not null check (char_length(name) between 2 and 120),
  device_type text not null check (device_type in ('reception', 'qr_scanner', 'turnstile', 'rfid_reader', 'biometric', 'face_recognition', 'kiosk', 'api')),
  location text null check (location is null or char_length(location) <= 160),
  status text not null default 'active' check (status in ('active', 'inactive', 'maintenance', 'retired')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, device_code)
);

create table if not exists public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  token_value text not null,
  token_hash text not null,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  purpose text not null default 'attendance' check (purpose in ('attendance', 'guest_trial', 'device_pairing')),
  expires_at timestamptz not null,
  last_used_at timestamptz null,
  regenerated_from_token_id uuid null references public.qr_tokens(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists qr_tokens_token_hash_idx on public.qr_tokens (token_hash);
create unique index if not exists qr_tokens_one_active_attendance_idx
on public.qr_tokens (member_id)
where status = 'active' and purpose = 'attendance';

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  membership_id uuid null references public.memberships(id) on delete set null,
  qr_token_id uuid null references public.qr_tokens(id) on delete set null,
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz null,
  duration_minutes integer null check (duration_minutes is null or duration_minutes >= 0),
  status text not null default 'inside' check (status in ('inside', 'checked_out', 'auto_closed', 'void')),
  check_in_source text not null default 'reception' check (check_in_source in ('reception', 'qr', 'member_app', 'device', 'system')),
  check_out_source text null check (check_out_source is null or check_out_source in ('reception', 'qr', 'member_app', 'device', 'system')),
  entry_device_id uuid null references public.access_devices(id) on delete set null,
  exit_device_id uuid null references public.access_devices(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  checked_out_by uuid null references auth.users(id) on delete set null,
  notes text null check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out_at is null or check_out_at >= check_in_at)
);

create unique index if not exists attendance_sessions_one_open_session_idx
on public.attendance_sessions (member_id)
where status = 'inside';

create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  attendance_session_id uuid null references public.attendance_sessions(id) on delete set null,
  member_id uuid not null references public.members(id) on delete cascade,
  membership_id uuid null references public.memberships(id) on delete set null,
  qr_token_id uuid null references public.qr_tokens(id) on delete set null,
  action text not null check (action in ('check_in', 'check_out', 'auto_check_out', 'access_denied', 'duplicate_attempt', 'qr_generated', 'qr_regenerated')),
  source text not null check (source in ('reception', 'qr', 'member_app', 'device', 'system')),
  result text not null default 'success' check (result in ('success', 'denied', 'warning', 'reversed')),
  reason_code text null check (reason_code is null or char_length(reason_code) <= 80),
  message text not null check (char_length(message) between 2 and 300),
  actor_id uuid null references auth.users(id) on delete set null,
  device_id uuid null references public.access_devices(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists public.entry_events (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  attendance_session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  event_time timestamptz not null default now(),
  entry_method text not null check (entry_method in ('manual', 'qr', 'rfid', 'biometric', 'face', 'turnstile', 'api')),
  device_id uuid null references public.access_devices(id) on delete set null,
  verification_result text not null default 'granted' check (verification_result in ('granted', 'denied', 'manual_override')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.exit_events (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  attendance_session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  event_time timestamptz not null default now(),
  exit_method text not null check (exit_method in ('manual', 'qr', 'rfid', 'biometric', 'face', 'turnstile', 'api', 'auto')),
  device_id uuid null references public.access_devices(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.access_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid null references public.members(id) on delete set null,
  membership_id uuid null references public.memberships(id) on delete set null,
  attendance_session_id uuid null references public.attendance_sessions(id) on delete set null,
  qr_token_id uuid null references public.qr_tokens(id) on delete set null,
  device_id uuid null references public.access_devices(id) on delete set null,
  direction text not null check (direction in ('entry', 'exit', 'validation')),
  source text not null check (source in ('reception', 'qr', 'member_app', 'device', 'system')),
  decision text not null check (decision in ('granted', 'denied', 'warning')),
  reason_code text not null check (char_length(reason_code) between 2 and 80),
  message text not null check (char_length(message) between 2 and 300),
  validation_snapshot jsonb not null default '{}'::jsonb,
  actor_id uuid null references auth.users(id) on delete set null,
  ip_address inet null,
  user_agent text null,
  occurred_at timestamptz not null default now()
);

create table if not exists public.attendance_alerts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid null references public.members(id) on delete set null,
  attendance_session_id uuid null references public.attendance_sessions(id) on delete set null,
  alert_type text not null check (alert_type in ('membership_invalid', 'membership_expired', 'membership_suspended', 'membership_frozen', 'duplicate_check_in', 'qr_invalid', 'qr_expired', 'inactive_7_days', 'inactive_15_days', 'inactive_30_days')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  message text not null check (char_length(message) between 3 and 300),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  resolved_by uuid null references auth.users(id) on delete set null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_metrics (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  metric_date date not null,
  total_check_ins integer not null default 0 check (total_check_ins >= 0),
  unique_members integer not null default 0 check (unique_members >= 0),
  total_duration_minutes integer not null default 0 check (total_duration_minutes >= 0),
  average_duration_minutes integer not null default 0 check (average_duration_minutes >= 0),
  peak_occupancy integer not null default 0 check (peak_occupancy >= 0),
  peak_hour integer null check (peak_hour is null or peak_hour between 0 and 23),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, metric_date)
);

create index if not exists access_devices_gym_status_idx on public.access_devices (gym_id, status, device_type);
create index if not exists qr_tokens_member_status_idx on public.qr_tokens (member_id, status, expires_at);
create index if not exists attendance_sessions_gym_status_idx on public.attendance_sessions (gym_id, status, check_in_at desc);
create index if not exists attendance_sessions_member_check_in_idx on public.attendance_sessions (member_id, check_in_at desc);
create index if not exists attendance_sessions_membership_idx on public.attendance_sessions (membership_id);
create index if not exists attendance_logs_member_occurred_idx on public.attendance_logs (member_id, occurred_at desc);
create index if not exists attendance_logs_gym_action_idx on public.attendance_logs (gym_id, action, occurred_at desc);
create index if not exists entry_events_gym_time_idx on public.entry_events (gym_id, event_time desc);
create index if not exists exit_events_gym_time_idx on public.exit_events (gym_id, event_time desc);
create index if not exists access_logs_gym_decision_idx on public.access_logs (gym_id, decision, occurred_at desc);
create index if not exists access_logs_member_occurred_idx on public.access_logs (member_id, occurred_at desc);
create index if not exists attendance_alerts_gym_status_idx on public.attendance_alerts (gym_id, status, severity, created_at desc);
create index if not exists attendance_metrics_gym_date_idx on public.attendance_metrics (gym_id, metric_date desc);

drop trigger if exists set_access_devices_updated_at on public.access_devices;
create trigger set_access_devices_updated_at before update on public.access_devices for each row execute function public.set_updated_at();
drop trigger if exists set_qr_tokens_updated_at on public.qr_tokens;
create trigger set_qr_tokens_updated_at before update on public.qr_tokens for each row execute function public.set_updated_at();
drop trigger if exists set_attendance_sessions_updated_at on public.attendance_sessions;
create trigger set_attendance_sessions_updated_at before update on public.attendance_sessions for each row execute function public.set_updated_at();
drop trigger if exists set_attendance_alerts_updated_at on public.attendance_alerts;
create trigger set_attendance_alerts_updated_at before update on public.attendance_alerts for each row execute function public.set_updated_at();
drop trigger if exists set_attendance_metrics_updated_at on public.attendance_metrics;
create trigger set_attendance_metrics_updated_at before update on public.attendance_metrics for each row execute function public.set_updated_at();

create or replace view public.attendance_daily_summary
with (security_invoker = true)
as
select
  gym_id,
  check_in_at::date as attendance_date,
  count(*) as total_check_ins,
  count(distinct member_id) as unique_members,
  count(*) filter (where status = 'inside') as currently_inside,
  coalesce(avg(duration_minutes) filter (where duration_minutes is not null), 0)::integer as average_duration_minutes
from public.attendance_sessions
group by gym_id, check_in_at::date;

create or replace view public.attendance_hourly_traffic
with (security_invoker = true)
as
select
  gym_id,
  check_in_at::date as attendance_date,
  extract(hour from check_in_at)::integer as hour_of_day,
  count(*) as check_in_count
from public.attendance_sessions
group by gym_id, check_in_at::date, extract(hour from check_in_at)::integer;

create or replace view public.attendance_member_frequency
with (security_invoker = true)
as
select
  members.gym_id,
  members.id as member_id,
  members.full_name,
  members.member_code,
  count(attendance_sessions.id) as visit_count,
  max(attendance_sessions.check_in_at) as last_visit_at,
  coalesce(avg(attendance_sessions.duration_minutes) filter (where attendance_sessions.duration_minutes is not null), 0)::integer as average_duration_minutes
from public.members
left join public.attendance_sessions on attendance_sessions.member_id = members.id
group by members.gym_id, members.id, members.full_name, members.member_code;

alter table public.access_devices enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.entry_events enable row level security;
alter table public.exit_events enable row level security;
alter table public.access_logs enable row level security;
alter table public.attendance_alerts enable row level security;
alter table public.attendance_metrics enable row level security;

grant select, insert, update on public.access_devices to authenticated;
grant select, insert, update on public.qr_tokens to authenticated;
grant select, insert, update on public.attendance_sessions to authenticated;
grant select, insert on public.attendance_logs to authenticated;
grant select, insert on public.entry_events to authenticated;
grant select, insert on public.exit_events to authenticated;
grant select, insert on public.access_logs to authenticated;
grant select, insert, update on public.attendance_alerts to authenticated;
grant select, insert, update on public.attendance_metrics to authenticated;
grant select on public.attendance_daily_summary to authenticated;
grant select on public.attendance_hourly_traffic to authenticated;
grant select on public.attendance_member_frequency to authenticated;

drop policy if exists "access devices visible to staff" on public.access_devices;
create policy "access devices visible to staff"
on public.access_devices for select to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "admins can manage access devices" on public.access_devices;
create policy "admins can manage access devices"
on public.access_devices for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_role('gym_admin')))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_role('gym_admin')));

drop policy if exists "qr tokens visible to owner or staff" on public.qr_tokens;
create policy "qr tokens visible to owner or staff"
on public.qr_tokens for select to authenticated
using (
  exists (select 1 from public.members where members.id = qr_tokens.member_id and members.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "qr tokens manageable by owner or staff" on public.qr_tokens;
create policy "qr tokens manageable by owner or staff"
on public.qr_tokens for all to authenticated
using (
  exists (select 1 from public.members where members.id = qr_tokens.member_id and members.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
)
with check (
  exists (select 1 from public.members where members.id = qr_tokens.member_id and members.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "attendance sessions visible in scope" on public.attendance_sessions;
create policy "attendance sessions visible in scope"
on public.attendance_sessions for select to authenticated
using (
  exists (select 1 from public.members where members.id = attendance_sessions.member_id and members.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can manage attendance sessions" on public.attendance_sessions;
create policy "staff can manage attendance sessions"
on public.attendance_sessions for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "attendance logs visible in scope" on public.attendance_logs;
create policy "attendance logs visible in scope"
on public.attendance_logs for select to authenticated
using (
  exists (select 1 from public.members where members.id = attendance_logs.member_id and members.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can insert attendance logs" on public.attendance_logs;
create policy "staff can insert attendance logs"
on public.attendance_logs for insert to authenticated
with check (
  exists (select 1 from public.members where members.id = attendance_logs.member_id and members.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "entry events visible in attendance scope" on public.entry_events;
create policy "entry events visible in attendance scope"
on public.entry_events for select to authenticated
using (exists (select 1 from public.attendance_sessions where attendance_sessions.id = entry_events.attendance_session_id));

drop policy if exists "staff can insert entry events" on public.entry_events;
create policy "staff can insert entry events"
on public.entry_events for insert to authenticated
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "exit events visible in attendance scope" on public.exit_events;
create policy "exit events visible in attendance scope"
on public.exit_events for select to authenticated
using (exists (select 1 from public.attendance_sessions where attendance_sessions.id = exit_events.attendance_session_id));

drop policy if exists "staff can insert exit events" on public.exit_events;
create policy "staff can insert exit events"
on public.exit_events for insert to authenticated
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "access logs visible in scope" on public.access_logs;
create policy "access logs visible in scope"
on public.access_logs for select to authenticated
using (
  member_id is not null and (
    exists (select 1 from public.members where members.id = access_logs.member_id and members.user_id = (select auth.uid()))
    or public.is_trainer_for_member(member_id)
  )
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can insert access logs" on public.access_logs;
create policy "staff can insert access logs"
on public.access_logs for insert to authenticated
with check (
  exists (select 1 from public.members where members.id = access_logs.member_id and members.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "attendance alerts visible to staff and trainers" on public.attendance_alerts;
create policy "attendance alerts visible to staff and trainers"
on public.attendance_alerts for select to authenticated
using (
  member_id is not null and public.is_trainer_for_member(member_id)
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can manage attendance alerts" on public.attendance_alerts;
create policy "staff can manage attendance alerts"
on public.attendance_alerts for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "attendance metrics visible to staff" on public.attendance_metrics;
create policy "attendance metrics visible to staff"
on public.attendance_metrics for select to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "staff can manage attendance metrics" on public.attendance_metrics;
create policy "staff can manage attendance metrics"
on public.attendance_metrics for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));
