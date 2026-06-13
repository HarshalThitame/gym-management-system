-- Enterprise Observability - Advanced Features
-- Distributed tracing, infrastructure monitoring, SLO/error budget, status pages, live metrics

-- 1. DISTRIBUTED TRACING (OpenTelemetry-compatible spans)
create table if not exists public.obs_tracing_spans (
  id uuid primary key default gen_random_uuid(),
  trace_id text not null,
  parent_span_id text null,
  span_id text not null unique,
  span_name text not null,
  service_name text not null,
  span_kind text not null default 'internal' check (span_kind in ('internal', 'server', 'client', 'producer', 'consumer')),
  status_code text not null default 'unset' check (status_code in ('unset', 'ok', 'error')),
  status_message text null,
  start_time timestamptz not null,
  end_time timestamptz null,
  duration_ms numeric null,
  attributes jsonb not null default '{}'::jsonb,
  resource_attributes jsonb not null default '{}'::jsonb,
  events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists obs_traces_trace_id_idx on public.obs_tracing_spans (trace_id);
create index if not exists obs_traces_service_idx on public.obs_tracing_spans (service_name, start_time desc);
create index if not exists obs_traces_duration_idx on public.obs_tracing_spans (duration_ms desc);
create index if not exists obs_traces_error_idx on public.obs_tracing_spans (status_code) where status_code = 'error';
comment on table public.obs_tracing_spans is 'OpenTelemetry-compatible distributed tracing spans';

-- 2. INFRASTRUCTURE METRICS (CPU, memory, disk, network per host)
create table if not exists public.obs_infra_metrics (
  id uuid primary key default gen_random_uuid(),
  host_name text not null,
  host_role text not null default 'application' check (host_role in ('application', 'database', 'worker', 'cache', 'queue', 'load_balancer', 'monitoring')),
  region text not null default 'default',
  cpu_usage_pct numeric null,
  memory_usage_pct numeric null,
  memory_available_mb numeric null,
  disk_usage_pct numeric null,
  disk_available_mb numeric null,
  network_rx_bytes bigint null,
  network_tx_bytes bigint null,
  load_avg_1m numeric null,
  load_avg_5m numeric null,
  load_avg_15m numeric null,
  process_count integer null,
  container_count integer null,
  collected_at timestamptz not null default now()
);

create index if not exists obs_infra_host_time_idx on public.obs_infra_metrics (host_name, collected_at desc);
create index if not exists obs_infra_role_idx on public.obs_infra_metrics (host_role, collected_at desc);
comment on table public.obs_infra_metrics is 'Infrastructure metrics: CPU, memory, disk, network, load';

-- 3. KUBERNETES / CONTAINER METRICS
create table if not exists public.obs_container_metrics (
  id uuid primary key default gen_random_uuid(),
  pod_name text not null,
  node_name text not null,
  namespace text not null default 'default',
  container_name text not null,
  image text null,
  cpu_request_millicores integer null,
  cpu_limit_millicores integer null,
  memory_request_mb integer null,
  memory_limit_mb integer null,
  restart_count integer not null default 0,
  status text not null default 'running' check (status in ('running', 'pending', 'succeeded', 'failed', 'unknown', 'crash_loop_backoff')),
  deployment_name text null,
  collected_at timestamptz not null default now()
);

create index if not exists obs_container_pod_idx on public.obs_container_metrics (pod_name, collected_at desc);
create index if not exists obs_container_status_idx on public.obs_container_metrics (status);

-- 4. SLO DEFINITIONS
create table if not exists public.obs_slo_definitions (
  id uuid primary key default gen_random_uuid(),
  slo_name text not null,
  slo_description text null,
  service_name text not null,
  metric_source text not null check (metric_source in ('latency_p95', 'latency_p99', 'availability', 'error_rate', 'uptime', 'custom')),
  target_value numeric not null,
  target_unit text not null default '%',
  window_type text not null default 'rolling' check (window_type in ('rolling', 'calendar_month', 'calendar_quarter')),
  window_days integer not null default 30,
  error_budget_initial numeric not null,
  error_budget_remaining numeric not null,
  is_active boolean not null default true,
  owner_team text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists obs_slo_service_idx on public.obs_slo_definitions (service_name, slo_name);
comment on table public.obs_slo_definitions is 'SLO definitions with error budget tracking';

-- 5. SLO COMPLIANCE SNAPSHOTS
create table if not exists public.obs_slo_compliance (
  id uuid primary key default gen_random_uuid(),
  slo_id uuid not null references public.obs_slo_definitions(id) on delete cascade,
  compliance_pct numeric not null,
  error_budget_remaining numeric not null,
  error_budget_burn_rate numeric null,
  good_events integer not null default 0,
  total_events integer not null default 0,
  window_start date not null,
  window_end date not null,
  recorded_at timestamptz not null default now()
);

create index if not exists obs_slo_compliance_slo_idx on public.obs_slo_compliance (slo_id, recorded_at desc);
comment on table public.obs_slo_compliance is 'SLO compliance snapshots for trend analysis';

-- 6. STATUS PAGE SUBSCRIBERS
create table if not exists public.obs_status_subscribers (
  id uuid primary key default gen_random_uuid(),
  status_page_id uuid not null references public.observability_status_pages(id) on delete cascade,
  email text not null,
  is_verified boolean not null default false,
  verification_token text null,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz null
);

create index if not exists obs_status_subs_page_idx on public.obs_status_subscribers (status_page_id);
comment on table public.obs_status_subscribers is 'Status page email subscribers for incident notifications';

-- 7. DEPLOYMENT TRACKING (for change overlay on incident timeline)
create table if not exists public.obs_deployments (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  version text not null,
  environment text not null default 'production',
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'failed', 'rolled_back')),
  commit_sha text null,
  commit_message text null,
  deployed_by text null,
  rollout_percentage integer not null default 100,
  duration_ms integer null,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists obs_deployments_service_idx on public.obs_deployments (service_name, started_at desc);
create index if not exists obs_deployments_status_idx on public.obs_deployments (status);
comment on table public.obs_deployments is 'Deployment tracking for incident timeline change overlays';

-- 8. LIVE METRICS STREAM (for real-time dashboard)
create table if not exists public.obs_live_metrics (
  id bigserial,
  metric_name text not null,
  metric_value numeric not null,
  tags jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  primary key (id, recorded_at)
) partition by range (recorded_at);

create table if not exists public.obs_live_metrics_default partition of public.obs_live_metrics
for values from ('2026-01-01') to ('2027-01-01');

create index if not exists obs_live_metrics_name_idx on public.obs_live_metrics (metric_name, recorded_at desc);
comment on table public.obs_live_metrics is 'Real-time metrics stream for live dashboard updates';

-- 9. REGIONS TABLE FOR MULTI-REGION MONITORING
create table if not exists public.obs_regions (
  id uuid primary key default gen_random_uuid(),
  region_name text not null unique,
  region_code text not null unique,
  provider text not null default 'aws',
  is_active boolean not null default true,
  health_status text not null default 'unknown' check (health_status in ('healthy', 'degraded', 'down', 'unknown')),
  last_health_check_at timestamptz null,
  created_at timestamptz not null default now()
);

-- 10. DISASTER RECOVERY STATUS
create table if not exists public.obs_dr_status (
  id uuid primary key default gen_random_uuid(),
  dr_plan_name text not null,
  description text null,
  status text not null default 'ready' check (status in ('ready', 'in_progress', 'tested', 'failed', 'not_configured')),
  last_tested_at timestamptz null,
  estimated_recovery_time_minutes integer null,
  estimated_data_loss_minutes integer null,
  is_automatic_failover boolean not null default false,
  secondary_region text null,
  updated_at timestamptz not null default now()
);

-- Seed regions
insert into public.obs_regions (region_name, region_code, provider)
values
  ('Mumbai (AP-South-1)', 'ap-south-1', 'aws'),
  ('Singapore (AP-Southeast-1)', 'ap-southeast-1', 'aws'),
  ('US East (N. Virginia)', 'us-east-1', 'aws'),
  ('US West (Oregon)', 'us-west-2', 'aws'),
  ('EU (Frankfurt)', 'eu-central-1', 'aws')
on conflict (region_name) do nothing;

-- Seed SLO definitions
insert into public.obs_slo_definitions (slo_name, slo_description, service_name, metric_source, target_value, window_days, error_budget_initial, error_budget_remaining)
values
  ('API Availability', 'API Gateway uptime availability', 'API Gateway', 'availability', 99.9, 30, 100, 100),
  ('API Latency P95', 'API response time 95th percentile', 'API Gateway', 'latency_p95', 500, 30, 100, 100),
  ('Database Availability', 'Database uptime and connectivity', 'Supabase Database', 'availability', 99.99, 30, 100, 100),
  ('Payment Success Rate', 'Payment processing success rate', 'Payment Gateway (Razorpay)', 'error_rate', 98.0, 30, 100, 100),
  ('Email Delivery Rate', 'Transactional email delivery rate', 'Email Service (Resend)', 'error_rate', 97.0, 30, 100, 100)
on conflict (service_name, slo_name) do nothing;

-- Seed DR status
insert into public.obs_dr_status (dr_plan_name, description, status, estimated_recovery_time_minutes, estimated_data_loss_minutes, is_automatic_failover, secondary_region)
values
  ('Primary DR Plan', 'Full disaster recovery with cross-region failover', 'tested', 15, 5, true, 'ap-southeast-1')
on conflict (id) do nothing;

-- RLS policies
do $$
declare
  tables text[] := array[
    'obs_tracing_spans', 'obs_infra_metrics', 'obs_container_metrics',
    'obs_slo_definitions', 'obs_slo_compliance', 'obs_status_subscribers',
    'obs_deployments', 'obs_live_metrics', 'obs_regions', 'obs_dr_status'
  ];
  t text;
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('
      create policy "%s_super_admin" on %I for all to authenticated
      using (public.is_super_admin()) with check (public.is_super_admin());
    ', t, t);
    execute format('
      create policy "%s_read" on %I for select to authenticated using (true);
    ', t, t);
  end loop;
end $$;

grant select on all tables in schema public to authenticated;
grant insert, update on public.obs_tracing_spans to authenticated;
grant insert, update on public.obs_infra_metrics to authenticated;
grant insert, update on public.obs_slo_definitions to authenticated;
grant insert, update on public.obs_slo_compliance to authenticated;
grant insert on public.obs_live_metrics to authenticated;
