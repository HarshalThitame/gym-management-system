-- Enterprise Security Center — complete data model.
-- MFA methods, password policies, risk scoring, session management,
-- emergency override, threat intelligence, and SIEM integration.

-- ============================================================================
-- 1. USER MFA METHODS
-- ============================================================================
create table if not exists public.user_mfa_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  method_type text not null check (method_type in ('totp', 'sms', 'email', 'push', 'backup_code', 'fido2', 'webauthn')),
  method_name text not null,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  enrolled_at timestamptz not null default now(),
  last_used_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_mfa_user_idx on public.user_mfa_methods (user_id);
create index if not exists user_mfa_type_idx on public.user_mfa_methods (method_type);

-- ============================================================================
-- 2. MFA POLICIES (Per Tenant)
-- ============================================================================
create table if not exists public.mfa_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  requirement text not null default 'optional' check (requirement in ('optional', 'required', 'required_for_admins', 'required_for_sensitive_actions')),
  allowed_methods text[] default '{totp}',
  min_factors int default 1,
  enforce_for_roles text[] default '{}',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 3. PASSWORD POLICIES
-- ============================================================================
create table if not exists public.password_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  min_length int not null default 10,
  require_uppercase boolean not null default true,
  require_lowercase boolean not null default true,
  require_numbers boolean not null default true,
  require_special boolean not null default false,
  expiration_days int default 90,
  history_count int default 5,
  prevent_common boolean not null default true,
  prevent_breached boolean not null default true,
  max_failed_attempts int default 5,
  lockout_duration_minutes int default 30,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 4. USER SESSIONS (Active Session Tracking)
-- ============================================================================
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_token_hash text not null,
  ip_address inet,
  user_agent text,
  device_fingerprint text,
  device_type text check (device_type in ('desktop', 'mobile', 'tablet', 'unknown')),
  browser text,
  os text,
  location_city text,
  location_country text,
  location_lat numeric(9,6),
  location_lng numeric(9,6),
  is_trusted boolean not null default false,
  risk_score int default 0 check (risk_score between 0 and 100),
  is_current boolean not null default false,
  logged_in_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  expired_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_sessions_user_idx on public.user_sessions (user_id);
create index if not exists user_sessions_active_idx on public.user_sessions (user_id) where revoked_at is null and expired_at is null;

-- ============================================================================
-- 5. RISK EVENTS (Risk-Based Authentication)
-- ============================================================================
create table if not exists public.risk_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  event_type text not null check (event_type in (
    'login', 'login_attempt', 'mfa_verification', 'password_change',
    'device_change', 'location_change', 'impossible_travel',
    'vpn_detected', 'tor_detected', 'bot_detected',
    'new_device', 'new_location', 'unusual_time',
    'failed_attempt', 'breached_password', 'reused_password'
  )),
  risk_score int not null default 0 check (risk_score between 0 and 100),
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  signals jsonb default '{}'::jsonb,
  signals_detail jsonb default '[]'::jsonb,
  ip_address inet,
  device_fingerprint text,
  user_agent text,
  location jsonb default '{}'::jsonb,
  action_taken text check (action_taken in ('allowed', 'mfa_required', 'blocked', 'review_required')),
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists risk_events_user_idx on public.risk_events (user_id);
create index if not exists risk_events_org_idx on public.risk_events (organization_id);
create index if not exists risk_events_level_idx on public.risk_events (risk_level);
create index if not exists risk_events_created_idx on public.risk_events (created_at desc);

-- ============================================================================
-- 6. TRUSTED DEVICES
-- ============================================================================
create table if not exists public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_fingerprint text not null,
  device_name text,
  device_type text,
  browser text,
  os text,
  ip_address inet,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz,
  is_approved boolean not null default false,
  risk_score int default 0,
  created_at timestamptz not null default now(),
  unique (user_id, device_fingerprint)
);

create index if not exists trusted_devices_user_idx on public.trusted_devices (user_id);

-- ============================================================================
-- 7. EMERGENCY OVERRIDE (Break-Glass Access)
-- ============================================================================
create table if not exists public.emergency_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  approved_by uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(reason) between 10 and 2000),
  justification text not null check (char_length(justification) between 20 and 5000),
  use_case text not null check (use_case in (
    'tenant_lockout', 'critical_outage', 'admin_recovery',
    'security_incident', 'data_recovery', 'other'
  )),
  access_level text not null check (access_level in ('read_only', 'write', 'admin', 'super_admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'active', 'expired', 'revoked')),
  mfa_verified boolean not null default false,
  duration_minutes int not null default 60 check (duration_minutes between 5 and 1440),
  started_at timestamptz,
  expired_at timestamptz,
  actions_performed jsonb default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists emergency_overrides_org_idx on public.emergency_overrides (organization_id);
create index if not exists emergency_overrides_status_idx on public.emergency_overrides (status);

-- ============================================================================
-- 8. SENSITIVE ACTION LOG (High-Risk Action Tracking)
-- ============================================================================
create table if not exists public.sensitive_action_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  action_type text not null check (action_type in (
    'delete_tenant', 'delete_branch', 'refund_approve', 'permission_change',
    'export_member_data', 'bulk_operation', 'billing_change', 'subscription_change',
    'role_override', 'emergency_access', 'data_purge', 'setting_override'
  )),
  resource_type text not null,
  resource_id text,
  description text not null,
  verification_method text not null check (verification_method in ('password', 'mfa', 'dual_authorization', 'emergency_override')),
  mfa_verified boolean not null default false,
  ip_address inet,
  user_agent text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sensitive_action_actor_idx on public.sensitive_action_logs (actor_id);
create index if not exists sensitive_action_type_idx on public.sensitive_action_logs (action_type);
create index if not exists sensitive_action_created_idx on public.sensitive_action_logs (created_at desc);

-- ============================================================================
-- 9. SECURITY INCIDENTS (Incident Response Queue)
-- ============================================================================
alter table public.security_events add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.security_events add column if not exists escalated_to uuid references auth.users(id) on delete set null;
alter table public.security_events add column if not exists escalated_at timestamptz;
alter table public.security_events add column if not exists investigation_notes text;
alter table public.security_events add column if not exists incident_category text check (incident_category in (
  'authentication', 'authorization', 'data_breach', 'malware',
  'phishing', 'insider_threat', 'misconfiguration', 'third_party',
  'physical_security', 'compliance_violation', 'other'
));

-- ============================================================================
-- 10. INCIDENT INVESTIGATION HISTORY
-- ============================================================================
create table if not exists public.incident_investigations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.security_events(id) on delete cascade,
  action text not null check (action in (
    'created', 'assigned', 'escalated', 'note_added', 'status_changed',
    'evidence_added', 'contained', 'resolved', 'closed', 'reopened'
  )),
  actor_id uuid references auth.users(id) on delete set null,
  note text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists incident_investigations_event_idx on public.incident_investigations (event_id);

-- ============================================================================
-- 11. COMPLIANCE REPORTS
-- ============================================================================
create table if not exists public.compliance_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  report_type text not null check (report_type in ('audit', 'access_review', 'security_posture', 'incident', 'gdpr', 'soc2', 'hipaa', 'pci')),
  title text not null,
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed', 'expired')),
  period_start date not null,
  period_end date not null,
  data jsonb default '{}'::jsonb,
  file_url text,
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists compliance_reports_org_idx on public.compliance_reports (organization_id);
create index if not exists compliance_reports_type_idx on public.compliance_reports (report_type);

-- ============================================================================
-- 12. THREAT INTELLIGENCE CACHE
-- ============================================================================
create table if not exists public.threat_intel_cache (
  id uuid primary key default gen_random_uuid(),
  indicator_type text not null check (indicator_type in ('ip', 'domain', 'email', 'hash', 'user_agent')),
  indicator_value text not null,
  threat_score int default 0 check (threat_score between 0 and 100),
  category text,
  source text not null default 'internal',
  is_malicious boolean not null default false,
  tags text[] default '{}',
  last_checked_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (indicator_type, indicator_value)
);

create index if not exists threat_intel_type_idx on public.threat_intel_cache (indicator_type);
create index if not exists threat_intel_malicious_idx on public.threat_intel_cache (is_malicious) where is_malicious = true;

-- ============================================================================
-- 13. SECURITY NOTIFICATION RULES
-- ============================================================================
create table if not exists public.security_notification_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  event_types text[] not null default '{}',
  severity_threshold text not null default 'medium' check (severity_threshold in ('info', 'low', 'medium', 'high', 'critical')),
  channels text[] not null default '{email}',
  webhook_url text,
  slack_webhook text,
  teams_webhook text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- RLS: ENABLE ROW-LEVEL SECURITY
-- ============================================================================
alter table public.user_mfa_methods enable row level security;
alter table public.mfa_policies enable row level security;
alter table public.password_policies enable row level security;
alter table public.user_sessions enable row level security;
alter table public.risk_events enable row level security;
alter table public.trusted_devices enable row level security;
alter table public.emergency_overrides enable row level security;
alter table public.sensitive_action_logs enable row level security;
alter table public.incident_investigations enable row level security;
alter table public.compliance_reports enable row level security;
alter table public.threat_intel_cache enable row level security;
alter table public.security_notification_rules enable row level security;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
do $$ declare tbl text;
begin
  foreach tbl in array array[
    'user_mfa_methods', 'mfa_policies', 'password_policies', 'user_sessions',
    'risk_events', 'trusted_devices', 'emergency_overrides', 'sensitive_action_logs',
    'incident_investigations', 'compliance_reports', 'threat_intel_cache',
    'security_notification_rules'
  ] loop
    execute format(
      'drop policy if exists "super_admin_full_access on %I" on %I;
       create policy "super_admin_full_access on %I" on %I
         for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());',
      tbl, tbl, tbl, tbl
    );
  end loop;
end $$;

-- User can see own MFA methods
drop policy if exists "user_own_mfa_methods" on public.user_mfa_methods;
create policy "user_own_mfa_methods" on public.user_mfa_methods
  for select to authenticated
  using (user_id = (select auth.uid()));

-- User can see own sessions
drop policy if exists "user_own_sessions" on public.user_sessions;
create policy "user_own_sessions" on public.user_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Tenant-level policies visible to org owners
drop policy if exists "tenant_security_policies" on public.mfa_policies;
create policy "tenant_security_policies" on public.mfa_policies
  for select to authenticated
  using (
    organization_id is null
    or public.is_organization_owner(organization_id)
    or organization_id = public.current_user_organization_id()
  );

-- ============================================================================
-- VIEW: Enterprise security dashboard summary
-- ============================================================================
create or replace view public.enterprise_security_dashboard as
select
  (select count(*) from public.security_events) as total_events,
  (select count(*) from public.security_events where severity = 'critical' and status = 'open') as critical_incidents,
  (select count(*) from public.security_events where status in ('open', 'investigating')) as active_incidents,
  (select count(*) from public.login_history where created_at > now() - interval '24 hours') as logins_24h,
  (select count(*) from public.login_history where status = 'failed' and created_at > now() - interval '24 hours') as failed_logins_24h,
  (select count(*) from public.user_sessions where revoked_at is null and expired_at is null) as active_sessions,
  (select count(*) from public.user_mfa_methods where is_active = true) as mfa_enrollments,
  (select count(*) from public.user_sessions where risk_score > 70) as high_risk_sessions,
  (select count(*) from public.emergency_overrides where status = 'active') as active_overrides,
  (select count(*) from public.sensitive_action_logs where created_at > now() - interval '24 hours') as sensitive_actions_24h;



-- ============================================================================
-- TRIGGER FUNCTION: Update updated_at timestamp
-- ============================================================================
create or replace function public.update_security_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ declare tbl text;
begin
  foreach tbl in array array[
    'mfa_policies', 'password_policies', 'emergency_overrides', 'security_notification_rules'
  ] loop
    execute format(
      'drop trigger if exists trg_%I_updated_at on %I;
       create trigger trg_%I_updated_at before update on %I
         for each row execute function public.update_security_updated_at();',
      tbl, tbl, tbl, tbl
    );
  end loop;
end $$;

-- ============================================================================
-- TRIGGER: Update user_sessions last_active_at on activity
-- ============================================================================
create or replace function public.update_session_last_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_sessions
  set last_active_at = now()
  where user_id = new.user_id
    and revoked_at is null
    and expired_at is null
    and is_current = true;
  return new;
end;
$$;

-- ============================================================================
-- TRIGGER: Log sensitive actions to audit_logs
-- ============================================================================
create or replace function public.log_sensitive_action_to_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (new.actor_id, 'sensitive_action.' || new.action_type, 'sensitive_action_log', new.id, jsonb_build_object(
    'action_type', new.action_type,
    'resource_type', new.resource_type,
    'verification_method', new.verification_method
  ));
  return new;
end;
$$;

drop trigger if exists trg_sensitive_action_audit on public.sensitive_action_logs;
create trigger trg_sensitive_action_audit
  after insert on public.sensitive_action_logs
  for each row
  execute function public.log_sensitive_action_to_audit();
