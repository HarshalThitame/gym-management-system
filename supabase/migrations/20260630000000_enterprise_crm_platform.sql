-- Enterprise CRM & Lead Management Platform

-- ════════════════════════════════════════════════════════════════════════
-- 1. Lead statuses (extensible lifecycle)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.crm_lead_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  sort_order int not null default 0,
  category text check (category in ('active', 'converted', 'lost', 'archived')),
  is_active boolean not null default true
);

insert into public.crm_lead_statuses (code, name, sort_order, category) values
  ('new', 'New Lead', 1, 'active'),
  ('contacted', 'Contacted', 2, 'active'),
  ('interested', 'Interested', 3, 'active'),
  ('trial_scheduled', 'Trial Scheduled', 4, 'active'),
  ('trial_active', 'Trial Active', 5, 'active'),
  ('negotiation', 'Negotiation', 6, 'active'),
  ('converted', 'Converted to Member', 7, 'converted'),
  ('lost', 'Lost Lead', 8, 'lost'),
  ('archived', 'Archived', 9, 'archived')
on conflict (code) do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Lead sources (extensible)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.crm_lead_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true
);

insert into public.crm_lead_sources (code, name) values
  ('walk_in', 'Walk-In'),
  ('website', 'Website'),
  ('facebook', 'Facebook'),
  ('instagram', 'Instagram'),
  ('whatsapp', 'WhatsApp'),
  ('google_ads', 'Google Ads'),
  ('referral', 'Referral'),
  ('phone_call', 'Phone Call'),
  ('campaign', 'Campaign'),
  ('custom', 'Custom Source')
on conflict (code) do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Leads
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  gym_id uuid references public.gyms(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  status_id uuid references public.crm_lead_statuses(id) on delete restrict,
  source_id uuid references public.crm_lead_sources(id) on delete restrict,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  gender text,
  date_of_birth date,
  notes text,
  interested_in text[] default '{}',
  budget_range text,
  referral_source text,
  converted_member_id uuid references public.members(id) on delete set null,
  converted_at timestamptz,
  lost_reason text,
  lost_at timestamptz,
  follow_up_date timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_leads_org_idx on public.crm_leads (organization_id);
create index if not exists crm_leads_status_idx on public.crm_leads (status_id);
create index if not exists crm_leads_assigned_idx on public.crm_leads (assigned_to);
create index if not exists crm_leads_followup_idx on public.crm_leads (follow_up_date);
create index if not exists crm_leads_created_idx on public.crm_leads (created_at desc);

alter table public.crm_leads enable row level security;
drop policy if exists "leads super admin" on public.crm_leads;
create policy "leads super admin"
  on public.crm_leads for select to authenticated
  using (public.is_super_admin());
drop policy if exists "leads org owner" on public.crm_leads;
create policy "leads org owner"
  on public.crm_leads for select to authenticated
  using (public.is_organization_owner(organization_id));
drop policy if exists "leads org insert" on public.crm_leads;
create policy "leads org insert"
  on public.crm_leads for insert to authenticated
  with check (public.is_super_admin() or public.is_organization_owner(organization_id));
drop policy if exists "leads org update" on public.crm_leads;
create policy "leads org update"
  on public.crm_leads for update to authenticated
  using (public.is_organization_owner(organization_id))
  with check (public.is_organization_owner(organization_id));

-- ════════════════════════════════════════════════════════════════════════
-- 4. Lead follow-ups
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.crm_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  action text not null,
  notes text,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists crm_followups_lead_idx on public.crm_followups (lead_id);
create index if not exists crm_followups_due_idx on public.crm_followups (due_at);
create index if not exists crm_followups_org_idx on public.crm_followups (organization_id);

alter table public.crm_followups enable row level security;
drop policy if exists "followups super admin" on public.crm_followups;
create policy "followups super admin"
  on public.crm_followups for select to authenticated
  using (public.is_super_admin());
drop policy if exists "followups org owner" on public.crm_followups;
create policy "followups org owner"
  on public.crm_followups for select to authenticated
  using (public.is_organization_owner(organization_id));

-- ════════════════════════════════════════════════════════════════════════
-- 5. Lead audit log
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.crm_audit_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists crm_audit_lead_idx on public.crm_audit_logs (lead_id);
create index if not exists crm_audit_org_idx on public.crm_audit_logs (organization_id);

alter table public.crm_audit_logs enable row level security;
drop policy if exists "crm_audit super admin" on public.crm_audit_logs;
create policy "crm_audit super admin"
  on public.crm_audit_logs for select to authenticated
  using (public.is_super_admin());
drop policy if exists "crm_audit org owner" on public.crm_audit_logs;
create policy "crm_audit org owner"
  on public.crm_audit_logs for select to authenticated
  using (public.is_organization_owner(organization_id));
