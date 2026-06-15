-- Attendance Audit Log
create table if not exists public.attendance_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  gym_id uuid references public.gyms(id) on delete set null,
  member_id uuid not null references public.members(id) on delete cascade,
  session_id uuid null,
  action text not null check (action in ('check_in', 'check_out', 'auto_check_out', 'manual_override', 'correction', 'qr_validation', 'qr_validation_failed')),
  performed_by uuid null references auth.users(id) on delete set null,
  method text null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_attendance_audit_log_member on public.attendance_audit_log(member_id, created_at desc);
create index if not exists idx_attendance_audit_log_gym on public.attendance_audit_log(gym_id, created_at desc);
create index if not exists idx_attendance_audit_log_action on public.attendance_audit_log(action, created_at desc);

alter table public.attendance_audit_log enable row level security;

create policy "super_admin view attendance audit"
  on public.attendance_audit_log for select to authenticated
  using (public.is_super_admin());

create policy "gym_admin view attendance audit"
  on public.attendance_audit_log for select to authenticated
  using (gym_id in (select id from public.gyms where organization_id in (select organization_id from public.branch_users where user_id = auth.uid() and role_name = 'gym_admin')));

-- Member Badges / Gamification
create table if not exists public.member_badges (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  badge_name text not null,
  badge_type text not null check (badge_type in ('streak', 'total', 'monthly', 'special')),
  earned_at timestamptz not null default now(),
  unique (member_id, badge_name)
);

create index if not exists idx_member_badges_member on public.member_badges(member_id);

alter table public.member_badges enable row level security;

create policy "members view own badges"
  on public.member_badges for select to authenticated
  using (member_id in (select id from public.members where user_id = auth.uid()));

create policy "staff view member badges"
  on public.member_badges for select to authenticated
  using (true);

-- QR Nonce Log (anti-replay)
create table if not exists public.qr_nonce_log (
  id uuid primary key default gen_random_uuid(),
  nonce text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_qr_nonce_log_nonce on public.qr_nonce_log(nonce);
create index if not exists idx_qr_nonce_log_expires on public.qr_nonce_log(expires_at);

alter table public.qr_nonce_log enable row level security;

create policy "service role manage qr nonce"
  on public.qr_nonce_log for all to service_role using (true) with check (true);

-- Add organization_id and branch_id to attendance_sessions if not present
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name = 'attendance_sessions' and column_name = 'organization_id') then
    alter table public.attendance_sessions add column organization_id uuid references public.organizations(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'attendance_sessions' and column_name = 'branch_id') then
    alter table public.attendance_sessions add column branch_id uuid references public.branches(id) on delete set null;
  end if;
end $$;

create index if not exists idx_attendance_sessions_org on public.attendance_sessions(organization_id);
create index if not exists idx_attendance_sessions_branch on public.attendance_sessions(branch_id);

-- Grant permissions
grant select, insert on public.attendance_audit_log to authenticated;
grant select, insert on public.member_badges to authenticated;
grant select, insert on public.qr_nonce_log to service_role;
