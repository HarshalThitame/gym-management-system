-- Enterprise Device Health Incidents
-- Durable incident workflow for device enrollment, heartbeat, quarantine, and recovery.

create table if not exists public.device_health_incidents (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.attendance_devices(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  incident_type text not null check (incident_type in (
    'pending_activation',
    'heartbeat_stale',
    'heartbeat_critical',
    'quarantined',
    'enrollment_expired',
    'claim_failed',
    'branch_mismatch',
    'ping_failure',
    'manual_action'
  )),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  title text not null,
  description text null,
  metadata jsonb not null default '{}'::jsonb,
  acknowledged_at timestamptz null,
  acknowledged_by uuid null,
  resolved_at timestamptz null,
  resolved_by uuid null,
  dismissed_at timestamptz null,
  dismissed_by uuid null,
  detected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists device_health_incidents_device_idx
  on public.device_health_incidents (device_id, status, detected_at desc);
create index if not exists device_health_incidents_gym_idx
  on public.device_health_incidents (gym_id, status, detected_at desc);
create index if not exists device_health_incidents_type_idx
  on public.device_health_incidents (incident_type, status, detected_at desc);

alter table public.device_health_incidents enable row level security;

drop policy if exists "device_health_incidents visible to staff" on public.device_health_incidents;
create policy "device_health_incidents visible to staff"
on public.device_health_incidents for select to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can manage device_health_incidents" on public.device_health_incidents;
create policy "staff can manage device_health_incidents"
on public.device_health_incidents for insert to authenticated
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can update device_health_incidents" on public.device_health_incidents;
create policy "staff can update device_health_incidents"
on public.device_health_incidents for update to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
)
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "service role full access device_health_incidents" on public.device_health_incidents;
create policy "service role full access device_health_incidents"
on public.device_health_incidents
for all
to service_role
using (true)
with check (true);

grant select, insert, update on public.device_health_incidents to authenticated;
