create table if not exists public.monitoring_alert_configs (
  id uuid primary key default gen_random_uuid(),
  email_recipients text not null default '',
  slack_webhook_url text not null default '',
  pagerduty_integration_key text not null default '',
  pagerduty_severity_mapping jsonb not null default '{"healthy":"info","degraded":"warning","down":"critical"}'::jsonb,
  threshold_latency_warning_ms integer not null default 500,
  threshold_error_rate_pct numeric not null default 5.0,
  threshold_uptime_warning_pct numeric not null default 99.0,
  alert_rules jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monitoring_alert_history (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  component text not null,
  severity text not null check (severity in ('info','warning','critical')),
  channel text not null check (channel in ('email','slack','pagerduty','all')),
  title text not null,
  message text null,
  acknowledged boolean not null default false,
  acknowledged_at timestamptz null,
  acknowledged_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists monitoring_alert_history_service_idx on public.monitoring_alert_history (service, created_at desc);
create index if not exists monitoring_alert_history_severity_idx on public.monitoring_alert_history (severity, created_at desc);
create index if not exists monitoring_alert_history_acknowledged_idx on public.monitoring_alert_history (acknowledged, created_at desc);

create table if not exists public.monitoring_external_health_checks (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  status text not null check (status in ('up','down','degraded')),
  latency_ms integer not null default 0,
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create index if not exists monitoring_external_health_checks_service_idx on public.monitoring_external_health_checks (service, checked_at desc);
