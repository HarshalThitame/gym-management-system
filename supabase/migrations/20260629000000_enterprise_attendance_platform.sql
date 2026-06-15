-- Enterprise Attendance Hardware Integration Platform

-- ════════════════════════════════════════════════════════════════════════
-- 1. Device types catalog (extensible — add rows, not columns)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.device_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  manufacturer text,
  model text,
  capabilities jsonb default '[]'::jsonb,
  connection_type text check (connection_type in ('usb', 'bluetooth', 'wifi', 'ethernet', 'api', 'cloud')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.device_types is 'Extensible device type catalog. Add new device types by inserting rows, not schema changes.';

insert into public.device_types (code, name, description, connection_type) values
  ('QR_SCANNER', 'QR Scanner', 'Static QR code scanner for member check-in', 'usb'),
  ('DYNAMIC_QR', 'Dynamic QR Generator', 'Time-based dynamic QR code display', 'wifi'),
  ('RFID_READER', 'RFID Reader', 'Radio-frequency identification card reader', 'usb'),
  ('NFC_READER', 'NFC Reader', 'Near-field communication tap reader', 'usb'),
  ('BIOMETRIC_DEVICE', 'Biometric Fingerprint Scanner', 'Fingerprint recognition device', 'usb'),
  ('FACE_RECOGNITION', 'Face Recognition Camera', 'AI-powered facial recognition camera', 'wifi'),
  ('GEOFENCE_DEVICE', 'Geo-Fence System', 'GPS/location-based attendance zone', 'cloud')
on conflict (code) do nothing;

alter table public.device_types enable row level security;
drop policy if exists "device types readable" on public.device_types;
create policy "device types readable"
  on public.device_types for select to authenticated
  using (true);

-- ════════════════════════════════════════════════════════════════════════
-- 2. Hardware devices (registered per branch)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.attendance_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  gym_id uuid references public.gyms(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  device_type_id uuid not null references public.device_types(id) on delete restrict,
  device_name text not null,
  serial_number text,
  mac_address text,
  ip_address text,
  firmware_version text,
  api_key text,
  status text not null default 'inactive' check (status in ('active', 'inactive', 'error', 'offline', 'maintenance')),
  last_seen_at timestamptz,
  location text,
  metadata jsonb default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, device_name)
);

comment on table public.attendance_devices is 'Registered hardware devices per organization branch.';

create index if not exists attendance_devices_org_idx on public.attendance_devices (organization_id);
create index if not exists attendance_devices_branch_idx on public.attendance_devices (branch_id);
create index if not exists attendance_devices_type_idx on public.attendance_devices (device_type_id);
create index if not exists attendance_devices_status_idx on public.attendance_devices (status);

alter table public.attendance_devices enable row level security;
drop policy if exists "devices super admin" on public.attendance_devices;
create policy "devices super admin"
  on public.attendance_devices for select to authenticated
  using (public.is_super_admin());
drop policy if exists "devices org owner" on public.attendance_devices;
create policy "devices org owner"
  on public.attendance_devices for select to authenticated
  using (public.is_organization_owner(organization_id));
drop policy if exists "devices org owner insert" on public.attendance_devices;
create policy "devices org owner insert"
  on public.attendance_devices for insert to authenticated
  with check (public.is_organization_owner(organization_id));
drop policy if exists "devices org owner update" on public.attendance_devices;
create policy "devices org owner update"
  on public.attendance_devices for update to authenticated
  using (public.is_organization_owner(organization_id))
  with check (public.is_organization_owner(organization_id));

-- ════════════════════════════════════════════════════════════════════════
-- 3. Device health monitoring
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.device_health_logs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.attendance_devices(id) on delete cascade,
  status text not null check (status in ('online', 'offline', 'error', 'degraded')),
  battery_level numeric(5,2),
  signal_strength int,
  error_message text,
  firmware_version text,
  checked_at timestamptz not null default now()
);

create index if not exists device_health_device_idx on public.device_health_logs (device_id, checked_at desc);
create index if not exists device_health_status_idx on public.device_health_logs (status);

alter table public.device_health_logs enable row level security;
drop policy if exists "device health super admin" on public.device_health_logs;
create policy "device health super admin"
  on public.device_health_logs for select to authenticated
  using (public.is_super_admin());
drop policy if exists "device health org owner" on public.device_health_logs;
create policy "device health org owner"
  on public.device_health_logs for select to authenticated
  using (
    exists (select 1 from public.attendance_devices ad where ad.id = device_id and public.is_organization_owner(ad.organization_id))
  );

-- ════════════════════════════════════════════════════════════════════════
-- 4. Attendance events unified log
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  device_id uuid references public.attendance_devices(id) on delete set null,
  member_id uuid references public.members(id) on delete cascade,
  event_type text not null check (event_type in ('check_in', 'check_out', 'manual', 'qr', 'dynamic_qr', 'rfid', 'nfc', 'biometric', 'face', 'geofence', 'api')),
  verified boolean not null default false,
  verification_method text,
  confidence_score numeric(5,2),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.attendance_events is 'Unified attendance event log for all device types.';

create index if not exists attendance_events_org_idx on public.attendance_events (organization_id, created_at desc);
create index if not exists attendance_events_member_idx on public.attendance_events (member_id);
create index if not exists attendance_events_device_idx on public.attendance_events (device_id);
create index if not exists attendance_events_type_idx on public.attendance_events (event_type);
create index if not exists attendance_events_date_idx on public.attendance_events (created_at);

alter table public.attendance_events enable row level security;
drop policy if exists "attendance events super admin" on public.attendance_events;
create policy "attendance events super admin"
  on public.attendance_events for select to authenticated
  using (public.is_super_admin());
drop policy if exists "attendance events org owner" on public.attendance_events;
create policy "attendance events org owner"
  on public.attendance_events for select to authenticated
  using (public.is_organization_owner(organization_id));
drop policy if exists "attendance events insert" on public.attendance_events;
create policy "attendance events insert"
  on public.attendance_events for insert to authenticated
  with check (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════
-- 5. Device sync queue (offline support)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.attendance_sync_queue (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.attendance_devices(id) on delete cascade,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'synced', 'failed')),
  attempts int not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  synced_at timestamptz
);

create index if not exists sync_queue_device_idx on public.attendance_sync_queue (device_id);
create index if not exists sync_queue_status_idx on public.attendance_sync_queue (status);

alter table public.attendance_sync_queue enable row level security;
drop policy if exists "sync queue super admin" on public.attendance_sync_queue;
create policy "sync queue super admin"
  on public.attendance_sync_queue for select to authenticated
  using (public.is_super_admin());
