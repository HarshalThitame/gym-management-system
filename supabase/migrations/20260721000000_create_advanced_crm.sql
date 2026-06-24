-- Phase 3.3: Advanced CRM — lead_tasks, lead_automation_rules, leads extensions
-- Purge soft-deleted leads first for referential integrity
delete from public.leads where status = 'spam';

-- ═══ lead_tasks table (follow-up reminders) ═══
create table if not exists public.lead_tasks (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamptz not null,
  completed_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id),
  is_notified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists lead_tasks_org_due_idx on public.lead_tasks (organization_id, due_date);
create index if not exists lead_tasks_lead_id_idx on public.lead_tasks (lead_id);
create index if not exists lead_tasks_assigned_to_idx on public.lead_tasks (assigned_to);

alter table public.lead_tasks enable row level security;

create policy "lead_tasks_read" on public.lead_tasks for select to authenticated
  using (
    organization_id in (
      select organization_id from public.branch_users where user_id = auth.uid()
    )
  );

create policy "lead_tasks_insert" on public.lead_tasks for insert to authenticated
  with check (
    organization_id in (
      select organization_id from public.branch_users where user_id = auth.uid()
    )
  );

create policy "lead_tasks_update" on public.lead_tasks for update to authenticated
  using (
    organization_id in (
      select organization_id from public.branch_users where user_id = auth.uid()
    )
  );

create policy "lead_tasks_delete" on public.lead_tasks for delete to authenticated
  using (
    organization_id in (
      select organization_id from public.branch_users where user_id = auth.uid()
    )
  );

-- ═══ lead_automation_rules table (re-engagement automation) ═══
create table if not exists public.lead_automation_rules (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  trigger_type text not null check (trigger_type in ('inactive_days', 'status_stale', 'new_lead')),
  trigger_value integer not null default 7,
  action_type text not null check (action_type in ('send_email', 'send_sms', 'send_whatsapp', 'create_task', 'change_status')),
  action_config jsonb not null default '{}'::jsonb,
  is_active boolean default true,
  last_triggered_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists lead_automation_rules_org_idx on public.lead_automation_rules (organization_id);
create index if not exists lead_automation_rules_trigger_idx on public.lead_automation_rules (trigger_type);

alter table public.lead_automation_rules enable row level security;

create policy "lead_automation_rules_read" on public.lead_automation_rules for select to authenticated
  using (
    organization_id in (
      select organization_id from public.branch_users where user_id = auth.uid()
    )
  );

create policy "lead_automation_rules_insert" on public.lead_automation_rules for insert to authenticated
  with check (
    organization_id in (
      select organization_id from public.branch_users where user_id = auth.uid()
    )
  );

create policy "lead_automation_rules_update" on public.lead_automation_rules for update to authenticated
  using (
    organization_id in (
      select organization_id from public.branch_users where user_id = auth.uid()
    )
  );

create policy "lead_automation_rules_delete" on public.lead_automation_rules for delete to authenticated
  using (
    organization_id in (
      select organization_id from public.branch_users where user_id = auth.uid()
    )
  );

-- ═══ Extend leads table for Advanced CRM ═══
alter table public.leads
  add column if not exists lead_score integer default 0 check (lead_score >= 0 and lead_score <= 100),
  add column if not exists last_contacted_at timestamptz,
  add column if not exists pipeline_stage integer default 0,
  add column if not exists tags text[] default '{}';
