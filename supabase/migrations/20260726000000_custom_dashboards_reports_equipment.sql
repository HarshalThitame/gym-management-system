-- Phase 3.8: Custom Dashboards, Scheduled Reports, Equipment Inventory
-- Tables: dashboard_layouts, report_schedules, equipment, equipment_service_logs

-- ─── PART A: Dashboard Layouts ─────────────────────────────────────────────

create table if not exists public.dashboard_layouts (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'My Dashboard',
  is_default boolean default false,
  widgets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, name)
);

comment on table public.dashboard_layouts is 'Saved dashboard widget layouts per organization user.';
comment on column public.dashboard_layouts.widgets is 'Array of widget configs: [{ id, enabled, order, size, config }]';

create index if not exists dashboard_layouts_org_idx on public.dashboard_layouts (organization_id);

alter table public.dashboard_layouts enable row level security;

drop policy if exists "Organization owners manage dashboard layouts" on public.dashboard_layouts;
create policy "Organization owners manage dashboard layouts"
  on public.dashboard_layouts for all
  to authenticated
  using (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  );

drop trigger if exists set_dashboard_layouts_updated_at on public.dashboard_layouts;
create trigger set_dashboard_layouts_updated_at
  before update on public.dashboard_layouts
  for each row execute function public.set_updated_at();

-- ─── PART B: Report Schedules ──────────────────────────────────────────────

create table if not exists public.report_schedules (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  report_type text not null check (report_type in ('revenue_summary', 'member_report', 'attendance_report', 'class_report', 'trainer_performance', 'dashboard_summary')),
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  day_of_week integer check (day_of_week >= 1 and day_of_week <= 7),
  day_of_month integer check (day_of_month >= 1 and day_of_month <= 28),
  recipients text[] not null default '{}',
  is_active boolean default true,
  last_sent_at timestamptz,
  next_scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.report_schedules is 'Scheduled automated report delivery configurations.';
comment on column public.report_schedules.day_of_week is '1=Monday..7=Sunday, used when frequency = weekly';
comment on column public.report_schedules.day_of_month is '1-28, used when frequency = monthly';

create index if not exists report_schedules_org_idx on public.report_schedules (organization_id);
create index if not exists report_schedules_next_idx on public.report_schedules (next_scheduled_at) where is_active = true;

alter table public.report_schedules enable row level security;

drop policy if exists "Organization owners manage report schedules" on public.report_schedules;
create policy "Organization owners manage report schedules"
  on public.report_schedules for all
  to authenticated
  using (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  );

drop trigger if exists set_report_schedules_updated_at on public.report_schedules;
create trigger set_report_schedules_updated_at
  before update on public.report_schedules
  for each row execute function public.set_updated_at();

-- ─── PART C: Equipment Inventory ───────────────────────────────────────────

create table if not exists public.equipment (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  name text not null,
  equipment_type text not null check (equipment_type in ('cardio', 'strength', 'free_weight', 'machine', 'accessory', 'other')),
  serial_number text,
  brand text,
  model text,
  purchase_date date,
  purchase_price integer,
  warranty_expiry date,
  last_service_date date,
  next_service_date date,
  service_interval_days integer default 90,
  amc_provider text,
  amc_expiry date,
  status text not null default 'operational' check (status in ('operational', 'under_maintenance', 'out_of_order', 'retired')),
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.equipment is 'Gym equipment inventory with maintenance tracking.';

create index if not exists equipment_org_idx on public.equipment (organization_id);
create index if not exists equipment_branch_idx on public.equipment (branch_id);
create index if not exists equipment_status_idx on public.equipment (status);
create index if not exists equipment_next_service_idx on public.equipment (next_service_date);
create index if not exists equipment_warranty_idx on public.equipment (warranty_expiry);
create index if not exists equipment_amc_idx on public.equipment (amc_expiry);

alter table public.equipment enable row level security;

drop policy if exists "Organization owners manage equipment" on public.equipment;
create policy "Organization owners manage equipment"
  on public.equipment for all
  to authenticated
  using (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  );

drop trigger if exists set_equipment_updated_at on public.equipment;
create trigger set_equipment_updated_at
  before update on public.equipment
  for each row execute function public.set_updated_at();

-- ─── Equipment Service Logs ────────────────────────────────────────────────

create table if not exists public.equipment_service_logs (
  id uuid default gen_random_uuid() primary key,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  service_date date not null default current_date,
  service_type text not null check (service_type in ('routine', 'repair', 'amc', 'inspection')),
  description text,
  cost integer,
  service_provider text,
  technician_name text,
  next_service_date date,
  created_at timestamptz not null default now()
);

comment on table public.equipment_service_logs is 'Service and maintenance history for equipment.';

create index if not exists equipment_service_logs_eq_idx on public.equipment_service_logs (equipment_id);
create index if not exists equipment_service_logs_org_date_idx on public.equipment_service_logs (organization_id, service_date desc);

alter table public.equipment_service_logs enable row level security;

drop policy if exists "Organization owners manage equipment service logs" on public.equipment_service_logs;
create policy "Organization owners manage equipment service logs"
  on public.equipment_service_logs for all
  to authenticated
  using (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  );
