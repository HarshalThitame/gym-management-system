-- Phase 1.2: CRM / Leads Dashboard — extend leads table for org-owner panel

-- 1. Add organization_id so leads can be scoped to an organization
alter table public.leads
  add column if not exists organization_id uuid null;

-- 2. Expand source values to include CRM sources (website, walk_in, phone, referral, social_media, other)
alter table public.leads
  drop constraint if exists leads_source_check;

alter table public.leads
  add constraint leads_source_check check (
    source in (
      'free_trial', 'membership_inquiry', 'contact',   -- public form origins
      'website', 'walk_in', 'phone', 'referral', 'social_media', 'other' -- CRM origins
    )
  );

-- 3. Expand status values to include CRM pipeline stages
alter table public.leads
  drop constraint if exists leads_status_check;

alter table public.leads
  add constraint leads_status_check check (
    status in (
      'new', 'contacted', 'trial_scheduled', 'trial_attended',
      'negotiation', 'won', 'lost', 'spam',
      -- legacy values preserved for existing data
      'trial_completed', 'converted'
    )
  );

-- 4. Index for org-scoped queries
create index if not exists leads_organization_id_idx on public.leads (organization_id);
create index if not exists leads_gym_id_idx on public.leads (gym_id);

-- 5. RLS: authenticated org users can read/write leads in their org
drop policy if exists "org members can read org leads" on public.leads;
create policy "org members can read org leads"
  on public.leads
  for select
  to authenticated
  using (
    organization_id in (
      select organization_id from public.gyms where id = gym_id
    )
    or
    organization_id in (
      select id from public.organizations where id = organization_id
    )
  );

drop policy if exists "org members can insert org leads" on public.leads;
create policy "org members can insert org leads"
  on public.leads
  for insert
  to authenticated
  with check (true);

drop policy if exists "org members can update org leads" on public.leads;
create policy "org members can update org leads"
  on public.leads
  for update
  to authenticated
  using (
    organization_id in (
      select organization_id from public.gyms where id = gym_id
    )
    or
    organization_id in (
      select id from public.organizations where id = organization_id
    )
  )
  with check (true);

drop policy if exists "org members can delete org leads" on public.leads;
create policy "org members can delete org leads"
  on public.leads
  for delete
  to authenticated
  using (
    organization_id in (
      select organization_id from public.gyms where id = gym_id
    )
    or
    organization_id in (
      select id from public.organizations where id = organization_id
    )
  );
