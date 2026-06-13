-- Enterprise Support Center — complete data model.
-- Core ticket management, SLA policies, escalation matrix,
-- knowledge base, automation engine, customer 360 health,
-- and multi-channel communication.

-- ============================================================================
-- 1.  TICKET CATEGORIES
-- ============================================================================
create table if not exists public.support_ticket_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  icon text,
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  is_system boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

comment on table public.support_ticket_categories is 'Ticket categories – system defaults + tenant custom categories.';

-- ============================================================================
-- 2.  SUPPORT TICKETS (Core)
-- ============================================================================
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  gym_id uuid references public.gyms(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  category_id uuid references public.support_ticket_categories(id) on delete set null,
  customer_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  customer_type text not null default 'member' check (customer_type in ('member', 'trainer', 'staff', 'owner', 'lead', 'other')),
  membership_id uuid references public.memberships(id) on delete set null,
  subject text not null check (char_length(subject) between 1 and 500),
  description text not null check (char_length(description) between 1 and 10000),
  status text not null default 'open' check (status in ('open', 'in_review', 'in_progress', 'waiting_on_customer', 'waiting_on_third_party', 'resolved', 'closed', 'reopened')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical', 'emergency')),
  source text not null default 'manual' check (source in ('manual', 'email', 'chat', 'whatsapp', 'mobile_app', 'api', 'automation', 'phone')),
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_team text,
  escalation_level int not null default 1 check (escalation_level between 1 and 5),
  is_escalated boolean not null default false,
  reopened_count int not null default 0,
  sla_policy_id uuid,
  sla_first_response_at timestamptz,
  sla_resolved_at timestamptz,
  sla_breached boolean not null default false,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  reopened_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists support_tickets_number_idx on public.support_tickets (ticket_number);
create index if not exists support_tickets_org_id_idx on public.support_tickets (organization_id);
create index if not exists support_tickets_status_idx on public.support_tickets (status);
create index if not exists support_tickets_priority_idx on public.support_tickets (priority);
create index if not exists support_tickets_assigned_idx on public.support_tickets (assigned_to);
create index if not exists support_tickets_customer_idx on public.support_tickets (customer_id);
create index if not exists support_tickets_created_idx on public.support_tickets (created_at desc);
create index if not exists support_tickets_sla_breach_idx on public.support_tickets (sla_breached) where sla_breached = true;

-- ============================================================================
-- 3.  TICKET ASSIGNMENTS (History)
-- ============================================================================
create table if not exists public.support_ticket_assignments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  assigned_from uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  assignment_type text not null check (assignment_type in ('manual', 'auto_skill', 'auto_branch', 'auto_tenant', 'auto_round_robin', 'auto_workload', 'ai_recommended', 'escalation')),
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists support_assignments_ticket_idx on public.support_ticket_assignments (ticket_id);
create index if not exists support_assignments_to_idx on public.support_ticket_assignments (assigned_to);

-- ============================================================================
-- 4.  SLA POLICIES
-- ============================================================================
create table if not exists public.support_sla_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  priority text not null check (priority in ('low', 'medium', 'high', 'critical', 'emergency')),
  first_response_minutes int not null,
  resolution_minutes int not null,
  escalation_minutes int,
  reopen_minutes int,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.support_sla_policies is 'SLA policies – per tenant configurable with priority-based targets.';

-- ============================================================================
-- 5.  SLA EVENTS (Tracking)
-- ============================================================================
create table if not exists public.support_sla_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sla_policy_id uuid references public.support_sla_policies(id) on delete set null,
  event_type text not null check (event_type in ('first_response_sla', 'resolution_sla', 'escalation_sla', 'reopen_sla', 'breached', 'warning', 'at_risk')),
  status text not null default 'active' check (status in ('active', 'warning', 'breached', 'met', 'cancelled')),
  target_at timestamptz not null,
  breached_at timestamptz,
  met_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_sla_events_ticket_idx on public.support_sla_events (ticket_id);
create index if not exists support_sla_events_status_idx on public.support_sla_events (status);

-- ============================================================================
-- 6.  ESCALATION MATRIX
-- ============================================================================
create table if not exists public.support_escalation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  trigger_on text not null check (trigger_on in ('sla_breach', 'negative_sentiment', 'ticket_age', 'priority', 'reopened_count', 'manual')),
  priority_from text check (priority_from in ('low', 'medium', 'high', 'critical', 'emergency')),
  priority_to text check (priority_to in ('low', 'medium', 'high', 'critical', 'emergency')),
  escalate_after_minutes int,
  escalate_from_level int not null default 1 check (escalate_from_level between 1 and 5),
  escalate_to_level int not null default 2 check (escalate_to_level between 2 and 5),
  notify_roles text[] default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 7.  TICKET ESCALATIONS (History)
-- ============================================================================
create table if not exists public.support_ticket_escalations (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  escalation_rule_id uuid references public.support_escalation_rules(id) on delete set null,
  escalated_from_level int not null,
  escalated_to_level int not null,
  escalated_to uuid references auth.users(id) on delete set null,
  reason text not null,
  triggered_by text not null check (triggered_by in ('automatic', 'agent', 'manager', 'system')),
  resolved_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists support_escalations_ticket_idx on public.support_ticket_escalations (ticket_id);

-- ============================================================================
-- 8.  INTERNAL NOTES (Collaboration)
-- ============================================================================
create table if not exists public.support_ticket_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  body text not null,
  is_internal boolean not null default true,
  mentions uuid[] default '{}',
  attachment_ids uuid[] default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_notes_ticket_idx on public.support_ticket_notes (ticket_id);

-- ============================================================================
-- 9.  MULTI-CHANNEL MESSAGES
-- ============================================================================
create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'whatsapp', 'in_app', 'push', 'web_chat', 'phone')),
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text not null,
  sender_email text,
  recipient_email text,
  subject text,
  body text not null,
  body_html text,
  external_id text,
  attachments jsonb default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_ticket_idx on public.support_ticket_messages (ticket_id);
create index if not exists support_messages_channel_idx on public.support_ticket_messages (channel);
create index if not exists support_messages_created_idx on public.support_ticket_messages (created_at);

-- ============================================================================
-- 10. TICKET ATTACHMENTS
-- ============================================================================
create table if not exists public.support_ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  note_id uuid references public.support_ticket_notes(id) on delete set null,
  message_id uuid references public.support_ticket_messages(id) on delete set null,
  file_name text not null,
  file_size int not null,
  mime_type text not null,
  storage_path text not null,
  public_url text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists support_attachments_ticket_idx on public.support_ticket_attachments (ticket_id);

-- ============================================================================
-- 11. KNOWLEDGE BASE ARTICLES
-- ============================================================================
create table if not exists public.support_knowledge_base_articles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  category_id uuid references public.support_ticket_categories(id) on delete set null,
  title text not null check (char_length(title) between 2 and 300),
  slug text not null,
  body text not null,
  body_html text,
  excerpt text check (char_length(excerpt) <= 500),
  article_type text not null default 'internal' check (article_type in ('internal', 'customer')),
  audience text[] default '{}',
  tags text[] default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  view_count int not null default 0,
  helpful_count int not null default 0,
  not_helpful_count int not null default 0,
  author_id uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists support_kb_org_idx on public.support_knowledge_base_articles (organization_id);
create index if not exists support_kb_type_idx on public.support_knowledge_base_articles (article_type);
create index if not exists support_kb_status_idx on public.support_knowledge_base_articles (status);
create index if not exists support_kb_tags_idx on public.support_knowledge_base_articles using gin (tags);

-- ============================================================================
-- 12. AUTOMATION RULES
-- ============================================================================
create table if not exists public.support_automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  trigger_event text not null check (trigger_event in (
    'ticket_created', 'ticket_updated', 'ticket_assigned',
    'ticket_status_changed', 'ticket_priority_changed',
    'customer_replied', 'sla_warning', 'sla_breach',
    'ticket_inactive', 'escalation_triggered', 'feedback_received'
  )),
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '{}'::jsonb,
  priority int not null default 0,
  is_active boolean not null default true,
  execution_count int not null default 0,
  last_executed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_automation_org_idx on public.support_automation_rules (organization_id);
create index if not exists support_automation_event_idx on public.support_automation_rules (trigger_event);

-- ============================================================================
-- 13. CUSTOMER FEEDBACK (CSAT / NPS / CES)
-- ============================================================================
create table if not exists public.support_customer_feedback (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  survey_type text not null check (survey_type in ('csat', 'nps', 'ces')),
  score int not null check (score between 1 and 10),
  nps_category text generated always as (
    case
      when score >= 9 then 'promoter'
      when score >= 7 then 'passive'
      else 'detractor'
    end
  ) stored,
  feedback_text text check (char_length(feedback_text) <= 2000),
  improvement_suggestions text check (char_length(improvement_suggestions) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists support_feedback_ticket_idx on public.support_customer_feedback (ticket_id);
create index if not exists support_feedback_type_idx on public.support_customer_feedback (survey_type);

-- ============================================================================
-- 14. CUSTOMER HEALTH SCORES (Customer 360)
-- ============================================================================
create table if not exists public.support_customer_health_scores (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  churn_probability numeric(5,2) default 0 check (churn_probability between 0 and 100),
  satisfaction_score numeric(5,2) default 0 check (satisfaction_score between 0 and 100),
  complaint_frequency int default 0,
  revenue_impact_score numeric(5,2) default 0 check (revenue_impact_score between 0 and 100),
  health_score numeric(5,2) default 100 check (health_score between 0 and 100),
  last_ticket_resolved_at timestamptz,
  open_ticket_count int default 0,
  lifetime_value numeric(12,2) default 0,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, organization_id)
);

create index if not exists support_health_org_idx on public.support_customer_health_scores (organization_id);
create index if not exists support_health_score_idx on public.support_customer_health_scores (health_score);

-- ============================================================================
-- 15. TICKET TIMELINE (Unified Audit Trail)
-- ============================================================================
create table if not exists public.support_ticket_timeline (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  event_type text not null check (event_type in (
    'created', 'status_changed', 'priority_changed', 'assigned',
    'reassigned', 'escalated', 'de_escalated', 'note_added',
    'message_sent', 'message_received', 'attachment_added',
    'sla_warning', 'sla_breached', 'sla_met',
    'resolved', 'reopened', 'closed',
    'feedback_submitted', 'automation_executed', 'category_changed',
    'customer_viewed', 'agent_viewed'
  )),
  previous_value text,
  new_value text,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  actor_role text,
  metadata jsonb default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists support_timeline_ticket_idx on public.support_ticket_timeline (ticket_id);
create index if not exists support_timeline_type_idx on public.support_ticket_timeline (event_type);
create index if not exists support_timeline_created_idx on public.support_ticket_timeline (created_at desc);

-- ============================================================================
-- RLS: ENABLE ROW-LEVEL SECURITY ON ALL TABLES
-- ============================================================================
alter table public.support_ticket_categories enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_assignments enable row level security;
alter table public.support_sla_policies enable row level security;
alter table public.support_sla_events enable row level security;
alter table public.support_escalation_rules enable row level security;
alter table public.support_ticket_escalations enable row level security;
alter table public.support_ticket_notes enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.support_ticket_attachments enable row level security;
alter table public.support_knowledge_base_articles enable row level security;
alter table public.support_automation_rules enable row level security;
alter table public.support_customer_feedback enable row level security;
alter table public.support_customer_health_scores enable row level security;
alter table public.support_ticket_timeline enable row level security;

-- ============================================================================
-- RLS POLICIES: SUPER ADMIN
-- Super Admins have full access (SELECT, INSERT, UPDATE, DELETE) to all tables.
-- ============================================================================
do $$ declare tbl text;
begin
  foreach tbl in array array[
    'support_ticket_categories', 'support_tickets', 'support_ticket_assignments',
    'support_sla_policies', 'support_sla_events', 'support_escalation_rules',
    'support_ticket_escalations', 'support_ticket_notes', 'support_ticket_messages',
    'support_ticket_attachments', 'support_knowledge_base_articles',
    'support_automation_rules', 'support_customer_feedback',
    'support_customer_health_scores', 'support_ticket_timeline'
  ] loop
    execute format(
      'drop policy if exists "super_admin_full_access on %I" on %I;
       create policy "super_admin_full_access on %I" on %I
         for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());',
      tbl, tbl, tbl, tbl
    );
  end loop;
end $$;

-- ============================================================================
-- RLS POLICIES: TENANT ACCESS
-- Organization owners and gym admins can view/update tickets for their org.
-- ============================================================================
drop policy if exists "tenant_select_tickets" on public.support_tickets;
create policy "tenant_select_tickets" on public.support_tickets
  for select to authenticated
  using (
    public.is_organization_owner(organization_id)
    or (public.has_role('gym_admin') and organization_id = public.current_user_organization_id())
    or (public.has_role('branch_manager') and organization_id = public.current_user_organization_id())
    or (public.has_role('support_agent') and assigned_to = (select auth.uid()))
    or customer_id = (select auth.uid())
  );

drop policy if exists "tenant_insert_tickets" on public.support_tickets;
create policy "tenant_insert_tickets" on public.support_tickets
  for insert to authenticated
  with check (
    public.is_organization_owner(organization_id)
    or (public.has_role('gym_admin') and organization_id = public.current_user_organization_id())
    or customer_id = (select auth.uid())
  );

drop policy if exists "tenant_update_tickets" on public.support_tickets;
create policy "tenant_update_tickets" on public.support_tickets
  for update to authenticated
  using (
    public.is_organization_owner(organization_id)
    or (public.has_role('gym_admin') and organization_id = public.current_user_organization_id())
    or (public.has_role('support_agent') and assigned_to = (select auth.uid()))
  )
  with check (
    public.is_organization_owner(organization_id)
    or (public.has_role('gym_admin') and organization_id = public.current_user_organization_id())
    or (public.has_role('support_agent') and assigned_to = (select auth.uid()))
  );

-- Tenant-scoped RLS for other tables
drop policy if exists "tenant_select_kb" on public.support_knowledge_base_articles;
create policy "tenant_select_kb" on public.support_knowledge_base_articles
  for select to authenticated
  using (
    organization_id is null
    or public.is_organization_owner(organization_id)
    or organization_id = public.current_user_organization_id()
  );

drop policy if exists "tenant_select_sla_policies" on public.support_sla_policies;
create policy "tenant_select_sla_policies" on public.support_sla_policies
  for select to authenticated
  using (
    organization_id is null
    or public.is_organization_owner(organization_id)
    or organization_id = public.current_user_organization_id()
  );

-- Customer feedback: customers can only see their own feedback
drop policy if exists "customer_select_feedback" on public.support_customer_feedback;
create policy "customer_select_feedback" on public.support_customer_feedback
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.customer_id = (select auth.uid())
    )
  );

drop policy if exists "customer_insert_feedback" on public.support_customer_feedback;
create policy "customer_insert_feedback" on public.support_customer_feedback
  for insert to authenticated
  with check (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.customer_id = (select auth.uid())
    )
  );

-- Customer health: customers can see their own health score
drop policy if exists "customer_select_health" on public.support_customer_health_scores;
create policy "customer_select_health" on public.support_customer_health_scores
  for select to authenticated
  using (
    customer_id = (select auth.uid())
    or public.is_super_admin()
    or public.is_organization_owner(organization_id)
  );

-- ============================================================================
-- TRIGGER: Auto-generate ticket number on insert
-- ============================================================================
create sequence if not exists public.support_ticket_number_seq;
grant usage on sequence public.support_ticket_number_seq to authenticated;

create or replace function public.generate_support_ticket_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seq_id int;
  year_prefix text;
begin
  year_prefix := to_char(now(), 'YYYY');
  seq_id := nextval('public.support_ticket_number_seq');
  new.ticket_number := 'TKT-' || year_prefix || '-' || lpad(seq_id::text, 6, '0');
  return new;
end;
$$;

drop trigger if exists trg_support_tickets_generate_number on public.support_tickets;
create trigger trg_support_tickets_generate_number
  before insert on public.support_tickets
  for each row
  when (new.ticket_number is null)
  execute function public.generate_support_ticket_number();

-- ============================================================================
-- TRIGGER: Auto-update updated_at on row update
-- ============================================================================
create or replace function public.update_support_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ declare tbl text;
begin
  foreach tbl in array array[
    'support_ticket_categories', 'support_tickets', 'support_sla_policies',
    'support_escalation_rules', 'support_ticket_notes',
    'support_knowledge_base_articles', 'support_automation_rules',
    'support_customer_health_scores'
  ] loop
    execute format(
      'drop trigger if exists trg_%I_updated_at on %I;
       create trigger trg_%I_updated_at before update on %I
         for each row execute function public.update_support_updated_at();',
      tbl, tbl, tbl, tbl
    );
  end loop;
end $$;

-- ============================================================================
-- TRIGGER: Record ticket timeline on status/priority/assignment changes
-- ============================================================================
create or replace function public.log_support_ticket_timeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.support_ticket_timeline (ticket_id, event_type, previous_value, new_value, actor_id)
    values (new.id, 'status_changed', old.status, new.status, (select auth.uid()));
  end if;

  if old.priority is distinct from new.priority then
    insert into public.support_ticket_timeline (ticket_id, event_type, previous_value, new_value, actor_id)
    values (new.id, 'priority_changed', old.priority, new.priority, (select auth.uid()));
  end if;

  if old.assigned_to is distinct from new.assigned_to then
    insert into public.support_ticket_timeline (ticket_id, event_type, previous_value, new_value, actor_id)
    values (new.id, 'assigned', old.assigned_to::text, new.assigned_to::text, (select auth.uid()));
  end if;

  if old.escalation_level is distinct from new.escalation_level and new.escalation_level > old.escalation_level then
    insert into public.support_ticket_timeline (ticket_id, event_type, previous_value, new_value, actor_id)
    values (new.id, 'escalated', old.escalation_level::text, new.escalation_level::text, (select auth.uid()));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_support_tickets_timeline on public.support_tickets;
create trigger trg_support_tickets_timeline
  after update of status, priority, assigned_to, escalation_level
  on public.support_tickets
  for each row
  execute function public.log_support_ticket_timeline();

-- ============================================================================
-- TRIGGER: Create timeline entry on ticket creation
-- ============================================================================
create or replace function public.log_support_ticket_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.support_ticket_timeline (ticket_id, event_type, actor_id)
  values (new.id, 'created', new.created_by);
  return new;
end;
$$;

drop trigger if exists trg_support_tickets_created on public.support_tickets;
create trigger trg_support_tickets_created
  after insert on public.support_tickets
  for each row
  execute function public.log_support_ticket_created();
