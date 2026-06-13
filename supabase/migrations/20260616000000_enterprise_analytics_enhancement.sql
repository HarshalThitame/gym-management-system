-- Enterprise Analytics & Business Intelligence Enhancement
-- Adds tables for cohorts, marketing attribution, churn prediction, alerts, and platform-wide analytics

-- Membership Cohorts
create table if not exists public.analytics_cohorts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete cascade,
  gym_id uuid null references public.gyms(id) on delete cascade,
  cohort_period text not null check (cohort_period in ('monthly', 'quarterly', 'yearly')),
  cohort_date date not null,
  member_count integer not null default 0,
  retention_day_7 numeric null,
  retention_day_30 numeric null,
  retention_day_90 numeric null,
  retention_annual numeric null,
  churn_rate numeric null,
  revenue_contributed numeric not null default 0,
  lifetime_value numeric null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_cohorts_org_date_idx on public.analytics_cohorts (organization_id, cohort_date desc);
create index if not exists analytics_cohorts_gym_date_idx on public.analytics_cohorts (gym_id, cohort_date desc);

comment on table public.analytics_cohorts is 'Membership cohort analysis for retention and LTV tracking';

-- Marketing Campaigns
create table if not exists public.analytics_marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete cascade,
  gym_id uuid null references public.gyms(id) on delete cascade,
  campaign_name text not null check (char_length(campaign_name) between 2 and 200),
  campaign_type text not null check (campaign_type in ('google_ads', 'meta_ads', 'instagram', 'whatsapp', 'referral', 'influencer', 'organic', 'email', 'other')),
  channel text not null,
  budget numeric not null default 0,
  spend numeric not null default 0,
  leads_generated integer not null default 0,
  conversions integer not null default 0,
  revenue_generated numeric not null default 0,
  roi numeric null,
  cac numeric null,
  start_date date not null,
  end_date date null,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists analytics_campaigns_org_idx on public.analytics_marketing_campaigns (organization_id, start_date desc);
create index if not exists analytics_campaigns_type_idx on public.analytics_marketing_campaigns (campaign_type, status);

comment on table public.analytics_marketing_campaigns is 'Marketing campaign tracking with ROI and CAC analytics';

-- Marketing Attribution
create table if not exists public.analytics_marketing_attribution (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete cascade,
  gym_id uuid null references public.gyms(id) on delete cascade,
  campaign_id uuid null references public.analytics_marketing_campaigns(id) on delete set null,
  lead_id uuid null,
  member_id uuid null,
  attribution_model text not null check (attribution_model in ('first_touch', 'last_touch', 'linear', 'position_based', 'time_decay')),
  touch_points jsonb not null default '[]'::jsonb,
  attribution_weight numeric not null default 0,
  revenue_attributed numeric not null default 0,
  converted_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists analytics_attribution_campaign_idx on public.analytics_marketing_attribution (campaign_id);
create index if not exists analytics_attribution_model_idx on public.analytics_marketing_attribution (attribution_model);

comment on table public.analytics_marketing_attribution is 'Multi-touch marketing attribution tracking';

-- Churn Prediction
create table if not exists public.analytics_churn_predictions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete cascade,
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  risk_score numeric not null default 0 check (risk_score between 0 and 100),
  risk_category text not null check (risk_category in ('low', 'medium', 'high', 'critical')),
  churn_probability numeric not null default 0,
  predicted_churn_date date null,
  behavioral_indicators jsonb not null default '[]'::jsonb,
  early_warning_signals jsonb not null default '[]'::jsonb,
  recommended_interventions jsonb not null default '[]'::jsonb,
  model_version text not null default '1.0',
  prediction_date date not null default current_date,
  is_actioned boolean not null default false,
  actioned_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists analytics_churn_member_idx on public.analytics_churn_predictions (member_id, prediction_date desc);
create index if not exists analytics_churn_risk_idx on public.analytics_churn_predictions (risk_category, prediction_date desc);
create index if not exists analytics_churn_org_idx on public.analytics_churn_predictions (organization_id, risk_score desc);

comment on table public.analytics_churn_predictions is 'AI-powered churn prediction engine results';

-- Analytics Alerts Configuration
create table if not exists public.analytics_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete cascade,
  gym_id uuid null references public.gyms(id) on delete cascade,
  alert_name text not null check (char_length(alert_name) between 2 and 160),
  metric_key text not null check (char_length(metric_key) between 2 and 120),
  condition_type text not null check (condition_type in ('threshold_above', 'threshold_below', 'percentage_change', 'anomaly_detection')),
  threshold_value numeric not null,
  comparison_period text null check (comparison_period in ('previous_day', 'previous_week', 'previous_month', 'same_period_last_year')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  channels jsonb not null default '["email"]'::jsonb,
  slack_webhook text null,
  teams_webhook text null,
  webhook_url text null,
  is_active boolean not null default true,
  last_triggered_at timestamptz null,
  cooldown_minutes integer not null default 60,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists analytics_alerts_active_idx on public.analytics_alerts (is_active, organization_id);
create index if not exists analytics_alerts_metric_idx on public.analytics_alerts (metric_key, is_active);

comment on table public.analytics_alerts is 'Automated alert configurations for revenue, churn, attendance, and performance monitoring';

-- Analytics Alert History
create table if not exists public.analytics_alert_history (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.analytics_alerts(id) on delete cascade,
  metric_key text not null,
  trigger_value numeric not null,
  threshold_value numeric not null,
  condition_met text not null,
  notification_sent boolean not null default false,
  channels_used jsonb not null default '[]'::jsonb,
  acknowledged_at timestamptz null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists analytics_alert_history_alert_idx on public.analytics_alert_history (alert_id, created_at desc);

comment on table public.analytics_alert_history is 'History of triggered analytics alerts';

-- Customer Lifetime Value Snapshots
create table if not exists public.analytics_ltv_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete cascade,
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  current_ltv numeric not null default 0,
  predicted_ltv numeric null,
  average_ltv numeric null,
  segment text not null check (segment in ('high_value', 'medium_value', 'at_risk', 'vip', 'champion', 'new')),
  revenue_contributed numeric not null default 0,
  retention_months integer not null default 0,
  upgrade_likelihood numeric null,
  membership_tier text null,
  snapshot_date date not null default current_date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_ltv_member_idx on public.analytics_ltv_snapshots (member_id, snapshot_date desc);
create index if not exists analytics_ltv_segment_idx on public.analytics_ltv_snapshots (segment, snapshot_date desc);
create index if not exists analytics_ltv_org_idx on public.analytics_ltv_snapshots (organization_id, current_ltv desc);

comment on table public.analytics_ltv_snapshots is 'Customer lifetime value snapshots for segmentation and analysis';

-- Branch Scorecard Snapshots
create table if not exists public.analytics_branch_scorecards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  revenue numeric not null default 0,
  growth_rate numeric null,
  profitability numeric null,
  membership_growth numeric null,
  retention_rate numeric null,
  trainer_utilization numeric null,
  capacity_utilization numeric null,
  member_count integer not null default 0,
  new_members integer not null default 0,
  churned_members integer not null default 0,
  scorecard_date date not null default current_date,
  rank integer null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_scorecard_branch_idx on public.analytics_branch_scorecards (branch_id, scorecard_date desc);
create index if not exists analytics_scorecard_org_idx on public.analytics_branch_scorecards (organization_id, scorecard_date desc);

comment on table public.analytics_branch_scorecards is 'Branch performance scorecards for franchise benchmarking';

-- Enable RLS
alter table public.analytics_cohorts enable row level security;
alter table public.analytics_marketing_campaigns enable row level security;
alter table public.analytics_marketing_attribution enable row level security;
alter table public.analytics_churn_predictions enable row level security;
alter table public.analytics_alerts enable row level security;
alter table public.analytics_alert_history enable row level security;
alter table public.analytics_ltv_snapshots enable row level security;
alter table public.analytics_branch_scorecards enable row level security;

-- RLS Policies
create policy "analytics cohorts visible to super admin and org scope"
on public.analytics_cohorts for select to authenticated
using (
  public.is_super_admin()
  or (organization_id = public.current_user_organization_id() and public.has_any_role(array['organization_owner', 'gym_admin']))
);

create policy "marketing campaigns visible to super admin and org scope"
on public.analytics_marketing_campaigns for select to authenticated
using (
  public.is_super_admin()
  or (organization_id = public.current_user_organization_id() and public.has_any_role(array['organization_owner', 'gym_admin']))
);

create policy "marketing campaigns manageable by staff"
on public.analytics_marketing_campaigns for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin'])));

create policy "churn predictions visible to super admin and org scope"
on public.analytics_churn_predictions for select to authenticated
using (
  public.is_super_admin()
  or (organization_id = public.current_user_organization_id() and public.has_any_role(array['organization_owner', 'gym_admin', 'trainer']))
);

create policy "analytics alerts visible to super admin and org scope"
on public.analytics_alerts for select to authenticated
using (
  public.is_super_admin()
  or (organization_id = public.current_user_organization_id() and public.has_any_role(array['organization_owner', 'gym_admin']))
);

create policy "analytics alerts manageable by org admin"
on public.analytics_alerts for all to authenticated
using (public.is_super_admin() or (organization_id = public.current_user_organization_id() and public.has_any_role(array['organization_owner', 'gym_admin'])))
with check (public.is_super_admin() or (organization_id = public.current_user_organization_id() and public.has_any_role(array['organization_owner', 'gym_admin'])));

create policy "alert history visible to super admin and org scope"
on public.analytics_alert_history for select to authenticated
using (public.is_super_admin());

create policy "ltv snapshots visible to super admin and org scope"
on public.analytics_ltv_snapshots for select to authenticated
using (
  public.is_super_admin()
  or (organization_id = public.current_user_organization_id() and public.has_any_role(array['organization_owner', 'gym_admin']))
);

create policy "branch scorecards visible to super admin and org scope"
on public.analytics_branch_scorecards for select to authenticated
using (
  public.is_super_admin()
  or (organization_id = public.current_user_organization_id() and public.has_any_role(array['organization_owner', 'gym_admin', 'branch_manager']))
);

-- Grant permissions
grant select, insert, update on public.analytics_cohorts to authenticated;
grant select, insert, update on public.analytics_marketing_campaigns to authenticated;
grant select, insert on public.analytics_marketing_attribution to authenticated;
grant select, insert, update on public.analytics_churn_predictions to authenticated;
grant select, insert, update on public.analytics_alerts to authenticated;
grant select on public.analytics_alert_history to authenticated;
grant select, insert, update on public.analytics_ltv_snapshots to authenticated;
grant select, insert, update on public.analytics_branch_scorecards to authenticated;
