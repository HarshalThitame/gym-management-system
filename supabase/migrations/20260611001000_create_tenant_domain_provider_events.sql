-- Phase 6 multi-tenant domain provider automation.
-- Records Vercel project-domain lifecycle calls separately from DNS/TLS checks.

create table if not exists public.tenant_domain_provider_events (
  id uuid primary key default gen_random_uuid(),
  tenant_domain_id uuid not null references public.tenant_domains(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete set null,
  gym_id uuid null references public.gyms(id) on delete set null,
  domain text not null check (char_length(domain) between 3 and 253),
  normalized_domain text generated always as (public.normalize_tenant_domain(domain)) stored,
  provider text not null default 'vercel' check (provider in ('vercel')),
  operation text not null check (operation in ('add', 'sync', 'verify', 'remove')),
  operation_status text not null check (operation_status in ('pending', 'succeeded', 'failed', 'skipped')),
  provider_project_id text null,
  provider_team_id text null,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text null,
  requested_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (normalized_domain is not null)
);

create index if not exists tenant_domain_provider_events_domain_created_idx
on public.tenant_domain_provider_events (tenant_domain_id, created_at desc);

create index if not exists tenant_domain_provider_events_org_created_idx
on public.tenant_domain_provider_events (organization_id, created_at desc);

create index if not exists tenant_domain_provider_events_status_idx
on public.tenant_domain_provider_events (provider, operation, operation_status);

alter table public.tenant_domain_provider_events enable row level security;

grant select, insert on public.tenant_domain_provider_events to authenticated;

drop policy if exists "tenant domain provider events visible by organization" on public.tenant_domain_provider_events;
create policy "tenant domain provider events visible by organization"
on public.tenant_domain_provider_events for select to authenticated
using (public.can_access_organization(organization_id));

drop policy if exists "tenant domain provider events insertable by managers" on public.tenant_domain_provider_events;
create policy "tenant domain provider events insertable by managers"
on public.tenant_domain_provider_events for insert to authenticated
with check (public.can_manage_organization(organization_id));

create or replace view public.tenant_domain_latest_provider_events
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
  operation,
  operation_status,
  provider_project_id,
  provider_team_id,
  request_payload,
  response_payload,
  error_message,
  requested_by,
  created_at
from public.tenant_domain_provider_events
order by tenant_domain_id, created_at desc;

grant select on public.tenant_domain_latest_provider_events to authenticated;
