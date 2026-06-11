-- Phase 2 host-aware tenant context.
-- Extends the public-safe tenant resolver with display names and branch contact
-- data so middleware can pass a complete request-scoped tenant context to the
-- Next.js App Router.

drop function if exists public.resolve_tenant_by_host(text);

create or replace function public.resolve_tenant_by_host(request_host text)
returns table (
  organization_id uuid,
  organization_name text,
  branch_id uuid,
  branch_name text,
  branch_code text,
  gym_id uuid,
  gym_name text,
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
  limits jsonb,
  branch_phone text,
  branch_email text,
  branch_address text,
  branch_city text,
  branch_state text,
  branch_country text,
  branch_postal_code text,
  branch_timezone text,
  branch_currency text
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
    o.name as organization_name,
    d.branch_id,
    b.name as branch_name,
    b.branch_code,
    coalesce(d.gym_id, b.gym_id) as gym_id,
    g.name as gym_name,
    tc.id as tenant_config_id,
    tc.tenant_key,
    d.normalized_domain as domain,
    d.domain_type,
    d.routing_mode,
    tc.plan_tier,
    tc.status as tenant_status,
    o.status as organization_status,
    b.status as branch_status,
    coalesce(tc.brand_name, o.name, g.name) as brand_name,
    tc.logo_url,
    tc.favicon_url,
    tc.primary_color,
    tc.secondary_color,
    tc.accent_color,
    tc.typography,
    tc.email_branding,
    tc.feature_overrides,
    tc.limits,
    b.phone as branch_phone,
    b.email as branch_email,
    b.address as branch_address,
    b.city as branch_city,
    b.state as branch_state,
    b.country as branch_country,
    b.postal_code as branch_postal_code,
    b.timezone as branch_timezone,
    b.currency as branch_currency
  from normalized n
  join public.tenant_domains d on d.normalized_domain = n.host
  join public.organizations o on o.id = d.organization_id
  left join public.branches b on b.id = d.branch_id
  left join public.gyms g on g.id = coalesce(d.gym_id, b.gym_id)
  left join public.tenant_configs tc
    on tc.organization_id = d.organization_id
   and (d.tenant_config_id is null or tc.id = d.tenant_config_id)
  where n.host is not null
    and d.status = 'verified'
    and o.status in ('active', 'trial')
    and (b.id is null or b.status in ('active', 'planned', 'maintenance'))
    and (tc.id is null or tc.status in ('active', 'trial'))
  order by d.is_primary desc, d.verified_at desc nulls last, tc.updated_at desc nulls last, d.created_at desc
  limit 1;
$$;

grant execute on function public.resolve_tenant_by_host(text) to anon, authenticated, service_role;
