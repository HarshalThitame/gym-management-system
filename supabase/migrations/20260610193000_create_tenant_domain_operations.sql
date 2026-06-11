-- Phase 5 multi-tenant domain operations.
-- Stores DNS/TLS verification attempts for custom domains so white-label
-- routing has an auditable operational record.

create table if not exists public.tenant_domain_checks (
  id uuid primary key default gen_random_uuid(),
  tenant_domain_id uuid not null references public.tenant_domains(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete set null,
  gym_id uuid null references public.gyms(id) on delete set null,
  domain text not null check (char_length(domain) between 3 and 253),
  normalized_domain text generated always as (public.normalize_tenant_domain(domain)) stored,
  provider text not null default 'vercel' check (provider in ('vercel', 'manual')),
  check_status text not null check (check_status in ('passed', 'failed', 'warning', 'skipped')),
  dns_status text not null check (dns_status in ('passed', 'failed', 'warning', 'skipped')),
  ownership_status text not null check (ownership_status in ('passed', 'failed', 'skipped')),
  tls_status text not null check (tls_status in ('passed', 'failed', 'pending', 'skipped')),
  expected_records jsonb not null default '[]'::jsonb,
  observed_records jsonb not null default '{}'::jsonb,
  provider_response jsonb not null default '{}'::jsonb,
  error_message text null,
  checked_by uuid null references auth.users(id) on delete set null,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (normalized_domain is not null)
);

create index if not exists tenant_domain_checks_domain_checked_idx
on public.tenant_domain_checks (tenant_domain_id, checked_at desc);

create index if not exists tenant_domain_checks_org_checked_idx
on public.tenant_domain_checks (organization_id, checked_at desc);

create index if not exists tenant_domain_checks_status_idx
on public.tenant_domain_checks (check_status, dns_status, ownership_status);

alter table public.tenant_domain_checks enable row level security;

grant select, insert on public.tenant_domain_checks to authenticated;

drop policy if exists "tenant domain checks visible by organization" on public.tenant_domain_checks;
create policy "tenant domain checks visible by organization"
on public.tenant_domain_checks for select to authenticated
using (public.can_access_organization(organization_id));

drop policy if exists "tenant domain checks insertable by managers" on public.tenant_domain_checks;
create policy "tenant domain checks insertable by managers"
on public.tenant_domain_checks for insert to authenticated
with check (public.can_manage_organization(organization_id));

create or replace view public.tenant_domain_latest_checks
with (security_invoker = true)
as
select distinct on (tenant_domain_id)
  id,
  tenant_domain_id,
  organization_id,
  branch_id,
  gym_id,
  domain,
  normalized_domain,
  provider,
  check_status,
  dns_status,
  ownership_status,
  tls_status,
  expected_records,
  observed_records,
  provider_response,
  error_message,
  checked_by,
  checked_at,
  created_at
from public.tenant_domain_checks
order by tenant_domain_id, checked_at desc;

grant select on public.tenant_domain_latest_checks to authenticated;

insert into public.tenant_domain_checks (
  tenant_domain_id,
  organization_id,
  branch_id,
  gym_id,
  domain,
  provider,
  check_status,
  dns_status,
  ownership_status,
  tls_status,
  expected_records,
  observed_records,
  provider_response,
  error_message,
  checked_at
)
select
  d.id,
  d.organization_id,
  d.branch_id,
  d.gym_id,
  d.domain,
  'vercel',
  'passed',
  'passed',
  'skipped',
  'passed',
  '[]'::jsonb,
  jsonb_build_object('source', 'phase_5_seed', 'domain_type', d.domain_type),
  jsonb_build_object('status', 'existing_verified_domain'),
  null,
  coalesce(d.verified_at, now())
from public.tenant_domains d
where d.status = 'verified'
  and not exists (
    select 1
    from public.tenant_domain_checks c
    where c.tenant_domain_id = d.id
  );
