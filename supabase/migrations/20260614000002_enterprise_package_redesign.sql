-- ============================================================================
-- Enterprise Package Architecture Redesign
-- 
-- Replaces hardcoded feature/limit columns with a scalable key-value
-- entitlement system. Every feature is catalogued centrally. Packages
-- reference features by code. New features = new row in feature_catalog,
-- NOT a schema migration.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- FEATURE CATEGORIES — logical groupings for the UI
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.feature_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  icon text,
  sort_order int not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.feature_categories is 'Logical groupings of features for UI presentation';

-- ════════════════════════════════════════════════════════════════════════════
-- FEATURE CATALOG — master registry of every possible platform feature
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.feature_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  category_id uuid references public.feature_categories(id) on delete restrict,
  feature_type text not null default 'boolean' check (feature_type in ('boolean', 'numeric', 'text', 'json')),
  default_value jsonb not null default 'false',
  depends_on text[] default '{}',
  sort_order int not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.feature_catalog is 'Central registry of every feature the platform supports. Adding features does not require schema changes.';
comment on column public.feature_catalog.feature_type is 'Data type of the feature value: boolean (on/off), numeric (count/amount), text, or json (complex config)';
comment on column public.feature_catalog.default_value is 'Default value when a package does not explicitly define this feature';
comment on column public.feature_catalog.depends_on is 'Array of feature codes that must be enabled for this feature to function';

create index if not exists feature_catalog_category_idx on public.feature_catalog (category_id);
create index if not exists feature_catalog_active_idx on public.feature_catalog (is_active) where is_active = true;

alter table public.feature_catalog enable row level security;

drop policy if exists "catalog readable by all authenticated" on public.feature_catalog;
create policy "catalog readable by all authenticated"
  on public.feature_catalog for select to authenticated
  using (true);

drop policy if exists "catalog manageable by super admins" on public.feature_catalog;
create policy "catalog manageable by super admins"
  on public.feature_catalog for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "catalog updatable by super admins" on public.feature_catalog;
create policy "catalog updatable by super admins"
  on public.feature_catalog for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "catalog deletable by super admins" on public.feature_catalog;
create policy "catalog deletable by super admins"
  on public.feature_catalog for delete to authenticated
  using (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- PACKAGE FEATURES — which features a package enables
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.package_features (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  feature_code text not null,
  value jsonb not null default 'true',
  min_value jsonb,
  max_value jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (package_id, feature_code)
);

comment on table public.package_features is 'Feature entitlements per package. Key-value store — feature_code references feature_catalog.code.';
comment on column public.package_features.value is 'The entitlement value: true/false for boolean features, number for numeric limits, string for text, object for complex';
comment on column public.package_features.min_value is 'Optional minimum constraint (e.g. min members)';
comment on column public.package_features.max_value is 'Optional maximum constraint (e.g. max API calls per day)';

create index if not exists package_features_pkg_idx on public.package_features (package_id);
create index if not exists package_features_code_idx on public.package_features (feature_code);

alter table public.package_features enable row level security;

drop policy if exists "pkg features readable by authenticated" on public.package_features;
create policy "pkg features readable by authenticated"
  on public.package_features for select to authenticated
  using (true);

drop policy if exists "pkg features manageable by super admins" on public.package_features;
create policy "pkg features manageable by super admins"
  on public.package_features for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "pkg features updatable by super admins" on public.package_features;
create policy "pkg features updatable by super admins"
  on public.package_features for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "pkg features deletable by super admins" on public.package_features;
create policy "pkg features deletable by super admins"
  on public.package_features for delete to authenticated
  using (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- PACKAGE LIMITS — numeric constraints per package
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.package_limits (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  limit_code text not null,
  label text not null,
  description text,
  value int not null check (value = -1 or value >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (package_id, limit_code)
);

comment on table public.package_limits is 'Numeric resource limits per package. value=-1 means unlimited.';
comment on column public.package_limits.limit_code is 'Canonical key (e.g. max_members, max_branches, max_trainers, max_staff, max_gyms)';
comment on column public.package_limits.value is '-1 = unlimited. 0 = disabled. Positive = fixed limit.';

create index if not exists package_limits_pkg_idx on public.package_limits (package_id);

alter table public.package_limits enable row level security;

drop policy if exists "pkg limits readable by authenticated" on public.package_limits;
create policy "pkg limits readable by authenticated"
  on public.package_limits for select to authenticated
  using (true);

drop policy if exists "pkg limits manageable by super admins" on public.package_limits;
create policy "pkg limits manageable by super admins"
  on public.package_limits for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "pkg limits updatable by super admins" on public.package_limits;
create policy "pkg limits updatable by super admins"
  on public.package_limits for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "pkg limits deletable by super admins" on public.package_limits;
create policy "pkg limits deletable by super admins"
  on public.package_limits for delete to authenticated
  using (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- PACKAGE PRICING — multi-period pricing support
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.package_pricing (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  billing_period text not null check (billing_period in ('monthly', 'quarterly', 'half_yearly', 'annual')),
  price int not null check (price >= 0),
  currency text not null default 'INR',
  is_active boolean not null default true,
  setup_fee int not null default 0 check (setup_fee >= 0),
  created_at timestamptz not null default now(),
  unique (package_id, billing_period)
);

comment on table public.package_pricing is 'Price points per billing period for each package. Supports monthly, quarterly, half-yearly, annual.';

create index if not exists package_pricing_pkg_idx on public.package_pricing (package_id);

alter table public.package_pricing enable row level security;

drop policy if exists "pricing readable by authenticated" on public.package_pricing;
create policy "pricing readable by authenticated"
  on public.package_pricing for select to authenticated
  using (true);

drop policy if exists "pricing manageable by super admins" on public.package_pricing;
create policy "pricing manageable by super admins"
  on public.package_pricing for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "pricing updatable by super admins" on public.package_pricing;
create policy "pricing updatable by super admins"
  on public.package_pricing for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "pricing deletable by super admins" on public.package_pricing;
create policy "pricing deletable by super admins"
  on public.package_pricing for delete to authenticated
  using (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- PACKAGE VERSIONS — immutable change history
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.package_versions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  version int not null check (version > 0),
  snapshot jsonb not null,
  change_description text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (package_id, version)
);

comment on table public.package_versions is 'Immutable version history of package configurations for audit and rollback.';

create index if not exists package_versions_pkg_idx on public.package_versions (package_id, version desc);

alter table public.package_versions enable row level security;

drop policy if exists "pkg versions super admin" on public.package_versions;
create policy "pkg versions super admin"
  on public.package_versions for select to authenticated
  using (public.is_super_admin());

drop policy if exists "pkg versions insert super admin" on public.package_versions;
create policy "pkg versions insert super admin"
  on public.package_versions for insert to authenticated
  with check (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- SUBSCRIPTION HISTORY — full lifecycle audit trail
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.subscription_history (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.organization_subscriptions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null check (event_type in (
    'created', 'upgraded', 'downgraded', 'crossgraded',
    'renewed', 'cancelled', 'reactivated', 'expired',
    'suspended', 'payment_failed', 'payment_recovered',
    'price_changed', 'billing_period_changed', 'trial_started',
    'trial_converted', 'trial_expired', 'trial_extended'
  )),
  previous_package_id uuid references public.packages(id) on delete set null,
  new_package_id uuid references public.packages(id) on delete set null,
  previous_state jsonb,
  new_state jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  reason text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.subscription_history is 'Complete immutable history of every subscription state change for audit, billing disputes, and analytics.';

create index if not exists subscription_history_sub_idx on public.subscription_history (subscription_id);
create index if not exists subscription_history_org_idx on public.subscription_history (organization_id);
create index if not exists subscription_history_event_idx on public.subscription_history (event_type);
create index if not exists subscription_history_created_idx on public.subscription_history (created_at desc);

alter table public.subscription_history enable row level security;

drop policy if exists "sub history super admin" on public.subscription_history;
create policy "sub history super admin"
  on public.subscription_history for select to authenticated
  using (public.is_super_admin());

drop policy if exists "sub history org owners" on public.subscription_history;
create policy "sub history org owners"
  on public.subscription_history for select to authenticated
  using (
    public.is_organization_owner(organization_id)
    or (public.has_role('gym_admin') and organization_id = public.current_user_organization_id())
  );

drop policy if exists "sub history insert" on public.subscription_history;
create policy "sub history insert"
  on public.subscription_history for insert to authenticated
  with check (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- NOTE: billing_events table already exists with a different schema.
-- Financial audit trail is handled by the existing table and subscription_history.
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- ADD NEW COLUMNS TO EXISTING TABLES
-- ════════════════════════════════════════════════════════════════════════════

-- Add slug to packages for URL-safe package identifiers
alter table public.packages add column if not exists slug text;
update public.packages set slug = lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g')) where slug is null;
alter table public.packages alter column slug set not null;
alter table public.packages add constraint packages_slug_unique unique (slug);

-- Add metadata jsonb for flexible package attributes
alter table public.packages add column if not exists metadata jsonb default '{}'::jsonb;

-- Add display attributes
alter table public.packages add column if not exists color text;
alter table public.packages add column if not exists icon text;

-- Add trial defaults
alter table public.packages add column if not exists trial_days int not null default 0 check (trial_days >= 0);

-- Add archived_at
alter table public.packages add column if not exists archived_at timestamptz;

-- ════════════════════════════════════════════════════════════════════════════
-- TRIGGER: Auto-snapshot package_versions on package feature/limit/pricing change
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.snapshot_package_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_version int;
  v_snapshot jsonb;
begin
  -- Get current version number
  select coalesce(max(version), 0) into v_current_version
  from public.package_versions
  where package_id = new.package_id;

  -- Build full snapshot of the package state
  select jsonb_build_object(
    'package', row_to_json(p.*),
    'features', (
      select jsonb_agg(jsonb_build_object('code', pf.feature_code, 'value', pf.value))
      from public.package_features pf where pf.package_id = new.package_id
    ),
    'limits', (
      select jsonb_agg(jsonb_build_object('code', pl.limit_code, 'value', pl.value))
      from public.package_limits pl where pl.package_id = new.package_id
    ),
    'pricing', (
      select jsonb_agg(jsonb_build_object('period', pp.billing_period, 'price', pp.price))
      from public.package_pricing pp where pp.package_id = new.package_id
    )
  ) into v_snapshot
  from public.packages p
  where p.id = new.package_id;

  -- Insert new version
  insert into public.package_versions (package_id, version, snapshot, change_description)
  values (new.package_id, v_current_version + 1, v_snapshot, 'Auto-snapshot on configuration change');

  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- VIEW: package_entitlements — backward-compatible flat view
-- ════════════════════════════════════════════════════════════════════════════

create or replace view public.package_entitlements as
select
  p.id as package_id,
  p.name as package_name,
  p.slug,
  p.description,
  p.is_active,
  p.sort_order,
  p.trial_days,
  p.color,
  p.icon,
  p.metadata,
  p.archived_at,
  p.created_at,
  p.updated_at,
  -- Limits as columns (for backward compatibility)
  coalesce((select pl.value from public.package_limits pl where pl.package_id = p.id and pl.limit_code = 'max_members'), 0) as max_members,
  coalesce((select pl.value from public.package_limits pl where pl.package_id = p.id and pl.limit_code = 'max_branches'), 0) as max_branches,
  coalesce((select pl.value from public.package_limits pl where pl.package_id = p.id and pl.limit_code = 'max_gyms'), 0) as max_gyms,
  coalesce((select pl.value from public.package_limits pl where pl.package_id = p.id and pl.limit_code = 'max_trainers'), 0) as max_trainers,
  coalesce((select pl.value from public.package_limits pl where pl.package_id = p.id and pl.limit_code = 'max_staff'), 0) as max_staff,
  coalesce((select pl.value from public.package_limits pl where pl.package_id = p.id and pl.limit_code = 'max_storage_gb'), 0) as max_storage_gb,
  coalesce((select pl.value from public.package_limits pl where pl.package_id = p.id and pl.limit_code = 'max_api_calls'), 0) as max_api_calls,
  -- Features as columns
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'qr_attendance')::boolean, false) as qr_attendance_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'dynamic_qr_attendance')::boolean, false) as dynamic_qr_attendance_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'biometric_attendance')::boolean, false) as biometric_attendance_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'fingerprint_attendance')::boolean, false) as fingerprint_attendance_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'rfid_attendance')::boolean, false) as rfid_attendance_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'nfc_attendance')::boolean, false) as nfc_attendance_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'geo_fencing_attendance')::boolean, false) as geo_fencing_attendance_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'attendance_api')::boolean, false) as attendance_api_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'member_management')::boolean, false) as member_management_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'trainer_management')::boolean, false) as trainer_management_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'staff_management')::boolean, false) as staff_management_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'lead_management')::boolean, false) as lead_management_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'trial_management')::boolean, false) as trial_management_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'class_booking')::boolean, false) as class_booking_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'pt_sessions')::boolean, false) as pt_sessions_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'nutrition_plans')::boolean, false) as nutrition_plans_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'goal_tracking')::boolean, false) as goal_tracking_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'progress_photos')::boolean, false) as progress_photos_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'workout_assignment')::boolean, false) as workout_assignment_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'billing_invoices')::boolean, false) as billing_invoices_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'receipts')::boolean, false) as receipts_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'payment_tracking')::boolean, false) as payment_tracking_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'basic_reports')::boolean, false) as basic_reports_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'advanced_reports')::boolean, false) as advanced_reports_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'email_notifications')::boolean, false) as email_notifications_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'whatsapp_integration')::boolean, false) as whatsapp_integration_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'sms_integration')::boolean, false) as sms_integration_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'in_app_notifications')::boolean, false) as in_app_notifications_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'member_portal')::boolean, false) as member_portal_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'trainer_portal')::boolean, false) as trainer_portal_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'ai_recommendations')::boolean, false) as ai_recommendations_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'ai_coach')::boolean, false) as ai_coach_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'ai_retention_analysis')::boolean, false) as ai_retention_analysis_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'ai_revenue_insights')::boolean, false) as ai_revenue_insights_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'multi_branch_management')::boolean, false) as multi_branch_management_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'white_label')::boolean, false) as white_label_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'custom_domain')::boolean, false) as custom_domain_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'custom_branding')::boolean, false) as custom_branding_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'api_access')::boolean, false) as api_access_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'webhooks')::boolean, false) as webhooks_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'audit_logs')::boolean, false) as audit_logs_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'advanced_rbac')::boolean, false) as advanced_rbac_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'priority_support')::boolean, false) as priority_support_enabled,
  -- Pricing as columns
  (select jsonb_object_agg(pp.billing_period, pp.price) from public.package_pricing pp where pp.package_id = p.id) as pricing,
  (select jsonb_object_agg(pp.billing_period, pp.setup_fee) from public.package_pricing pp where pp.package_id = p.id) as setup_fees
from public.packages p;

comment on view public.package_entitlements is 'Flattened view of packages with features, limits, and pricing as columns for backward compatibility.';

-- ════════════════════════════════════════════════════════════════════════════
-- SEED FEATURE CATEGORIES
-- ════════════════════════════════════════════════════════════════════════════

insert into public.feature_categories (code, name, description, icon, sort_order) values
  ('attendance', 'Attendance', 'Member check-in and attendance tracking', 'fingerprint', 1),
  ('membership', 'Membership Management', 'Member lifecycle and plan management', 'users', 2),
  ('crm', 'CRM & Sales', 'Lead management, trials, and conversions', 'target', 3),
  ('trainer', 'Trainer Management', 'Trainer tools, PT sessions, nutrition', 'dumbbell', 4),
  ('billing', 'Billing & Payments', 'Invoicing, payments, receipts', 'indian-rupee', 5),
  ('reports', 'Reports & Analytics', 'Business intelligence and reporting', 'bar-chart', 6),
  ('communication', 'Communication', 'Member communications and notifications', 'message-square', 7),
  ('ai', 'AI Features', 'Artificial intelligence and recommendations', 'cpu', 8),
  ('white_label', 'White Label', 'Custom branding and domains', 'palette', 9),
  ('enterprise', 'Enterprise', 'Enterprise-grade features', 'building', 10),
  ('platform', 'Platform', 'Platform and integration features', 'settings', 11)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

-- ════════════════════════════════════════════════════════════════════════════
-- SEED FEATURE CATALOG — complete registry of all platform features
-- ════════════════════════════════════════════════════════════════════════════

with cats as (select id, code from public.feature_categories)
insert into public.feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order) values
  -- Attendance features
  ('manual_attendance', 'Manual Attendance', 'Manual check-in via staff', (select id from cats where code = 'attendance'), 'boolean', 'true', 1),
  ('qr_attendance', 'QR Attendance', 'QR code based check-in', (select id from cats where code = 'attendance'), 'boolean', 'false', 2),
  ('dynamic_qr_attendance', 'Dynamic QR Attendance', 'Time-based dynamic QR codes', (select id from cats where code = 'attendance'), 'boolean', 'false', 3),
  ('trainer_attendance', 'Trainer Attendance', 'Trainer-specific attendance tracking', (select id from cats where code = 'attendance'), 'boolean', 'false', 4),
  ('staff_attendance', 'Staff Attendance', 'Staff-specific attendance tracking', (select id from cats where code = 'attendance'), 'boolean', 'false', 5),
  ('branch_attendance', 'Branch Attendance', 'Per-branch attendance views', (select id from cats where code = 'attendance'), 'boolean', 'false', 6),
  ('biometric_attendance', 'Biometric Attendance', 'Biometric device integration', (select id from cats where code = 'attendance'), 'boolean', 'false', 7),
  ('fingerprint_attendance', 'Fingerprint Attendance', 'Fingerprint scanner integration', (select id from cats where code = 'attendance'), 'boolean', 'false', 8),
  ('rfid_attendance', 'RFID Attendance', 'RFID card/tag check-in', (select id from cats where code = 'attendance'), 'boolean', 'false', 10),
  ('nfc_attendance', 'NFC Attendance', 'NFC tap check-in', (select id from cats where code = 'attendance'), 'boolean', 'false', 11),
  ('geo_fencing_attendance', 'Geo-Fencing Attendance', 'Location-based geo-fence check-in', (select id from cats where code = 'attendance'), 'boolean', 'false', 12),
  ('attendance_api', 'Attendance API', 'Programmatic attendance via API', (select id from cats where code = 'attendance'), 'boolean', 'false', 13),
  ('attendance_reports', 'Attendance Reports', 'Attendance analytics and reports', (select id from cats where code = 'attendance'), 'boolean', 'false', 14),

  -- Membership features
  ('member_management', 'Member Management', 'Full member lifecycle management', (select id from cats where code = 'membership'), 'boolean', 'true', 1),
  ('membership_renewals', 'Membership Renewals', 'Automated membership renewal processing', (select id from cats where code = 'membership'), 'boolean', 'false', 2),
  ('expiry_tracking', 'Expiry Tracking', 'Membership expiry alerts and tracking', (select id from cats where code = 'membership'), 'boolean', 'false', 3),
  ('goal_tracking', 'Goal Tracking', 'Member fitness goal setting and tracking', (select id from cats where code = 'membership'), 'boolean', 'false', 4),
  ('progress_photos', 'Progress Photos', 'Member progress photo management', (select id from cats where code = 'membership'), 'boolean', 'false', 5),

  -- CRM features
  ('lead_management', 'Lead Management', 'Lead capture, tracking, and conversion', (select id from cats where code = 'crm'), 'boolean', 'false', 1),
  ('trial_management', 'Trial Management', 'Free trial member management', (select id from cats where code = 'crm'), 'boolean', 'false', 2),

  -- Trainer features
  ('trainer_management', 'Trainer Management', 'Trainer profile and schedule management', (select id from cats where code = 'trainer'), 'boolean', 'true', 1),
  ('workout_assignment', 'Workout Assignment', 'Assign workout plans to members', (select id from cats where code = 'trainer'), 'boolean', 'false', 2),
  ('nutrition_plans', 'Nutrition Plans', 'Create and assign nutrition plans', (select id from cats where code = 'trainer'), 'boolean', 'false', 3),
  ('pt_sessions', 'PT Sessions', 'Personal training session scheduling', (select id from cats where code = 'trainer'), 'boolean', 'false', 4),
  ('class_booking', 'Class Booking', 'Member class booking system', (select id from cats where code = 'trainer'), 'boolean', 'false', 5),

  -- Billing features
  ('billing_invoices', 'Invoices', 'Invoice generation and management', (select id from cats where code = 'billing'), 'boolean', 'false', 1),
  ('receipts', 'Receipts', 'Payment receipt generation', (select id from cats where code = 'billing'), 'boolean', 'false', 2),
  ('payment_tracking', 'Payment Tracking', 'Payment status and history tracking', (select id from cats where code = 'billing'), 'boolean', 'false', 3),

  -- Reports features
  ('basic_reports', 'Basic Reports', 'Core business reports', (select id from cats where code = 'reports'), 'boolean', 'false', 1),
  ('advanced_reports', 'Advanced Reports', 'Advanced analytics and BI', (select id from cats where code = 'reports'), 'boolean', 'false', 2),

  -- Communication features
  ('email_notifications', 'Email Notifications', 'Email-based member notifications', (select id from cats where code = 'communication'), 'boolean', 'false', 1),
  ('in_app_notifications', 'In-App Notifications', 'In-application notification center', (select id from cats where code = 'communication'), 'boolean', 'false', 2),
  ('whatsapp_integration', 'WhatsApp Integration', 'WhatsApp messaging integration', (select id from cats where code = 'communication'), 'boolean', 'false', 3),
  ('sms_integration', 'SMS Integration', 'SMS text messaging integration', (select id from cats where code = 'communication'), 'boolean', 'false', 4),

  -- Portal features
  ('member_portal', 'Member Portal', 'Self-service member web portal', (select id from cats where code = 'platform'), 'boolean', 'false', 1),
  ('trainer_portal', 'Trainer Portal', 'Trainer web portal', (select id from cats where code = 'platform'), 'boolean', 'false', 2),

  -- AI features
  ('ai_recommendations', 'AI Recommendations', 'AI-powered workout and nutrition recommendations', (select id from cats where code = 'ai'), 'boolean', 'false', 1),
  ('ai_coach', 'AI Coach', 'AI-powered virtual coaching assistant', (select id from cats where code = 'ai'), 'boolean', 'false', 2),
  ('ai_retention_analysis', 'AI Retention Analysis', 'AI-powered member churn prediction', (select id from cats where code = 'ai'), 'boolean', 'false', 3),
  ('ai_revenue_insights', 'AI Revenue Insights', 'AI-powered revenue optimization insights', (select id from cats where code = 'ai'), 'boolean', 'false', 4),

  -- White Label features
  ('white_label', 'White Label', 'Remove platform branding', (select id from cats where code = 'white_label'), 'boolean', 'false', 1),
  ('custom_domain', 'Custom Domain', 'Custom domain support', (select id from cats where code = 'white_label'), 'boolean', 'false', 2),
  ('custom_branding', 'Custom Branding', 'Custom logo, colors, and theme', (select id from cats where code = 'white_label'), 'boolean', 'false', 3),

  -- Enterprise features
  ('multi_branch_management', 'Multi Branch Management', 'Manage multiple branches', (select id from cats where code = 'enterprise'), 'boolean', 'false', 2),
  ('api_access', 'API Access', 'REST API access for integrations', (select id from cats where code = 'enterprise'), 'boolean', 'false', 3),
  ('webhooks', 'Webhooks', 'Webhook event notifications', (select id from cats where code = 'enterprise'), 'boolean', 'false', 4),
  ('audit_logs', 'Audit Logs', 'Full audit trail of platform actions', (select id from cats where code = 'enterprise'), 'boolean', 'false', 5),
  ('advanced_rbac', 'Advanced RBAC', 'Role-based access control with custom roles', (select id from cats where code = 'enterprise'), 'boolean', 'false', 6),
  ('priority_support', 'Priority Support', 'Priority customer support SLA', (select id from cats where code = 'enterprise'), 'boolean', 'false', 7)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

-- ════════════════════════════════════════════════════════════════════════════
-- LIMIT CODES reference table (for documentation and validation)
-- ════════════════════════════════════════════════════════════════════════════
-- Limits are stored in package_limits with these canonical codes:
--   max_members   — maximum member accounts (-1 = unlimited)
--   max_branches  — maximum branches (-1 = unlimited)
--   max_gyms      — maximum gyms (-1 = unlimited)
--   max_trainers  — maximum trainer accounts (-1 = unlimited)
--   max_staff     — maximum staff accounts (-1 = unlimited)
--   max_storage_gb — maximum storage in GB (-1 = unlimited)
--   max_api_calls — monthly API call limit (-1 = unlimited)
--   max_monthly_revenue — maximum monthly transaction volume
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- Make old boolean columns nullable (data now lives in package_features)
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  col text;
begin
  for col in select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'packages'
    and column_name in (
      'max_members', 'max_branches', 'max_gyms', 'max_trainers',
      'max_storage_gb', 'max_api_calls', 'trial_days', 'price',
      'qr_attendance_enabled', 'biometric_attendance_enabled',
      'rfid_attendance_enabled', 'class_scheduling_enabled',
      'trainer_assignment_enabled', 'razorpay_enabled',
      'communications_enabled', 'ai_enabled', 'advanced_reports_enabled',
      'custom_domain_enabled', 'api_access_enabled', 'notifications_enabled',
      'white_label_enabled', 'recommended'
    )
    and is_nullable = 'NO'
  loop
    execute format('alter table public.packages alter column %I drop not null', col);
    execute format('alter table public.packages alter column %I set default null', col);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- MIGRATE EXISTING PACKAGE DATA TO NEW TABLES
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  p record;
begin
  for p in select * from public.packages loop
    -- Migrate features (from old boolean columns to package_features)
    insert into public.package_features (package_id, feature_code, value) values
      (p.id, 'manual_attendance', to_jsonb(true)),
      (p.id, 'qr_attendance', to_jsonb(coalesce(p.qr_attendance_enabled, false))),
      (p.id, 'biometric_attendance', to_jsonb(coalesce(p.biometric_attendance_enabled, false))),
      (p.id, 'rfid_attendance', to_jsonb(coalesce(p.rfid_attendance_enabled, false))),
      (p.id, 'member_management', to_jsonb(true)),
      (p.id, 'trainer_management', to_jsonb(true)),
      (p.id, 'billing_invoices', to_jsonb(coalesce(p.razorpay_enabled, false))),
      (p.id, 'receipts', to_jsonb(coalesce(p.razorpay_enabled, false))),
      (p.id, 'payment_tracking', to_jsonb(coalesce(p.razorpay_enabled, false))),
      (p.id, 'basic_reports', to_jsonb(true)),
      (p.id, 'advanced_reports', to_jsonb(coalesce(p.advanced_reports_enabled, false))),
      (p.id, 'email_notifications', to_jsonb(true)),
      (p.id, 'in_app_notifications', to_jsonb(true)),
      (p.id, 'member_portal', to_jsonb(true)),
      (p.id, 'trainer_portal', to_jsonb(true)),
      (p.id, 'workout_assignment', to_jsonb(coalesce(p.trainer_assignment_enabled, false))),
      (p.id, 'class_booking', to_jsonb(coalesce(p.class_scheduling_enabled, false))),
      (p.id, 'ai_recommendations', to_jsonb(coalesce(p.ai_enabled, false))),
      (p.id, 'custom_domain', to_jsonb(coalesce(p.custom_domain_enabled, false))),
      (p.id, 'api_access', to_jsonb(coalesce(p.api_access_enabled, false))),
      (p.id, 'white_label', to_jsonb(false)),
      (p.id, 'lead_management', to_jsonb(false)),
      (p.id, 'trial_management', to_jsonb(false)),
      (p.id, 'nutrition_plans', to_jsonb(false)),
      (p.id, 'pt_sessions', to_jsonb(false)),
      (p.id, 'goal_tracking', to_jsonb(false)),
      (p.id, 'progress_photos', to_jsonb(false)),
      (p.id, 'whatsapp_integration', to_jsonb(false)),
      (p.id, 'sms_integration', to_jsonb(false)),
      (p.id, 'webhooks', to_jsonb(false)),
      (p.id, 'audit_logs', to_jsonb(false)),
      (p.id, 'advanced_rbac', to_jsonb(false)),
      (p.id, 'priority_support', to_jsonb(false)),
      (p.id, 'ai_coach', to_jsonb(false)),
      (p.id, 'ai_retention_analysis', to_jsonb(false)),
      (p.id, 'ai_revenue_insights', to_jsonb(false)),
      (p.id, 'multi_branch_management', to_jsonb(false)),
      (p.id, 'custom_branding', to_jsonb(false)),
      (p.id, 'dynamic_qr_attendance', to_jsonb(false)),
      (p.id, 'trainer_attendance', to_jsonb(false)),
      (p.id, 'staff_attendance', to_jsonb(false)),
      (p.id, 'branch_attendance', to_jsonb(false)),
      (p.id, 'fingerprint_attendance', to_jsonb(false)),
      (p.id, 'nfc_attendance', to_jsonb(false)),
      (p.id, 'geo_fencing_attendance', to_jsonb(false)),
      (p.id, 'attendance_api', to_jsonb(false)),
      (p.id, 'attendance_reports', to_jsonb(false)),
      (p.id, 'membership_renewals', to_jsonb(false)),
      (p.id, 'expiry_tracking', to_jsonb(false)),
      (p.id, 'staff_management', to_jsonb(false))
    on conflict (package_id, feature_code) do update set value = excluded.value;

    -- Migrate limits (from old columns to package_limits)
    insert into public.package_limits (package_id, limit_code, label, value, sort_order) values
      (p.id, 'max_members', 'Maximum Members', coalesce(p.max_members, 0), 1),
      (p.id, 'max_branches', 'Maximum Branches', coalesce(p.max_branches, 0), 2),
      (p.id, 'max_gyms', 'Maximum Gyms', coalesce(p.max_gyms, 1), 3),
      (p.id, 'max_trainers', 'Maximum Trainers', coalesce(p.max_trainers, 0), 4),
      (p.id, 'max_staff', 'Maximum Staff', 0, 5),
      (p.id, 'max_storage_gb', 'Storage Limit (GB)', coalesce(p.max_storage_gb, 0), 6),
      (p.id, 'max_api_calls', 'Monthly API Calls', coalesce(p.max_api_calls, 0), 7)
    on conflict (package_id, limit_code) do update set
      value = excluded.value, label = excluded.label;

    -- Migrate pricing
    insert into public.package_pricing (package_id, billing_period, price, currency)
    values (p.id, coalesce(p.billing_period, 'monthly'), coalesce(p.price, 0), coalesce(p.currency, 'INR'))
    on conflict (package_id, billing_period) do update set price = excluded.price;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- SEED STARTER PACKAGE
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_pkg_id uuid;
begin
  -- Create or update Starter package
  insert into public.packages (name, slug, description, is_active, trial_days, color, icon)
  values (
    'Starter',
    'starter',
    'Essential tools for single-branch gyms. Includes QR attendance, member management, basic reports, and billing.',
    true, 14, '#16a34a', 'rocket'
  )
  on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    is_active = excluded.is_active,
    trial_days = excluded.trial_days,
    color = excluded.color,
    icon = excluded.icon
  returning id into v_pkg_id;

  -- Set sort_order separately to avoid unique constraint conflicts
  update public.packages set sort_order = 10 where id = v_pkg_id and sort_order is distinct from 10;

  -- If it was inserted fresh (not an update of existing), set the features
  if not found then
    -- Get the id from the table
    select id into v_pkg_id from public.packages where slug = 'starter';
  end if;

  -- Set Starter features
  insert into public.package_features (package_id, feature_code, value) values
    -- Attendance
    (v_pkg_id, 'manual_attendance', 'true'),
    (v_pkg_id, 'qr_attendance', 'true'),
    (v_pkg_id, 'attendance_reports', 'true'),
    -- Membership
    (v_pkg_id, 'member_management', 'true'),
    (v_pkg_id, 'membership_renewals', 'true'),
    (v_pkg_id, 'expiry_tracking', 'true'),
    -- Trainer
    (v_pkg_id, 'trainer_management', 'true'),
    (v_pkg_id, 'workout_assignment', 'true'),
    -- Billing
    (v_pkg_id, 'billing_invoices', 'true'),
    (v_pkg_id, 'receipts', 'true'),
    (v_pkg_id, 'payment_tracking', 'true'),
    -- Reports
    (v_pkg_id, 'basic_reports', 'true'),
    -- Communication
    (v_pkg_id, 'email_notifications', 'true'),
    (v_pkg_id, 'in_app_notifications', 'true'),
    -- Portals
    (v_pkg_id, 'member_portal', 'true'),
    (v_pkg_id, 'trainer_portal', 'true')
  on conflict (package_id, feature_code) do update set value = excluded.value;

  -- Set Starter limits
  insert into public.package_limits (package_id, limit_code, label, value, sort_order) values
    (v_pkg_id, 'max_gyms', 'Maximum Gyms', 1, 1),
    (v_pkg_id, 'max_branches', 'Maximum Branches', 1, 2),
    (v_pkg_id, 'max_members', 'Maximum Members', 500, 3),
    (v_pkg_id, 'max_trainers', 'Maximum Trainers', 10, 4),
    (v_pkg_id, 'max_staff', 'Maximum Staff', 5, 5),
    (v_pkg_id, 'max_storage_gb', 'Storage Limit (GB)', 5, 6),
    (v_pkg_id, 'max_api_calls', 'Monthly API Calls', 0, 7)
  on conflict (package_id, limit_code) do update set value = excluded.value, label = excluded.label;

  -- Set Starter pricing
  insert into public.package_pricing (package_id, billing_period, price, currency) values
    (v_pkg_id, 'monthly', 149900, 'INR'),
    (v_pkg_id, 'annual', 1499900, 'INR')
  on conflict (package_id, billing_period) do update set price = excluded.price;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- SEED GROWTH PACKAGE
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_pkg_id uuid;
begin
  insert into public.packages (name, slug, description, is_active, trial_days, color, icon)
  values (
    'Growth',
    'growth',
    'Complete solution for growing multi-branch gyms. Includes dynamic QR, RFID, NFC, lead management, AI recommendations, and advanced reports.',
    true, 14, '#2563eb', 'trending-up'
  )
  on conflict (slug) do update set
    name = excluded.name, description = excluded.description, is_active = excluded.is_active,
    trial_days = excluded.trial_days,
    color = excluded.color, icon = excluded.icon
  returning id into v_pkg_id;

  if not found then
    select id into v_pkg_id from public.packages where slug = 'growth';
  end if;

  update public.packages set sort_order = 20 where id = v_pkg_id and sort_order is distinct from 20;

  -- Growth = Starter + extra features
  insert into public.package_features (package_id, feature_code, value) values
    -- Starter features
    (v_pkg_id, 'manual_attendance', 'true'),
    (v_pkg_id, 'qr_attendance', 'true'),
    (v_pkg_id, 'attendance_reports', 'true'),
    (v_pkg_id, 'member_management', 'true'),
    (v_pkg_id, 'membership_renewals', 'true'),
    (v_pkg_id, 'expiry_tracking', 'true'),
    (v_pkg_id, 'trainer_management', 'true'),
    (v_pkg_id, 'workout_assignment', 'true'),
    (v_pkg_id, 'billing_invoices', 'true'),
    (v_pkg_id, 'receipts', 'true'),
    (v_pkg_id, 'payment_tracking', 'true'),
    (v_pkg_id, 'basic_reports', 'true'),
    (v_pkg_id, 'email_notifications', 'true'),
    (v_pkg_id, 'in_app_notifications', 'true'),
    (v_pkg_id, 'member_portal', 'true'),
    (v_pkg_id, 'trainer_portal', 'true'),
    -- Growth-exclusive attendance
    (v_pkg_id, 'dynamic_qr_attendance', 'true'),
    (v_pkg_id, 'trainer_attendance', 'true'),
    (v_pkg_id, 'staff_attendance', 'true'),
    (v_pkg_id, 'branch_attendance', 'true'),
    (v_pkg_id, 'rfid_attendance', 'true'),
    (v_pkg_id, 'nfc_attendance', 'true'),
    -- Growth CRM
    (v_pkg_id, 'lead_management', 'true'),
    (v_pkg_id, 'trial_management', 'true'),
    -- Growth Trainer
    (v_pkg_id, 'nutrition_plans', 'true'),
    (v_pkg_id, 'pt_sessions', 'true'),
    (v_pkg_id, 'class_booking', 'true'),
    (v_pkg_id, 'goal_tracking', 'true'),
    (v_pkg_id, 'progress_photos', 'true'),
    -- Growth Communication
    (v_pkg_id, 'whatsapp_integration', 'true'),
    (v_pkg_id, 'sms_integration', 'true'),
    -- Growth AI
    (v_pkg_id, 'ai_recommendations', 'true'),
    -- Growth Reports
    (v_pkg_id, 'advanced_reports', 'true'),
    -- Growth Enterprise
    (v_pkg_id, 'multi_branch_management', 'true')
  on conflict (package_id, feature_code) do update set value = excluded.value;

  insert into public.package_limits (package_id, limit_code, label, value, sort_order) values
    (v_pkg_id, 'max_gyms', 'Maximum Gyms', 5, 1),
    (v_pkg_id, 'max_branches', 'Maximum Branches', 10, 2),
    (v_pkg_id, 'max_members', 'Maximum Members', 5000, 3),
    (v_pkg_id, 'max_trainers', 'Maximum Trainers', 100, 4),
    (v_pkg_id, 'max_staff', 'Maximum Staff', 50, 5),
    (v_pkg_id, 'max_storage_gb', 'Storage Limit (GB)', 50, 6),
    (v_pkg_id, 'max_api_calls', 'Monthly API Calls', 10000, 7)
  on conflict (package_id, limit_code) do update set value = excluded.value, label = excluded.label;

  insert into public.package_pricing (package_id, billing_period, price, currency) values
    (v_pkg_id, 'monthly', 399900, 'INR'),
    (v_pkg_id, 'annual', 3999900, 'INR')
  on conflict (package_id, billing_period) do update set price = excluded.price;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- SEED ENTERPRISE PACKAGE
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_pkg_id uuid;
begin
  insert into public.packages (name, slug, description, is_active, trial_days, color, icon, metadata)
  values (
    'Enterprise',
    'enterprise',
    'Unlimited everything for large fitness enterprises. Includes biometric attendance, face recognition, white label, franchise management, AI coach, and priority support.',
    true, 30, '#7c3aed', 'crown',
    '{"recommended": true}'::jsonb
  )
  on conflict (slug) do update set
    name = excluded.name, description = excluded.description, is_active = excluded.is_active,
    trial_days = excluded.trial_days,
    color = excluded.color, icon = excluded.icon, metadata = excluded.metadata
  returning id into v_pkg_id;

  if not found then
    select id into v_pkg_id from public.packages where slug = 'enterprise';
  end if;

  update public.packages set sort_order = 30 where id = v_pkg_id and sort_order is distinct from 30;

  -- Enterprise = Growth + all premium features
  insert into public.package_features (package_id, feature_code, value) values
    -- All features enabled
    (v_pkg_id, 'manual_attendance', 'true'),
    (v_pkg_id, 'qr_attendance', 'true'),
    (v_pkg_id, 'dynamic_qr_attendance', 'true'),
    (v_pkg_id, 'trainer_attendance', 'true'),
    (v_pkg_id, 'staff_attendance', 'true'),
    (v_pkg_id, 'branch_attendance', 'true'),
    (v_pkg_id, 'biometric_attendance', 'true'),
    (v_pkg_id, 'fingerprint_attendance', 'true'),
    (v_pkg_id, 'rfid_attendance', 'true'),
    (v_pkg_id, 'nfc_attendance', 'true'),
    (v_pkg_id, 'geo_fencing_attendance', 'true'),
    (v_pkg_id, 'attendance_api', 'true'),
    (v_pkg_id, 'attendance_reports', 'true'),
    (v_pkg_id, 'member_management', 'true'),
    (v_pkg_id, 'membership_renewals', 'true'),
    (v_pkg_id, 'expiry_tracking', 'true'),
    (v_pkg_id, 'lead_management', 'true'),
    (v_pkg_id, 'trial_management', 'true'),
    (v_pkg_id, 'trainer_management', 'true'),
    (v_pkg_id, 'workout_assignment', 'true'),
    (v_pkg_id, 'nutrition_plans', 'true'),
    (v_pkg_id, 'pt_sessions', 'true'),
    (v_pkg_id, 'class_booking', 'true'),
    (v_pkg_id, 'goal_tracking', 'true'),
    (v_pkg_id, 'progress_photos', 'true'),
    (v_pkg_id, 'billing_invoices', 'true'),
    (v_pkg_id, 'receipts', 'true'),
    (v_pkg_id, 'payment_tracking', 'true'),
    (v_pkg_id, 'basic_reports', 'true'),
    (v_pkg_id, 'advanced_reports', 'true'),
    (v_pkg_id, 'email_notifications', 'true'),
    (v_pkg_id, 'in_app_notifications', 'true'),
    (v_pkg_id, 'whatsapp_integration', 'true'),
    (v_pkg_id, 'sms_integration', 'true'),
    (v_pkg_id, 'member_portal', 'true'),
    (v_pkg_id, 'trainer_portal', 'true'),
    (v_pkg_id, 'ai_recommendations', 'true'),
    (v_pkg_id, 'ai_coach', 'true'),
    (v_pkg_id, 'ai_retention_analysis', 'true'),
    (v_pkg_id, 'ai_revenue_insights', 'true'),
    (v_pkg_id, 'white_label', 'true'),
    (v_pkg_id, 'custom_domain', 'true'),
    (v_pkg_id, 'custom_branding', 'true'),
    (v_pkg_id, 'multi_branch_management', 'true'),
    (v_pkg_id, 'api_access', 'true'),
    (v_pkg_id, 'webhooks', 'true'),
    (v_pkg_id, 'audit_logs', 'true'),
    (v_pkg_id, 'advanced_rbac', 'true'),
    (v_pkg_id, 'priority_support', 'true'),
    (v_pkg_id, 'staff_management', 'true')
  on conflict (package_id, feature_code) do update set value = excluded.value;

  insert into public.package_limits (package_id, limit_code, label, value, sort_order) values
    (v_pkg_id, 'max_gyms', 'Maximum Gyms', -1, 1),
    (v_pkg_id, 'max_branches', 'Maximum Branches', -1, 2),
    (v_pkg_id, 'max_members', 'Maximum Members', -1, 3),
    (v_pkg_id, 'max_trainers', 'Maximum Trainers', -1, 4),
    (v_pkg_id, 'max_staff', 'Maximum Staff', -1, 5),
    (v_pkg_id, 'max_storage_gb', 'Storage Limit (GB)', -1, 6),
    (v_pkg_id, 'max_api_calls', 'Monthly API Calls', -1, 7)
  on conflict (package_id, limit_code) do update set value = excluded.value, label = excluded.label;

  insert into public.package_pricing (package_id, billing_period, price, currency) values
    (v_pkg_id, 'monthly', 999900, 'INR'),
    (v_pkg_id, 'annual', 9999900, 'INR')
  on conflict (package_id, billing_period) do update set price = excluded.price;
end $$;
