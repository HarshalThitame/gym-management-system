-- QA Phase 4.5 performance remediation.
-- Target the high-volume dashboard, reporting, and operational filters identified
-- during the performance audit without changing application behavior.

create index if not exists payments_gym_status_created_at_perf_idx
on public.payments (gym_id, status, created_at desc);

create index if not exists payments_gym_status_paid_at_perf_idx
on public.payments (gym_id, status, paid_at desc)
where paid_at is not null;

create index if not exists payments_gym_type_created_at_perf_idx
on public.payments (gym_id, payment_type, created_at desc);

create index if not exists memberships_gym_status_end_date_perf_idx
on public.memberships (gym_id, status, end_date);

create index if not exists memberships_gym_created_at_renewal_perf_idx
on public.memberships (gym_id, created_at desc)
where renewal_of_membership_id is not null;

create index if not exists members_gym_joined_at_perf_idx
on public.members (gym_id, joined_at desc);

create index if not exists attendance_sessions_gym_check_in_perf_idx
on public.attendance_sessions (gym_id, check_in_at desc);

create index if not exists attendance_sessions_gym_status_check_in_perf_idx
on public.attendance_sessions (gym_id, status, check_in_at desc);

create index if not exists attendance_sessions_member_check_in_perf_idx
on public.attendance_sessions (member_id, check_in_at desc);

create index if not exists access_logs_gym_decision_time_perf_idx
on public.access_logs (gym_id, decision, occurred_at desc);

create index if not exists class_bookings_gym_status_booked_perf_idx
on public.class_bookings (gym_id, status, booked_at desc);

create index if not exists class_bookings_session_status_perf_idx
on public.class_bookings (session_id, status, booked_at desc);

create index if not exists class_waitlists_gym_status_joined_perf_idx
on public.class_waitlists (gym_id, status, joined_at desc);

create index if not exists class_attendance_gym_marked_perf_idx
on public.class_attendance (gym_id, marked_at desc);

create index if not exists class_attendance_session_status_perf_idx
on public.class_attendance (session_id, status, marked_at desc);

create index if not exists business_metrics_gym_metric_date_perf_idx
on public.business_metrics (gym_id, metric_date desc);

create index if not exists analytics_insights_gym_status_created_perf_idx
on public.analytics_insights (gym_id, status, created_at desc);

create index if not exists branch_metrics_metric_date_perf_idx
on public.branch_metrics (metric_date desc);

create index if not exists branch_metrics_org_branch_date_perf_idx
on public.branch_metrics (organization_id, branch_id, metric_date desc);
