-- Phase 1 multi-tenant foundation.
-- Adds an explicit domain registry and public-safe tenant resolver used by
-- the host-based middleware in the next phase.

create or replace function public.normalize_tenant_domain(input_domain text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(trim(coalesce(input_domain, ''))), '^https?://', ''),
            '[/?#].*$',
            ''
          ),
          ':\d+$',
          ''
        ),
        '^www\.',
        ''
      ),
      '\.$',
      ''
    ),
    ''
  );
$$;

alter table public.gyms
add column if not exists organization_id uuid null references public.organizations(id) on delete set null;

create index if not exists gyms_organization_id_idx on public.gyms (organization_id);

create unique index if not exists organizations_primary_domain_unique_idx
on public.organizations (public.normalize_tenant_domain(primary_domain))
where primary_domain is not null;

create unique index if not exists tenant_configs_custom_domain_unique_idx
on public.tenant_configs (public.normalize_tenant_domain(custom_domain))
where custom_domain is not null;

create unique index if not exists tenant_configs_full_subdomain_unique_idx
on public.tenant_configs (public.normalize_tenant_domain(subdomain))
where subdomain is not null and position('.' in subdomain) > 0;

create table if not exists public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete set null,
  gym_id uuid null references public.gyms(id) on delete set null,
  tenant_config_id uuid null references public.tenant_configs(id) on delete set null,
  domain text not null check (char_length(domain) between 3 and 253),
  normalized_domain text generated always as (public.normalize_tenant_domain(domain)) stored,
  domain_type text not null default 'custom_domain' check (domain_type in ('custom_domain', 'subdomain', 'system')),
  routing_mode text not null default 'organization' check (routing_mode in ('organization', 'branch', 'gym')),
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed', 'disabled')),
  is_primary boolean not null default false,
  ssl_status text not null default 'pending' check (ssl_status in ('pending', 'issued', 'failed', 'managed_by_vercel', 'not_applicable')),
  verification_token text not null default replace(gen_random_uuid()::text, '-', ''),
  verified_at timestamptz null,
  last_checked_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (normalized_domain is not null),
  check (normalized_domain ~ '^(localhost|([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})$'),
  check (routing_mode <> 'branch' or branch_id is not null),
  check (routing_mode <> 'gym' or gym_id is not null)
);

create unique index if not exists tenant_domains_normalized_domain_idx
on public.tenant_domains (normalized_domain);

create unique index if not exists tenant_domains_primary_per_org_idx
on public.tenant_domains (organization_id)
where is_primary = true and status <> 'disabled';

create index if not exists tenant_domains_org_status_idx
on public.tenant_domains (organization_id, status, domain_type);

create index if not exists tenant_domains_branch_status_idx
on public.tenant_domains (branch_id, status)
where branch_id is not null;

create index if not exists tenant_domains_gym_status_idx
on public.tenant_domains (gym_id, status)
where gym_id is not null;

drop trigger if exists set_tenant_domains_updated_at on public.tenant_domains;
create trigger set_tenant_domains_updated_at
before update on public.tenant_domains
for each row execute function public.set_updated_at();

alter table public.tenant_domains enable row level security;

grant select, insert, update, delete on public.tenant_domains to authenticated;

drop policy if exists "tenant domains visible by organization" on public.tenant_domains;
create policy "tenant domains visible by organization"
on public.tenant_domains for select to authenticated
using (public.can_access_organization(organization_id));

drop policy if exists "tenant domains manageable by managers" on public.tenant_domains;
create policy "tenant domains manageable by managers"
on public.tenant_domains for all to authenticated
using (public.can_manage_organization(organization_id))
with check (public.can_manage_organization(organization_id));

create or replace function public.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select coalesce(g.organization_id, b.organization_id)
      from public.profiles p
      left join public.gyms g on g.id = p.gym_id
      left join public.branches b on b.gym_id = p.gym_id
      where p.id = (select auth.uid())
      limit 1
    ),
    (
      select bu.organization_id
      from public.branch_users bu
      where bu.user_id = (select auth.uid())
        and bu.status = 'active'
      order by
        case bu.branch_role
          when 'owner' then 1
          when 'admin' then 2
          when 'manager' then 3
          when 'staff' then 4
          when 'trainer' then 5
          else 6
        end,
        bu.created_at
      limit 1
    )
  );
$$;

create or replace function public.resolve_tenant_by_host(request_host text)
returns table (
  organization_id uuid,
  branch_id uuid,
  gym_id uuid,
  tenant_config_id uuid,
  tenant_key text,
  domain text,
  domain_type text,
  routing_mode text,
  plan_tier text,
  tenant_status text,
  organization_status text,
  branch_status text,
  brand_name text,
  logo_url text,
  favicon_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  typography jsonb,
  email_branding jsonb,
  feature_overrides jsonb,
  limits jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select public.normalize_tenant_domain(request_host) as host
  )
  select
    d.organization_id,
    d.branch_id,
    coalesce(d.gym_id, b.gym_id) as gym_id,
    tc.id as tenant_config_id,
    tc.tenant_key,
    d.normalized_domain as domain,
    d.domain_type,
    d.routing_mode,
    tc.plan_tier,
    tc.status as tenant_status,
    o.status as organization_status,
    b.status as branch_status,
    tc.brand_name,
    tc.logo_url,
    tc.favicon_url,
    tc.primary_color,
    tc.secondary_color,
    tc.accent_color,
    tc.typography,
    tc.email_branding,
    tc.feature_overrides,
    tc.limits
  from normalized n
  join public.tenant_domains d on d.normalized_domain = n.host
  join public.organizations o on o.id = d.organization_id
  left join public.branches b on b.id = d.branch_id
  left join public.tenant_configs tc
    on tc.organization_id = d.organization_id
   and (d.tenant_config_id is null or tc.id = d.tenant_config_id)
  where n.host is not null
    and d.status = 'verified'
    and o.status in ('active', 'trial')
    and (b.id is null or b.status in ('active', 'planned', 'maintenance'))
    and (tc.id is null or tc.status in ('active', 'trial'))
  order by d.is_primary desc, d.verified_at desc nulls last, d.created_at desc
  limit 1;
$$;

grant execute on function public.normalize_tenant_domain(text) to anon, authenticated, service_role;
grant execute on function public.current_user_organization_id() to authenticated;
grant execute on function public.resolve_tenant_by_host(text) to anon, authenticated, service_role;

create or replace function public.sync_tenant_config_domains()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  custom_status text;
  custom_ssl_status text;
  custom_verified_at timestamptz;
begin
  if tg_op = 'UPDATE' and old.custom_domain is not null and old.custom_domain is distinct from new.custom_domain then
    update public.tenant_domains
    set status = 'disabled', is_primary = false, updated_at = now()
    where tenant_config_id = new.id
      and domain_type = 'custom_domain'
      and normalized_domain = public.normalize_tenant_domain(old.custom_domain);
  end if;

  if tg_op = 'UPDATE' and old.subdomain is not null and old.subdomain is distinct from new.subdomain then
    update public.tenant_domains
    set status = 'disabled', is_primary = false, updated_at = now()
    where tenant_config_id = new.id
      and domain_type = 'subdomain'
      and normalized_domain = public.normalize_tenant_domain(old.subdomain);
  end if;

  custom_status := case when new.domain_status = 'verified' then 'verified' else 'pending' end;
  custom_ssl_status := case when new.domain_status = 'verified' then 'managed_by_vercel' else 'pending' end;
  custom_verified_at := case when new.domain_status = 'verified' then coalesce(new.updated_at, now()) else null end;

  if new.custom_domain is not null and public.normalize_tenant_domain(new.custom_domain) is not null then
    update public.tenant_domains
    set is_primary = false, updated_at = now()
    where organization_id = new.organization_id
      and normalized_domain <> public.normalize_tenant_domain(new.custom_domain);

    insert into public.tenant_domains (
      organization_id,
      tenant_config_id,
      domain,
      domain_type,
      routing_mode,
      status,
      is_primary,
      ssl_status,
      verified_at,
      created_by
    )
    values (
      new.organization_id,
      new.id,
      new.custom_domain,
      'custom_domain',
      'organization',
      custom_status,
      true,
      custom_ssl_status,
      custom_verified_at,
      new.updated_by
    )
    on conflict (normalized_domain) do update
    set
      organization_id = excluded.organization_id,
      tenant_config_id = excluded.tenant_config_id,
      domain_type = excluded.domain_type,
      routing_mode = excluded.routing_mode,
      status = excluded.status,
      is_primary = excluded.is_primary,
      ssl_status = excluded.ssl_status,
      verified_at = excluded.verified_at,
      updated_at = now();
  end if;

  if new.subdomain is not null
    and position('.' in new.subdomain) > 0
    and public.normalize_tenant_domain(new.subdomain) is not null then
    insert into public.tenant_domains (
      organization_id,
      tenant_config_id,
      domain,
      domain_type,
      routing_mode,
      status,
      is_primary,
      ssl_status,
      verified_at,
      created_by
    )
    values (
      new.organization_id,
      new.id,
      new.subdomain,
      'subdomain',
      'organization',
      custom_status,
      false,
      custom_ssl_status,
      custom_verified_at,
      new.updated_by
    )
    on conflict (normalized_domain) do update
    set
      organization_id = excluded.organization_id,
      tenant_config_id = excluded.tenant_config_id,
      domain_type = excluded.domain_type,
      routing_mode = excluded.routing_mode,
      status = excluded.status,
      ssl_status = excluded.ssl_status,
      verified_at = excluded.verified_at,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists sync_tenant_config_domains on public.tenant_configs;
create trigger sync_tenant_config_domains
after insert or update of custom_domain, subdomain, domain_status, status on public.tenant_configs
for each row execute function public.sync_tenant_config_domains();

create or replace function public.sync_organization_primary_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.primary_domain is not null and old.primary_domain is distinct from new.primary_domain then
    update public.tenant_domains
    set status = 'disabled', is_primary = false, updated_at = now()
    where organization_id = new.id
      and normalized_domain = public.normalize_tenant_domain(old.primary_domain);
  end if;

  if new.primary_domain is not null and public.normalize_tenant_domain(new.primary_domain) is not null then
    update public.tenant_domains
    set is_primary = false, updated_at = now()
    where organization_id = new.id
      and normalized_domain <> public.normalize_tenant_domain(new.primary_domain);

    insert into public.tenant_domains (
      organization_id,
      domain,
      domain_type,
      routing_mode,
      status,
      is_primary,
      ssl_status,
      created_by
    )
    values (
      new.id,
      new.primary_domain,
      'custom_domain',
      'organization',
      'pending',
      true,
      'pending',
      new.created_by
    )
    on conflict (normalized_domain) do update
    set
      organization_id = excluded.organization_id,
      routing_mode = excluded.routing_mode,
      is_primary = excluded.is_primary,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists sync_organization_primary_domain on public.organizations;
create trigger sync_organization_primary_domain
after insert or update of primary_domain on public.organizations
for each row execute function public.sync_organization_primary_domain();

do $$
declare
  default_gym_id uuid;
  default_org_id uuid;
  default_branch_id uuid;
  default_tenant_config_id uuid;
begin
  insert into public.gyms (name, slug, timezone, currency, status)
  values ('Apex Performance Club', 'apex-performance-club', 'Asia/Kolkata', 'INR', 'active')
  on conflict (slug) do update
  set
    name = excluded.name,
    timezone = excluded.timezone,
    currency = excluded.currency,
    status = excluded.status,
    updated_at = now()
  returning id into default_gym_id;

  insert into public.organizations (
    name,
    slug,
    organization_type,
    status,
    primary_domain,
    billing_email,
    settings
  )
  values (
    'Apex Performance Club',
    'apex-performance-club',
    'single_gym',
    'active',
    'apexgymmanagementsystem.vercel.app',
    'hello@apexperformance.club',
    '{"source":"phase_1_default_tenant"}'::jsonb
  )
  on conflict (slug) do update
  set
    name = excluded.name,
    organization_type = excluded.organization_type,
    status = excluded.status,
    primary_domain = excluded.primary_domain,
    billing_email = excluded.billing_email,
    updated_at = now()
  returning id into default_org_id;

  update public.gyms
  set organization_id = default_org_id, updated_at = now()
  where id = default_gym_id;

  insert into public.branches (
    organization_id,
    gym_id,
    name,
    slug,
    branch_code,
    status,
    timezone,
    currency,
    address,
    city,
    state,
    country,
    phone,
    email,
    operating_hours,
    capacity
  )
  values (
    default_org_id,
    default_gym_id,
    'Baner Flagship',
    'baner-flagship',
    'APX-BANER',
    'active',
    'Asia/Kolkata',
    'INR',
    'Level 2, Meridian Fitness District, Baner',
    'Pune',
    'Maharashtra',
    'India',
    '+91 98765 43210',
    'hello@apexperformance.club',
    '{"mon_sat":"05:30-22:00","sun":"07:00-14:00"}'::jsonb,
    250
  )
  on conflict (organization_id, branch_code) do update
  set
    gym_id = excluded.gym_id,
    name = excluded.name,
    slug = excluded.slug,
    status = excluded.status,
    timezone = excluded.timezone,
    currency = excluded.currency,
    address = excluded.address,
    city = excluded.city,
    state = excluded.state,
    country = excluded.country,
    phone = excluded.phone,
    email = excluded.email,
    operating_hours = excluded.operating_hours,
    capacity = excluded.capacity,
    updated_at = now()
  returning id into default_branch_id;

  insert into public.tenant_configs (
    organization_id,
    tenant_key,
    plan_tier,
    status,
    custom_domain,
    brand_name,
    primary_color,
    secondary_color,
    accent_color,
    typography,
    email_branding,
    domain_status,
    feature_overrides,
    limits,
    compliance_settings
  )
  values (
    default_org_id,
    'apex-performance-club',
    'enterprise',
    'active',
    'apexgymmanagementsystem.vercel.app',
    'Apex Performance Club',
    '#111315',
    '#16a34a',
    '#d7ff3f',
    '{"heading":"Geist","body":"Geist"}'::jsonb,
    '{"from_name":"Apex Performance Club"}'::jsonb,
    'verified',
    '{}'::jsonb,
    '{"branches":5,"members":5000,"storage_mb":10240}'::jsonb,
    '{}'::jsonb
  )
  on conflict (organization_id) do update
  set
    tenant_key = excluded.tenant_key,
    plan_tier = excluded.plan_tier,
    status = excluded.status,
    custom_domain = excluded.custom_domain,
    brand_name = excluded.brand_name,
    primary_color = excluded.primary_color,
    secondary_color = excluded.secondary_color,
    accent_color = excluded.accent_color,
    typography = excluded.typography,
    email_branding = excluded.email_branding,
    domain_status = excluded.domain_status,
    feature_overrides = excluded.feature_overrides,
    limits = excluded.limits,
    compliance_settings = excluded.compliance_settings,
    updated_at = now()
  returning id into default_tenant_config_id;

  insert into public.tenant_domains (
    organization_id,
    branch_id,
    gym_id,
    tenant_config_id,
    domain,
    domain_type,
    routing_mode,
    status,
    is_primary,
    ssl_status,
    verified_at,
    metadata
  )
  values (
    default_org_id,
    default_branch_id,
    default_gym_id,
    default_tenant_config_id,
    'apexgymmanagementsystem.vercel.app',
    'system',
    'branch',
    'verified',
    true,
    'managed_by_vercel',
    now(),
    '{"source":"phase_1_default_tenant","platform":"vercel"}'::jsonb
  )
  on conflict (normalized_domain) do update
  set
    organization_id = excluded.organization_id,
    branch_id = excluded.branch_id,
    gym_id = excluded.gym_id,
    tenant_config_id = excluded.tenant_config_id,
    domain_type = excluded.domain_type,
    routing_mode = excluded.routing_mode,
    status = excluded.status,
    is_primary = excluded.is_primary,
    ssl_status = excluded.ssl_status,
    verified_at = coalesce(public.tenant_domains.verified_at, excluded.verified_at),
    metadata = public.tenant_domains.metadata || excluded.metadata,
    updated_at = now();

  update public.profiles
  set gym_id = default_gym_id, updated_at = now()
  where gym_id is null;

  update public.user_roles ur
  set gym_id = default_gym_id
  from public.roles r
  where ur.role_id = r.id
    and r.name <> 'super_admin'
    and ur.gym_id is null;
end $$;
