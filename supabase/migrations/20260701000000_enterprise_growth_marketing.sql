-- Enterprise Growth & Marketing Platform

-- ════════════════════════════════════════════════════════════════════════
-- 1. Marketing campaigns
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.crm_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  channel text check (channel in ('whatsapp', 'email', 'sms', 'social', 'ads', 'other')),
  type text check (type in ('lead_generation', 'trial_promotion', 'renewal', 'reengagement', 'festival', 'birthday', 'referral', 'general')),
  budget int default 0,
  spend int default 0,
  target_audience text,
  status text default 'draft' check (status in ('draft', 'active', 'paused', 'completed', 'cancelled')),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_campaigns_org_idx on public.crm_campaigns (organization_id);
create index if not exists crm_campaigns_status_idx on public.crm_campaigns (status);

alter table public.crm_campaigns enable row level security;
drop policy if exists "campaigns super admin" on public.crm_campaigns;
create policy "campaigns super admin" on public.crm_campaigns for select to authenticated using (public.is_super_admin());
drop policy if exists "campaigns org owner" on public.crm_campaigns;
create policy "campaigns org owner" on public.crm_campaigns for select to authenticated using (public.is_organization_owner(organization_id));
drop policy if exists "campaigns org insert" on public.crm_campaigns;
create policy "campaigns org insert" on public.crm_campaigns for insert to authenticated with check (public.is_organization_owner(organization_id));

-- ════════════════════════════════════════════════════════════════════════
-- 2. Campaign leads (track which leads came from which campaign)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.crm_campaign_leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.crm_campaigns(id) on delete cascade,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  converted boolean default false,
  revenue_generated int default 0,
  created_at timestamptz not null default now(),
  unique (campaign_id, lead_id)
);

create index if not exists crm_campaign_leads_campaign_idx on public.crm_campaign_leads (campaign_id);

alter table public.crm_campaign_leads enable row level security;
drop policy if exists "campaign_leads super admin" on public.crm_campaign_leads;
create policy "campaign_leads super admin" on public.crm_campaign_leads for select to authenticated using (public.is_super_admin());
drop policy if exists "campaign_leads org owner" on public.crm_campaign_leads;
create policy "campaign_leads org owner" on public.crm_campaign_leads for select to authenticated using (
  exists (select 1 from public.crm_campaigns cc where cc.id = campaign_id and public.is_organization_owner(cc.organization_id))
);

-- ════════════════════════════════════════════════════════════════════════
-- 3. Referral tracking
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.crm_referrals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  referrer_id uuid references public.members(id) on delete set null,
  referred_name text not null,
  referred_phone text,
  referred_email text,
  lead_id uuid references public.crm_leads(id) on delete set null,
  converted_member_id uuid references public.members(id) on delete set null,
  reward_status text default 'pending' check (reward_status in ('pending', 'awarded', 'cancelled')),
  reward_amount int default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists crm_referrals_org_idx on public.crm_referrals (organization_id);

alter table public.crm_referrals enable row level security;
drop policy if exists "referrals super admin" on public.crm_referrals;
create policy "referrals super admin" on public.crm_referrals for select to authenticated using (public.is_super_admin());
drop policy if exists "referrals org owner" on public.crm_referrals;
create policy "referrals org owner" on public.crm_referrals for select to authenticated using (public.is_organization_owner(organization_id));
