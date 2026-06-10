create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  actor_id uuid null references auth.users(id) on delete set null,
  event_name text not null check (char_length(event_name) between 2 and 120),
  entity_type text null check (entity_type is null or char_length(entity_type) <= 80),
  entity_id uuid null,
  source text not null default 'system' check (source in ('system', 'admin', 'trainer', 'member', 'public', 'automation', 'import')),
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_gym_occurred_idx on public.analytics_events (gym_id, occurred_at desc);
create index if not exists analytics_events_actor_idx on public.analytics_events (actor_id, occurred_at desc) where actor_id is not null;
create index if not exists analytics_events_name_idx on public.analytics_events (event_name, occurred_at desc);

create table if not exists public.kpi_snapshots (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  kpi_key text not null check (char_length(kpi_key) between 2 and 120),
  kpi_category text not null check (kpi_category in ('revenue', 'membership', 'attendance', 'trainer', 'class', 'fitness', 'retention', 'sales', 'operations')),
  period text not null check (period in ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
  period_start date not null,
  period_end date not null,
  value numeric not null default 0,
  comparison_value numeric null,
  change_percentage numeric null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create unique index if not exists kpi_snapshots_unique_period_idx on public.kpi_snapshots (gym_id, kpi_key, period, period_start, period_end);
create index if not exists kpi_snapshots_category_period_idx on public.kpi_snapshots (gym_id, kpi_category, period_start desc);

create table if not exists public.dashboard_configs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete cascade,
  role_name text not null check (role_name in ('super_admin', 'gym_admin', 'reception_staff', 'trainer', 'member')),
  name text not null check (char_length(name) between 2 and 120),
  scope text not null default 'private' check (scope in ('private', 'role', 'gym')),
  layout jsonb not null default '[]'::jsonb,
  widgets jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dashboard_configs_scope_idx on public.dashboard_configs (gym_id, role_name, scope, is_default desc);
create index if not exists dashboard_configs_user_idx on public.dashboard_configs (user_id, updated_at desc) where user_id is not null;

create table if not exists public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  description text null check (description is null or char_length(description) <= 1000),
  category text not null check (category in ('financial', 'membership', 'attendance', 'trainer', 'class', 'fitness', 'sales', 'retention', 'operations')),
  report_key text not null check (char_length(report_key) between 2 and 120),
  filters jsonb not null default '{}'::jsonb,
  columns jsonb not null default '[]'::jsonb,
  visibility text not null default 'private' check (visibility in ('private', 'role', 'gym')),
  status text not null default 'active' check (status in ('active', 'archived')),
  last_run_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_reports_gym_category_idx on public.saved_reports (gym_id, category, status, updated_at desc);
create index if not exists saved_reports_report_key_idx on public.saved_reports (report_key, status);

create table if not exists public.report_exports (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  saved_report_id uuid null references public.saved_reports(id) on delete set null,
  report_key text not null check (char_length(report_key) between 2 and 120),
  category text not null check (category in ('financial', 'membership', 'attendance', 'trainer', 'class', 'fitness', 'sales', 'retention', 'operations')),
  format text not null check (format in ('csv', 'excel', 'pdf')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'expired')),
  file_path text null check (file_path is null or char_length(file_path) <= 700),
  row_count integer not null default 0 check (row_count >= 0),
  filters jsonb not null default '{}'::jsonb,
  requested_by uuid null references auth.users(id) on delete set null,
  completed_at timestamptz null,
  error_message text null check (error_message is null or char_length(error_message) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists report_exports_gym_status_idx on public.report_exports (gym_id, status, created_at desc);
create index if not exists report_exports_requested_by_idx on public.report_exports (requested_by, created_at desc) where requested_by is not null;

create table if not exists public.forecast_models (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  metric_key text not null check (char_length(metric_key) between 2 and 120),
  model_type text not null default 'moving_average' check (model_type in ('moving_average', 'linear_trend', 'seasonal_baseline', 'manual')),
  horizon_days integer not null default 30 check (horizon_days between 1 and 730),
  training_window_days integer not null default 180 check (training_window_days between 7 and 1825),
  parameters jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  last_run_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists forecast_models_gym_metric_idx on public.forecast_models (gym_id, metric_key, status);

create table if not exists public.business_metrics (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  metric_key text not null check (char_length(metric_key) between 2 and 120),
  metric_category text not null check (metric_category in ('revenue', 'membership', 'attendance', 'trainer', 'class', 'fitness', 'retention', 'sales', 'operations')),
  metric_date date not null,
  value numeric not null default 0,
  dimension text null check (dimension is null or char_length(dimension) <= 80),
  dimension_value text null check (dimension_value is null or char_length(dimension_value) <= 160),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists business_metrics_unique_idx on public.business_metrics (gym_id, metric_key, metric_date, coalesce(dimension, ''), coalesce(dimension_value, ''));
create index if not exists business_metrics_category_date_idx on public.business_metrics (gym_id, metric_category, metric_date desc);

create table if not exists public.analytics_insights (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  insight_type text not null check (insight_type in ('revenue_drop', 'attendance_drop', 'membership_churn_risk', 'trainer_underutilization', 'class_underperformance', 'sales_drop', 'fitness_adherence_drop', 'opportunity')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null check (char_length(title) between 2 and 180),
  description text not null check (char_length(description) between 2 and 1200),
  metric_key text null check (metric_key is null or char_length(metric_key) <= 120),
  current_value numeric null,
  comparison_value numeric null,
  recommendation text null check (recommendation is null or char_length(recommendation) <= 1200),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create index if not exists analytics_insights_gym_status_idx on public.analytics_insights (gym_id, status, severity, created_at desc);

drop trigger if exists set_dashboard_configs_updated_at on public.dashboard_configs;
create trigger set_dashboard_configs_updated_at before update on public.dashboard_configs for each row execute function public.set_updated_at();
drop trigger if exists set_saved_reports_updated_at on public.saved_reports;
create trigger set_saved_reports_updated_at before update on public.saved_reports for each row execute function public.set_updated_at();
drop trigger if exists set_forecast_models_updated_at on public.forecast_models;
create trigger set_forecast_models_updated_at before update on public.forecast_models for each row execute function public.set_updated_at();

create or replace view public.analytics_revenue_daily
with (security_invoker = true) as
select
  gym_id,
  coalesce(paid_at, collected_at, created_at)::date as metric_date,
  sum(amount) filter (where status in ('paid', 'partially_refunded')) as gross_revenue,
  sum(amount) filter (where payment_type = 'membership_purchase') as membership_revenue,
  sum(amount) filter (where payment_type = 'membership_renewal') as renewal_revenue,
  sum(amount) filter (where payment_type = 'personal_training') as pt_revenue,
  sum(amount) filter (where payment_type = 'class_fee') as class_revenue,
  count(*) filter (where status = 'paid') as paid_payments,
  count(distinct member_id) filter (where status = 'paid') as paying_members
from public.payments
where status in ('paid', 'partially_refunded')
group by gym_id, coalesce(paid_at, collected_at, created_at)::date;

create or replace view public.analytics_membership_daily
with (security_invoker = true) as
select
  gym_id,
  created_at::date as metric_date,
  count(*) as memberships_created,
  count(*) filter (where status = 'active') as active_memberships,
  count(*) filter (where status = 'expired') as expired_memberships,
  count(*) filter (where renewal_of_membership_id is not null) as renewals
from public.memberships
group by gym_id, created_at::date;

create or replace view public.analytics_lead_funnel
with (security_invoker = true) as
select
  gym_id,
  source,
  status,
  count(*) as leads,
  min(created_at)::date as first_seen,
  max(created_at)::date as last_seen
from public.leads
group by gym_id, source, status;

drop materialized view if exists public.analytics_revenue_daily_mv;
create materialized view public.analytics_revenue_daily_mv as
select *
from public.analytics_revenue_daily;

create unique index if not exists analytics_revenue_daily_mv_unique_idx on public.analytics_revenue_daily_mv (gym_id, metric_date);
create index if not exists analytics_revenue_daily_mv_date_idx on public.analytics_revenue_daily_mv (metric_date desc);

create or replace function public.refresh_analytics_materialized_views()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.analytics_revenue_daily_mv;
exception
  when object_not_in_prerequisite_state then
    refresh materialized view public.analytics_revenue_daily_mv;
end;
$$;

alter table public.analytics_events enable row level security;
alter table public.kpi_snapshots enable row level security;
alter table public.dashboard_configs enable row level security;
alter table public.saved_reports enable row level security;
alter table public.report_exports enable row level security;
alter table public.forecast_models enable row level security;
alter table public.business_metrics enable row level security;
alter table public.analytics_insights enable row level security;

grant select, insert on public.analytics_events to authenticated;
grant select, insert, update on public.kpi_snapshots to authenticated;
grant select, insert, update on public.dashboard_configs to authenticated;
grant select, insert, update on public.saved_reports to authenticated;
grant select, insert, update on public.report_exports to authenticated;
grant select, insert, update on public.forecast_models to authenticated;
grant select, insert, update on public.business_metrics to authenticated;
grant select, insert, update on public.analytics_insights to authenticated;
grant select on public.analytics_revenue_daily, public.analytics_membership_daily, public.analytics_lead_funnel to authenticated;
grant execute on function public.refresh_analytics_materialized_views() to authenticated;

drop policy if exists "analytics events visible in scope" on public.analytics_events;
create policy "analytics events visible in scope"
on public.analytics_events for select to authenticated
using (
  actor_id = (select auth.uid())
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "authenticated can record analytics events" on public.analytics_events;
create policy "authenticated can record analytics events"
on public.analytics_events for insert to authenticated
with check (
  actor_id = (select auth.uid())
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff', 'trainer']))
);

drop policy if exists "kpis visible to staff" on public.kpi_snapshots;
create policy "kpis visible to staff"
on public.kpi_snapshots for select to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "staff can manage kpis" on public.kpi_snapshots;
create policy "staff can manage kpis"
on public.kpi_snapshots for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])));

drop policy if exists "dashboard configs visible by scope" on public.dashboard_configs;
create policy "dashboard configs visible by scope"
on public.dashboard_configs for select to authenticated
using (
  user_id = (select auth.uid())
  or scope in ('role', 'gym')
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "dashboard configs manageable by owner or staff" on public.dashboard_configs;
create policy "dashboard configs manageable by owner or staff"
on public.dashboard_configs for all to authenticated
using (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
)
with check (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin']))
);

drop policy if exists "saved reports visible by scope" on public.saved_reports;
create policy "saved reports visible by scope"
on public.saved_reports for select to authenticated
using (
  visibility in ('role', 'gym')
  or created_by = (select auth.uid())
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can manage saved reports" on public.saved_reports;
create policy "staff can manage saved reports"
on public.saved_reports for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "report exports visible to requester or staff" on public.report_exports;
create policy "report exports visible to requester or staff"
on public.report_exports for select to authenticated
using (
  requested_by = (select auth.uid())
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can manage report exports" on public.report_exports;
create policy "staff can manage report exports"
on public.report_exports for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "forecast models visible to staff" on public.forecast_models;
create policy "forecast models visible to staff"
on public.forecast_models for select to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "staff can manage forecast models" on public.forecast_models;
create policy "staff can manage forecast models"
on public.forecast_models for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])));

drop policy if exists "business metrics visible to staff" on public.business_metrics;
create policy "business metrics visible to staff"
on public.business_metrics for select to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "staff can manage business metrics" on public.business_metrics;
create policy "staff can manage business metrics"
on public.business_metrics for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])));

drop policy if exists "analytics insights visible to staff" on public.analytics_insights;
create policy "analytics insights visible to staff"
on public.analytics_insights for select to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "staff can manage analytics insights" on public.analytics_insights;
create policy "staff can manage analytics insights"
on public.analytics_insights for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

with report_catalog (name, description, category, report_key, filters, columns, visibility, status) as (
  values
    ('Executive KPI Snapshot', 'Owner-level revenue, membership, attendance, trainer, class, and fitness KPI summary.', 'operations', 'executive_kpi_snapshot', '{"period":"month"}'::jsonb, '["metric","value","comparison","change"]'::jsonb, 'gym', 'active'),
    ('Revenue Source Report', 'Daily revenue split by memberships, renewals, personal training, and class fees.', 'financial', 'revenue_sources', '{"range":"last_30_days"}'::jsonb, '["date","membership","renewal","pt","class","total"]'::jsonb, 'gym', 'active'),
    ('Membership Retention Report', 'Active members, renewals, churn risk, expired memberships, and plan popularity.', 'membership', 'membership_retention', '{"range":"last_90_days"}'::jsonb, '["metric","members","rate","trend"]'::jsonb, 'gym', 'active'),
    ('Attendance Engagement Report', 'Visit frequency, peak hours, inactive members, and attendance trends.', 'attendance', 'attendance_engagement', '{"range":"last_30_days"}'::jsonb, '["date","visits","unique_members","average_duration"]'::jsonb, 'gym', 'active'),
    ('Trainer Performance Scorecard', 'Assigned members, session completion, PT revenue, and ratings by trainer.', 'trainer', 'trainer_scorecard', '{"range":"last_30_days"}'::jsonb, '["trainer","members","sessions","completion","revenue","rating"]'::jsonb, 'gym', 'active'),
    ('Class Utilization Report', 'Bookings, attendance, no-shows, waitlists, and fill rates by class.', 'class', 'class_utilization', '{"range":"last_30_days"}'::jsonb, '["class","sessions","bookings","fill_rate","waitlist"]'::jsonb, 'gym', 'active'),
    ('Fitness Outcomes Report', 'Goal completion, workout adherence, measurement progress, and nutrition compliance.', 'fitness', 'fitness_outcomes', '{"range":"last_90_days"}'::jsonb, '["metric","members","completion","adherence","trend"]'::jsonb, 'gym', 'active'),
    ('Sales Funnel Report', 'Lead sources, free trials, conversion status, and marketing effectiveness.', 'sales', 'sales_funnel', '{"range":"last_90_days"}'::jsonb, '["source","status","leads","conversion_rate"]'::jsonb, 'gym', 'active')
)
insert into public.saved_reports (gym_id, name, description, category, report_key, filters, columns, visibility, status)
select null, name, description, category, report_key, filters, columns, visibility, status
from report_catalog
where not exists (
  select 1 from public.saved_reports existing
  where existing.gym_id is null and existing.report_key = report_catalog.report_key
);

with forecast_catalog (name, metric_key, model_type, horizon_days, training_window_days, parameters, status) as (
  values
    ('Revenue 30-Day Forecast', 'monthly_revenue', 'moving_average', 30, 180, '{"seasonality":"weekly","confidence":"baseline"}'::jsonb, 'active'),
    ('Renewal Forecast', 'membership_renewals', 'moving_average', 30, 180, '{"source":"membership_end_dates"}'::jsonb, 'active'),
    ('Attendance Forecast', 'daily_attendance', 'seasonal_baseline', 14, 90, '{"seasonality":"day_of_week"}'::jsonb, 'active'),
    ('Member Growth Forecast', 'member_growth', 'linear_trend', 90, 365, '{"source":"member_join_dates"}'::jsonb, 'active')
)
insert into public.forecast_models (gym_id, name, metric_key, model_type, horizon_days, training_window_days, parameters, status)
select null, name, metric_key, model_type, horizon_days, training_window_days, parameters, status
from forecast_catalog
where not exists (
  select 1 from public.forecast_models existing
  where existing.gym_id is null and existing.metric_key = forecast_catalog.metric_key
);
