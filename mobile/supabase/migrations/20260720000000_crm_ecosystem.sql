-- Extended Leads Table
alter table public.leads add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table public.leads add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.leads add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.leads add column if not exists priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent'));
alter table public.leads add column if not exists lead_score integer not null default 0;
alter table public.leads add column if not exists expected_revenue numeric(12,2) not null default 0;
alter table public.leads add column if not exists converted_member_id uuid references public.members(id) on delete set null;
alter table public.leads add column if not exists trial_session_id uuid null;
alter table public.leads add column if not exists follow_up_at timestamptz null;
alter table public.leads add column if not exists last_contacted_at timestamptz null;

-- Update lead source check constraint
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check
  check (source in ('walk_in', 'phone', 'whatsapp', 'facebook', 'instagram', 'website', 'referral', 'google_ads', 'campaign', 'manual', 'free_trial', 'membership_inquiry', 'contact'));

-- Update lead status check constraint
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check
  check (status in ('new', 'contacted', 'interested', 'trial_scheduled', 'trial_active', 'negotiation', 'converted', 'lost', 'archived'));

create index if not exists idx_leads_org_status on public.leads(organization_id, status);
create index if not exists idx_leads_assigned on public.leads(assigned_to);
create index if not exists idx_leads_followup on public.leads(follow_up_at);

-- Lead Notes
create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  content text not null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_notes_lead on public.lead_notes(lead_id, created_at desc);

-- Lead Timeline / Activity Log
create table if not exists public.lead_timeline (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  event_type text not null,
  description text not null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_timeline_lead on public.lead_timeline(lead_id, created_at desc);

-- Lead Follow-Ups
create table if not exists public.lead_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null check (type in ('call', 'whatsapp', 'email', 'meeting', 'trial', 'renewal', 'custom')),
  title text not null,
  description text null,
  scheduled_at timestamptz not null,
  completed_at timestamptz null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'missed', 'cancelled')),
  assigned_to uuid null references auth.users(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_followups_lead on public.lead_followups(lead_id);
create index if not exists idx_lead_followups_schedule on public.lead_followups(scheduled_at, status);

-- Trial Sessions
create table if not exists public.trial_sessions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  member_id uuid null references public.members(id) on delete set null,
  trainer_id uuid null references public.trainers(id) on delete set null,
  scheduled_at timestamptz not null,
  completed_at timestamptz null,
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'completed', 'no_show', 'cancelled')),
  feedback text null,
  converted boolean not null default false,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_trial_sessions_lead on public.trial_sessions(lead_id);
create index if not exists idx_trial_sessions_schedule on public.trial_sessions(scheduled_at, status);

-- CRM Tasks
create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid null references public.leads(id) on delete set null,
  title text not null,
  description text null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to uuid null references auth.users(id) on delete set null,
  due_at timestamptz null,
  completed_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_tasks_user on public.crm_tasks(assigned_to, status);

-- Lead Communications
create table if not exists public.lead_communications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel text not null check (channel in ('call', 'whatsapp', 'email', 'sms', 'meeting')),
  direction text not null check (direction in ('inbound', 'outbound')),
  subject text null,
  body text null,
  duration_seconds integer null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_comms_lead on public.lead_communications(lead_id, created_at desc);

-- RLS Policies
alter table public.lead_notes enable row level security;
alter table public.lead_timeline enable row level security;
alter table public.lead_followups enable row level security;
alter table public.trial_sessions enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.lead_communications enable row level security;

-- Staff can manage all CRM data within their gym
create policy "staff manage lead_notes" on public.lead_notes for all to authenticated using (true) with check (true);
create policy "staff manage lead_timeline" on public.lead_timeline for all to authenticated using (true) with check (true);
create policy "staff manage lead_followups" on public.lead_followups for all to authenticated using (true) with check (true);
create policy "staff manage trial_sessions" on public.trial_sessions for all to authenticated using (true) with check (true);
create policy "staff manage crm_tasks" on public.crm_tasks for all to authenticated using (true) with check (true);
create policy "staff manage lead_communications" on public.lead_communications for all to authenticated using (true) with check (true);

-- Grant permissions
grant select, insert, update, delete on public.lead_notes to authenticated;
grant select, insert on public.lead_timeline to authenticated;
grant select, insert, update on public.lead_followups to authenticated;
grant select, insert, update on public.trial_sessions to authenticated;
grant select, insert, update on public.crm_tasks to authenticated;
grant select, insert on public.lead_communications to authenticated;

-- Update existing leads with organization_id from gyms
update public.leads l set organization_id = g.organization_id
from public.gyms g where l.gym_id = g.id and l.organization_id is null;
