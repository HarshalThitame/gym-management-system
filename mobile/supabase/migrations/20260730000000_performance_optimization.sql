-- Performance Indexes for High-Volume Tables

-- Attendance queries
create index if not exists idx_attendance_sessions_lookup on public.attendance_sessions(gym_id, check_in_at desc);
create index if not exists idx_attendance_sessions_member_lookup on public.attendance_sessions(member_id, check_in_at desc);
create index if not exists idx_attendance_sessions_date_org on public.attendance_sessions(organization_id, check_in_at);

-- Payment queries
create index if not exists idx_payments_lookup on public.payments(gym_id, created_at desc);
create index if not exists idx_payments_org_status on public.payments(organization_id, status, created_at desc);
create index if not exists idx_payments_member on public.payments(member_id, created_at desc);

-- Membership queries
create index if not exists idx_memberships_lookup on public.memberships(gym_id, status, end_date);
create index if not exists idx_memberships_member_status on public.memberships(member_id, status);

-- Lead queries
create index if not exists idx_leads_lookup on public.leads(gym_id, status, created_at desc);
create index if not exists idx_leads_org_source on public.leads(organization_id, source);

-- Notification queries
create index if not exists idx_notifications_user_read on public.notifications(user_id, read, created_at desc);
create index if not exists idx_notifications_org on public.notifications(organization_id, created_at desc);

-- Activity log queries
create index if not exists idx_activity_events_org on public.activity_events(organization_id, created_at desc);
create index if not exists idx_activity_events_gym on public.activity_events(gym_id, created_at desc);

-- Trainer queries
create index if not exists idx_trainer_assignments_lookup on public.trainer_assignments(trainer_id, status);
create index if not exists idx_trainer_sessions_lookup on public.trainer_sessions(trainer_id, session_date);

-- Member directory
create index if not exists idx_members_gym_status on public.members(gym_id, status);
create index if not exists idx_members_org_status on public.members(organization_id, status);

-- Media/Storage cleanup: set progress-photos bucket public
-- (already configured in migration)

analyze public.attendance_sessions;
analyze public.payments;
analyze public.memberships;
analyze public.leads;
analyze public.notifications;
