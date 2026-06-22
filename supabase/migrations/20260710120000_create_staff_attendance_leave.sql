-- Phase 2.1: Staff Attendance & Leave Tracking
-- Tables: staff_attendance, staff_leave_requests
-- Feature key: staff_attendance_leave

create table if not exists public.staff_attendance (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  date date generated always as ((clock_in at time zone 'UTC')::date) stored,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_attendance_org_date_idx on public.staff_attendance (organization_id, date desc);
create index if not exists staff_attendance_staff_date_idx on public.staff_attendance (staff_id, date desc);
create index if not exists staff_attendance_org_staff_idx on public.staff_attendance (organization_id, staff_id);

create table if not exists public.staff_leave_requests (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  leave_type text not null check (leave_type in ('sick', 'casual', 'annual', 'other')),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approver_id uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_leave_requests_org_status_idx on public.staff_leave_requests (organization_id, status);
create index if not exists staff_leave_requests_staff_idx on public.staff_leave_requests (staff_id);

-- RLS
alter table if exists public.staff_attendance enable row level security;
alter table if exists public.staff_leave_requests enable row level security;

-- Policies: organization owners have full access
drop policy if exists "Organization owners can manage attendance" on public.staff_attendance;
create policy "Organization owners can manage attendance"
  on public.staff_attendance for all
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

drop policy if exists "Organization owners can manage leave requests" on public.staff_leave_requests;
create policy "Organization owners can manage leave requests"
  on public.staff_leave_requests for all
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

-- Staff can view their own attendance and leave
drop policy if exists "Staff can view own attendance" on public.staff_attendance;
create policy "Staff can view own attendance"
  on public.staff_attendance for select
  to authenticated
  using (
    staff_id = auth.uid()
  );

drop policy if exists "Staff can view own leave requests" on public.staff_leave_requests;
create policy "Staff can view own leave requests"
  on public.staff_leave_requests for select
  to authenticated
  using (
    staff_id = auth.uid()
  );

-- Service role full access
drop policy if exists "Service role full access on attendance" on public.staff_attendance;
create policy "Service role full access on attendance"
  on public.staff_attendance for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role full access on leave requests" on public.staff_leave_requests;
create policy "Service role full access on leave requests"
  on public.staff_leave_requests for all
  to service_role
  using (true)
  with check (true);

-- Triggers for updated_at
drop trigger if exists set_staff_attendance_updated_at on public.staff_attendance;
create trigger set_staff_attendance_updated_at before update on public.staff_attendance for each row execute function public.set_updated_at();

drop trigger if exists set_staff_leave_requests_updated_at on public.staff_leave_requests;
create trigger set_staff_leave_requests_updated_at before update on public.staff_leave_requests for each row execute function public.set_updated_at();

-- Grants
grant select, insert, update, delete on public.staff_attendance to authenticated;
grant select, insert, update on public.staff_leave_requests to authenticated;
