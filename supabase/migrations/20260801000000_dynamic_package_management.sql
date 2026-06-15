-- ════════════════════════════════════════════════════════════════════
-- Dynamic Package Management — Fully customizable SaaS packages
-- ════════════════════════════════════════════════════════════════════

-- 1. EXTEND packages table with pricing, billing, limits, and metadata
alter table public.packages add column if not exists slug text not null default '';
alter table public.packages add column if not exists short_description text null;
alter table public.packages add column if not exists monthly_price numeric(12,2) not null default 0;
alter table public.packages add column if not exists yearly_price numeric(12,2) not null default 0;
alter table public.packages add column if not exists setup_fee numeric(12,2) not null default 0;
alter table public.packages add column if not exists currency text not null default 'INR';
alter table public.packages add column if not exists trial_days integer not null default 0;
alter table public.packages add column if not exists discount_percentage numeric(5,2) not null default 0;
alter table public.packages add column if not exists billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'yearly', 'both'));
alter table public.packages add column if not exists is_public boolean not null default true;
alter table public.packages add column if not exists is_recommended boolean not null default false;
alter table public.packages add column if not exists is_popular boolean not null default false;
alter table public.packages add column if not exists max_trainers integer not null default -1;
alter table public.packages add column if not exists max_staff integer not null default -1;
alter table public.packages add column if not exists max_gyms integer not null default -1;
alter table public.packages add column if not exists max_leads integer not null default -1;
alter table public.packages add column if not exists max_storage_mb integer not null default 100;
alter table public.packages add column if not exists max_attendance_devices integer not null default -1;
alter table public.packages add column if not exists max_ai_requests integer not null default 0;
alter table public.packages add column if not exists max_sms integer not null default 0;
alter table public.packages add column if not exists max_emails integer not null default 0;
alter table public.packages add column if not exists max_whatsapp_messages integer not null default 0;
alter table public.packages add column if not exists max_custom_domains integer not null default 0;
alter table public.packages add column if not exists max_api_calls integer not null default 0;
alter table public.packages add column if not exists badge_text text null;
alter table public.packages add column if not exists badge_color text null default '#FF6B35';
alter table public.packages add column if not exists highlight_color text null;
alter table public.packages add column if not exists icon text null;
alter table public.packages add column if not exists marketing_points jsonb not null default '[]'::jsonb;
alter table public.packages add column if not exists internal_notes text null;
alter table public.packages add column if not exists terms text null;
alter table public.packages add column if not exists support_level text not null default 'standard' check (support_level in ('basic', 'standard', 'priority', 'enterprise'));
alter table public.packages add column if not exists version integer not null default 1;
alter table public.packages add column if not exists version_notes text null;

-- 2. Add unique constraint on slug
alter table public.packages add constraint packages_slug_key unique (slug);

-- 3. Package features registry
create table if not exists public.package_features (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  feature_key text not null,
  feature_name text not null,
  category text not null,
  enabled boolean not null default false,
  limit_value integer null,
  is_locked boolean not null default false,
  upgrade_message text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (package_id, feature_key)
);

-- 4. Package versions (for tracking changes)
create table if not exists public.package_versions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  change_notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 5. Package add-ons
create table if not exists public.package_addons (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  name text not null,
  description text null,
  monthly_price numeric(12,2) not null default 0,
  yearly_price numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 6. Indexes
create index if not exists idx_packages_active on public.packages(is_active, sort_order);
create index if not exists idx_packages_status on public.packages(is_active, is_public);
create index if not exists idx_package_features_package on public.package_features(package_id, sort_order);
create index if not exists idx_package_features_category on public.package_features(category);
create index if not exists idx_package_versions_package on public.package_versions(package_id, version desc);

-- 7. RLS
alter table public.package_features enable row level security;
alter table public.package_versions enable row level security;
alter table public.package_addons enable row level security;

create policy "super_admin manage package_features" on public.package_features
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "authenticated read package_features" on public.package_features
  for select to authenticated using (true);

create policy "super_admin manage package_versions" on public.package_versions
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "authenticated read package_versions" on public.package_versions
  for select to authenticated using (true);

create policy "super_admin manage package_addons" on public.package_addons
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "authenticated read package_addons" on public.package_addons
  for select to authenticated using (true);

grant select, insert, update, delete on public.package_features to authenticated;
grant select, insert on public.package_versions to authenticated;
grant select, insert, update, delete on public.package_addons to authenticated;

-- 8. Organization impact tracking for package changes
create table if not exists public.package_change_impacts (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  change_type text not null,
  description text not null,
  affected_orgs integer not null default 0,
  change_application text not null default 'new_only' check (change_application in ('new_only', 'all', 'new_version')),
  applied_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.package_change_impacts enable row level security;
create policy "super_admin manage change_impacts" on public.package_change_impacts
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
grant select, insert, update on public.package_change_impacts to authenticated;

-- 9. Update existing packages with slugs
update public.packages set slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) where slug = '' or slug is null;

-- 10. Backfill existing organization_subscriptions with expires_at if null
update public.organization_subscriptions set expires_at = started_at + interval '30 days' where expires_at is null;
