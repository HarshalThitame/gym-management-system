-- ============================================================================
-- Sprint 4: Device Integration — Event Logs + Member Device Mappings
-- ============================================================================

-- 1. Device event logs — health pings, check-ins, errors, config changes
create table if not exists public.device_event_logs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.attendance_devices(id) on delete cascade,
  gym_id uuid references public.gyms(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  event_type text not null check (event_type in ('ping', 'check_in', 'check_out', 'error', 'config_change', 'disconnected')),
  payload jsonb default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists device_event_logs_device_id_idx
  on public.device_event_logs (device_id, occurred_at desc);
create index if not exists device_event_logs_event_type_idx
  on public.device_event_logs (device_id, event_type, occurred_at desc);
create index if not exists device_event_logs_gym_idx
  on public.device_event_logs (gym_id, occurred_at desc);

-- 2. Member device mappings — maps member UUID to device-specific user IDs
create table if not exists public.member_device_mappings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  device_id uuid not null references public.attendance_devices(id) on delete cascade,
  device_user_id text not null,
  device_user_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, device_user_id),
  unique (member_id, device_id)
);

create index if not exists member_device_mappings_member_idx
  on public.member_device_mappings (member_id);
create index if not exists member_device_mappings_device_user_idx
  on public.member_device_mappings (device_id, device_user_id);

-- 3. Seed device types if empty
insert into public.device_types (code, name, description, manufacturer, connection_type, is_active)
select * from (values
  ('biometric_fingerprint', 'Fingerprint Scanner', 'Fingerprint-based attendance terminal', 'Generic', 'usb', true),
  ('biometric_face', 'Face Recognition', 'Facial recognition attendance camera', 'Generic', 'network', true),
  ('qr_scanner', 'QR Scanner', 'QR code scanner for member check-in', 'Generic', 'usb', true),
  ('manual_kiosk', 'Kiosk Terminal', 'Touch-screen kiosk for manual check-in', 'Generic', 'network', true),
  ('rfid_reader', 'RFID Card Reader', 'RFID/NFC card reader for member cards', 'Generic', 'usb', true)
) as v(code, name, description, manufacturer, connection_type, is_active)
where not exists (select 1 from public.device_types limit 1);

-- 4. Enable RLS
alter table public.device_event_logs enable row level security;
alter table public.member_device_mappings enable row level security;

-- 5. RLS policies — device_event_logs
drop policy if exists "device_event_logs visible to staff" on public.device_event_logs;
create policy "device_event_logs visible to staff"
on public.device_event_logs for select to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "system can insert device_event_logs" on public.device_event_logs;
create policy "system can insert device_event_logs"
on public.device_event_logs for insert to authenticated
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

-- Service role insert for device API (no auth context)
drop policy if exists "service role full access device_event_logs" on public.device_event_logs;
create policy "service role full access device_event_logs"
on public.device_event_logs
for all
to service_role
using (true)
with check (true);

-- 6. RLS policies — member_device_mappings
drop policy if exists "member_device_mappings visible to staff" on public.member_device_mappings;
create policy "member_device_mappings visible to staff"
on public.member_device_mappings for select to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can manage member_device_mappings" on public.member_device_mappings;
create policy "staff can manage member_device_mappings"
on public.member_device_mappings for insert to authenticated
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can update member_device_mappings" on public.member_device_mappings;
create policy "staff can update member_device_mappings"
on public.member_device_mappings for update to authenticated
using (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
)
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "service role full access member_device_mappings" on public.member_device_mappings;
create policy "service role full access member_device_mappings"
on public.member_device_mappings
for all
to service_role
using (true)
with check (true);

-- 7. Grants
grant select, insert on public.device_event_logs to authenticated;
grant select, insert, update, delete on public.member_device_mappings to authenticated;
