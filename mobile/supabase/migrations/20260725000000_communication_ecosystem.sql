-- Communication Templates
create table if not exists public.comm_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  channel text not null check (channel in ('push', 'email', 'sms', 'whatsapp')),
  category text not null default 'system' check (category in ('system', 'marketing', 'transactional', 'reminder', 'announcement')),
  subject text null,
  body text not null,
  variables jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  version integer not null default 1,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Communication Campaigns
create table if not exists public.comm_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  gym_id uuid null references public.gyms(id) on delete set null,
  name text not null,
  channel text not null check (channel in ('push', 'email', 'sms', 'whatsapp')),
  audience text not null check (audience in ('members', 'trainers', 'staff', 'admins', 'leads', 'all')),
  template_id uuid null references public.comm_templates(id) on delete set null,
  subject text null,
  body text not null,
  scheduled_at timestamptz null,
  sent_at timestamptz null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'completed', 'cancelled')),
  total_recipients integer not null default 0,
  sent_count integer not null default 0,
  opened_count integer not null default 0,
  clicked_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Communication Automation Rules
create table if not exists public.comm_automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  gym_id uuid null references public.gyms(id) on delete set null,
  name text not null,
  trigger_event text not null,
  delay_minutes integer not null default 0,
  channel text not null check (channel in ('push', 'email', 'sms', 'whatsapp')),
  template_id uuid null references public.comm_templates(id) on delete set null,
  subject text null,
  body text null,
  audience_filter jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_triggered_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Notification Preferences
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  push_enabled boolean not null default true,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  marketing_enabled boolean not null default true,
  categories jsonb not null default '{"attendance":true,"membership":true,"payment":true,"lead":true,"trainer":true,"system":true,"campaign":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Audit trail for notifications added to existing activity_events table
create index if not exists idx_activity_events_notification on public.activity_events(event_type, created_at desc)
  where event_type like 'notification.%';

-- RLS
alter table public.comm_templates enable row level security;
alter table public.comm_campaigns enable row level security;
alter table public.comm_automation_rules enable row level security;
alter table public.notification_preferences enable row level security;

create policy "org staff manage templates" on public.comm_templates for all to authenticated using (true) with check (true);
create policy "org staff manage campaigns" on public.comm_campaigns for all to authenticated using (true) with check (true);
create policy "org staff manage automation" on public.comm_automation_rules for all to authenticated using (true) with check (true);
create policy "users manage own preferences" on public.notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.comm_templates to authenticated;
grant select, insert, update on public.comm_campaigns to authenticated;
grant select, insert, update, delete on public.comm_automation_rules to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
