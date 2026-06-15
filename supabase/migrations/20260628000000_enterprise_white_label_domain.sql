-- Enterprise White Label & Custom Domain System

-- ════════════════════════════════════════════════════════════════════════
-- 1. Extend tenant_domains with verification and health fields
-- ════════════════════════════════════════════════════════════════════════

alter table public.tenant_domains add column if not exists verification_token text;
alter table public.tenant_domains add column if not exists verified_at timestamptz;
alter table public.tenant_domains add column if not exists ssl_status text default 'pending' check (ssl_status in ('pending', 'issuing', 'active', 'expired', 'failed'));
alter table public.tenant_domains add column if not exists ssl_expires_at timestamptz;
alter table public.tenant_domains add column if not exists dns_verified boolean not null default false;
alter table public.tenant_domains add column if not exists dns_records jsonb default '[]'::jsonb;
alter table public.tenant_domains add column if not exists health_status text default 'unknown' check (health_status in ('healthy', 'degraded', 'down', 'unknown'));
alter table public.tenant_domains add column if not exists last_health_check_at timestamptz;
alter table public.tenant_domains add column if not exists is_primary boolean not null default false;

comment on column public.tenant_domains.verification_token is 'Random token placed in DNS TXT record to verify ownership';
comment on column public.tenant_domains.ssl_status is 'Let''s Encrypt or custom SSL certificate status';
comment on column public.tenant_domains.dns_records is 'Expected DNS records (A, CNAME, TXT) for verification';
comment on column public.tenant_domains.health_status is 'Last known domain health status';

create index if not exists tenant_domains_verified_idx on public.tenant_domains (dns_verified, ssl_status);
create index if not exists tenant_domains_health_idx on public.tenant_domains (health_status);

-- ════════════════════════════════════════════════════════════════════════
-- 2. Domain audit log
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.domain_audit_logs (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid references public.tenant_domains(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null check (event_type in (
    'domain_added', 'domain_verified', 'domain_activated', 'domain_deactivated',
    'domain_removed', 'ssl_issued', 'ssl_expired', 'ssl_failed',
    'dns_verified', 'dns_failed', 'health_check_passed', 'health_check_failed',
    'primary_changed', 'redirect_configured'
  )),
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists domain_audit_domain_idx on public.domain_audit_logs (domain_id);
create index if not exists domain_audit_org_idx on public.domain_audit_logs (organization_id);

alter table public.domain_audit_logs enable row level security;
drop policy if exists "domain audit super admin" on public.domain_audit_logs;
create policy "domain audit super admin"
  on public.domain_audit_logs for select to authenticated
  using (public.is_super_admin());
drop policy if exists "domain audit org owner" on public.domain_audit_logs;
create policy "domain audit org owner"
  on public.domain_audit_logs for select to authenticated
  using (public.is_organization_owner(organization_id));

-- ════════════════════════════════════════════════════════════════════════
-- 3. RLS for tenant_domains
-- ════════════════════════════════════════════════════════════════════════

alter table public.tenant_domains enable row level security;
drop policy if exists "tenant domains super admin" on public.tenant_domains;
create policy "tenant domains super admin"
  on public.tenant_domains for select to authenticated
  using (public.is_super_admin());
drop policy if exists "tenant domains org owner" on public.tenant_domains;
create policy "tenant domains org owner"
  on public.tenant_domains for select to authenticated
  using (public.is_organization_owner(organization_id));
drop policy if exists "tenant domains org owner insert" on public.tenant_domains;
create policy "tenant domains org owner insert"
  on public.tenant_domains for insert to authenticated
  with check (public.is_organization_owner(organization_id));
drop policy if exists "tenant domains org owner update" on public.tenant_domains;
create policy "tenant domains org owner update"
  on public.tenant_domains for update to authenticated
  using (public.is_organization_owner(organization_id))
  with check (public.is_organization_owner(organization_id));

-- ════════════════════════════════════════════════════════════════════════
-- 4. RLS for organization_branding (already exists, ensure update policy)
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists "branding update for org owner" on public.organization_branding;
create policy "branding update for org owner"
  on public.organization_branding for update to authenticated
  using (public.is_organization_owner(organization_id))
  with check (public.is_organization_owner(organization_id));
