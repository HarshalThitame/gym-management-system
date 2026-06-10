create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 140),
  slug text not null check (char_length(slug) between 2 and 160),
  category text not null check (category in ('membership', 'payments', 'attendance', 'classes', 'workouts', 'nutrition', 'promotions', 'system')),
  channel text not null check (channel in ('in_app', 'email', 'whatsapp', 'sms', 'push')),
  subject text null check (subject is null or char_length(subject) <= 180),
  body_html text null check (body_html is null or char_length(body_html) <= 12000),
  body_text text not null check (char_length(body_text) between 2 and 4000),
  variables jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  version integer not null default 1 check (version > 0),
  is_system boolean not null default false,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists notification_templates_gym_slug_channel_idx on public.notification_templates (gym_id, slug, channel);
create index if not exists notification_templates_gym_status_idx on public.notification_templates (gym_id, status, category, channel);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid null references public.members(id) on delete cascade,
  trainer_id uuid null references public.trainers(id) on delete cascade,
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  push_enabled boolean not null default true,
  category_preferences jsonb not null default '{"membership": true, "payments": true, "attendance": true, "classes": true, "workouts": true, "nutrition": true, "promotions": false, "system": true}'::jsonb,
  quiet_hours_start time null,
  quiet_hours_end time null,
  timezone text not null default 'Asia/Kolkata',
  marketing_opt_in boolean not null default false,
  transactional_opt_in boolean not null default true,
  whatsapp_opt_in boolean not null default true,
  sms_opt_in boolean not null default false,
  opted_out_at timestamptz null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (member_id is not null or trainer_id is not null or user_id is not null)
);

create unique index if not exists notification_preferences_user_idx on public.notification_preferences (user_id);
create index if not exists notification_preferences_member_idx on public.notification_preferences (member_id) where member_id is not null;
create index if not exists notification_preferences_trainer_idx on public.notification_preferences (trainer_id) where trainer_id is not null;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete cascade,
  member_id uuid null references public.members(id) on delete cascade,
  trainer_id uuid null references public.trainers(id) on delete cascade,
  template_id uuid null references public.notification_templates(id) on delete set null,
  category text not null check (category in ('membership', 'payments', 'attendance', 'classes', 'workouts', 'nutrition', 'promotions', 'system')),
  title text not null check (char_length(title) between 2 and 180),
  body text not null check (char_length(body) between 2 and 2000),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
  pinned boolean not null default false,
  action_url text null check (action_url is null or char_length(action_url) <= 500),
  source_type text null check (source_type is null or char_length(source_type) <= 80),
  source_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz null,
  expires_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (user_id is not null or member_id is not null or trainer_id is not null)
);

create index if not exists notifications_user_status_idx on public.notifications (user_id, status, pinned desc, created_at desc) where user_id is not null;
create index if not exists notifications_member_status_idx on public.notifications (member_id, status, created_at desc) where member_id is not null;
create index if not exists notifications_trainer_status_idx on public.notifications (trainer_id, status, created_at desc) where trainer_id is not null;
create index if not exists notifications_gym_category_idx on public.notifications (gym_id, category, created_at desc);

create table if not exists public.communication_segments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  segment_key text not null check (char_length(segment_key) between 2 and 120),
  description text null check (description is null or char_length(description) <= 700),
  definition jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_system boolean not null default false,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists communication_segments_gym_key_idx on public.communication_segments (gym_id, segment_key);
create index if not exists communication_segments_status_idx on public.communication_segments (gym_id, status, name);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  description text null check (description is null or char_length(description) <= 1000),
  campaign_type text not null check (campaign_type in ('email', 'whatsapp', 'sms', 'multi_channel')),
  category text not null check (category in ('membership', 'payments', 'attendance', 'classes', 'workouts', 'nutrition', 'promotions', 'system')),
  template_id uuid null references public.notification_templates(id) on delete set null,
  segment_id uuid null references public.communication_segments(id) on delete set null,
  segment_key text not null default 'all_members' check (char_length(segment_key) between 2 and 120),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'running', 'completed', 'cancelled')),
  scheduled_for timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_gym_status_idx on public.campaigns (gym_id, status, scheduled_for, created_at desc);
create index if not exists campaigns_segment_idx on public.campaigns (segment_key, status);

create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  member_id uuid null references public.members(id) on delete cascade,
  trainer_id uuid null references public.trainers(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  channel text not null check (channel in ('email', 'whatsapp', 'sms', 'push', 'in_app')),
  email text null,
  phone text null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'opted_out', 'cancelled')),
  error_message text null check (error_message is null or char_length(error_message) <= 800),
  sent_at timestamptz null,
  delivered_at timestamptz null,
  opened_at timestamptz null,
  clicked_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (member_id is not null or trainer_id is not null or user_id is not null)
);

create unique index if not exists campaign_recipients_campaign_member_channel_idx on public.campaign_recipients (campaign_id, member_id, channel) where member_id is not null;
create index if not exists campaign_recipients_campaign_status_idx on public.campaign_recipients (campaign_id, status, created_at desc);
create index if not exists campaign_recipients_member_idx on public.campaign_recipients (member_id, created_at desc) where member_id is not null;

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  notification_id uuid null references public.notifications(id) on delete set null,
  template_id uuid null references public.notification_templates(id) on delete set null,
  campaign_id uuid null references public.campaigns(id) on delete set null,
  recipient_user_id uuid null references auth.users(id) on delete set null,
  member_id uuid null references public.members(id) on delete set null,
  trainer_id uuid null references public.trainers(id) on delete set null,
  to_email text not null check (char_length(to_email) between 3 and 320),
  subject text not null check (char_length(subject) between 2 and 180),
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced', 'cancelled')),
  provider text not null default 'resend' check (char_length(provider) between 2 and 80),
  provider_message_id text null,
  error_message text null check (error_message is null or char_length(error_message) <= 1000),
  metadata jsonb not null default '{}'::jsonb,
  queued_at timestamptz not null default now(),
  sent_at timestamptz null,
  delivered_at timestamptz null,
  opened_at timestamptz null,
  clicked_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists email_logs_gym_status_idx on public.email_logs (gym_id, status, created_at desc);
create index if not exists email_logs_member_idx on public.email_logs (member_id, created_at desc) where member_id is not null;
create index if not exists email_logs_campaign_idx on public.email_logs (campaign_id, status) where campaign_id is not null;

create table if not exists public.whatsapp_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  notification_id uuid null references public.notifications(id) on delete set null,
  template_id uuid null references public.notification_templates(id) on delete set null,
  campaign_id uuid null references public.campaigns(id) on delete set null,
  recipient_user_id uuid null references auth.users(id) on delete set null,
  member_id uuid null references public.members(id) on delete set null,
  trainer_id uuid null references public.trainers(id) on delete set null,
  to_phone text not null check (char_length(to_phone) between 8 and 30),
  template_name text null check (template_name is null or char_length(template_name) <= 120),
  message text not null check (char_length(message) between 1 and 4000),
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'read', 'failed', 'cancelled')),
  provider text not null default 'provider_agnostic' check (char_length(provider) between 2 and 80),
  provider_message_id text null,
  error_message text null check (error_message is null or char_length(error_message) <= 1000),
  metadata jsonb not null default '{}'::jsonb,
  queued_at timestamptz not null default now(),
  sent_at timestamptz null,
  delivered_at timestamptz null,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_logs_gym_status_idx on public.whatsapp_logs (gym_id, status, created_at desc);
create index if not exists whatsapp_logs_member_idx on public.whatsapp_logs (member_id, created_at desc) where member_id is not null;
create index if not exists whatsapp_logs_campaign_idx on public.whatsapp_logs (campaign_id, status) where campaign_id is not null;

create table if not exists public.sms_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  notification_id uuid null references public.notifications(id) on delete set null,
  template_id uuid null references public.notification_templates(id) on delete set null,
  campaign_id uuid null references public.campaigns(id) on delete set null,
  recipient_user_id uuid null references auth.users(id) on delete set null,
  member_id uuid null references public.members(id) on delete set null,
  trainer_id uuid null references public.trainers(id) on delete set null,
  to_phone text not null check (char_length(to_phone) between 8 and 30),
  message text not null check (char_length(message) between 1 and 1000),
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed', 'cancelled')),
  provider text not null default 'provider_agnostic' check (char_length(provider) between 2 and 80),
  provider_message_id text null,
  error_message text null check (error_message is null or char_length(error_message) <= 1000),
  metadata jsonb not null default '{}'::jsonb,
  queued_at timestamptz not null default now(),
  sent_at timestamptz null,
  delivered_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists sms_logs_gym_status_idx on public.sms_logs (gym_id, status, created_at desc);
create index if not exists sms_logs_member_idx on public.sms_logs (member_id, created_at desc) where member_id is not null;
create index if not exists sms_logs_campaign_idx on public.sms_logs (campaign_id, status) where campaign_id is not null;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 180),
  body text not null check (char_length(body) between 2 and 3000),
  category text not null default 'system' check (category in ('general', 'gym_notice', 'holiday', 'maintenance', 'special_event', 'promotion', 'system')),
  target_segment text not null default 'all_members' check (char_length(target_segment) between 2 and 120),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  pinned boolean not null default false,
  starts_at timestamptz null,
  ends_at timestamptz null,
  published_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index if not exists announcements_gym_status_idx on public.announcements (gym_id, status, starts_at desc, pinned desc);
create index if not exists announcements_segment_idx on public.announcements (target_segment, status);

create table if not exists public.communication_automation_rules (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  trigger_key text not null check (trigger_key in ('no_attendance_7_days', 'no_attendance_15_days', 'membership_expiry_30_days', 'membership_expiry_15_days', 'membership_expiry_7_days', 'membership_expiry_1_day', 'class_reminder', 'trainer_session_reminder', 'goal_completed', 'workout_streak_broken')),
  channel text not null check (channel in ('in_app', 'email', 'whatsapp', 'sms', 'multi_channel')),
  template_id uuid null references public.notification_templates(id) on delete set null,
  segment_key text not null default 'all_members' check (char_length(segment_key) between 2 and 120),
  delay_hours integer not null default 0 check (delay_hours between 0 and 8760),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists communication_automation_rules_gym_status_idx on public.communication_automation_rules (gym_id, status, trigger_key);

create table if not exists public.communication_history (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  recipient_user_id uuid null references auth.users(id) on delete set null,
  member_id uuid null references public.members(id) on delete set null,
  trainer_id uuid null references public.trainers(id) on delete set null,
  channel text not null check (channel in ('in_app', 'email', 'whatsapp', 'sms', 'push', 'internal')),
  category text not null check (category in ('membership', 'payments', 'attendance', 'classes', 'workouts', 'nutrition', 'promotions', 'system')),
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound', 'internal')),
  subject text null check (subject is null or char_length(subject) <= 180),
  body text not null check (char_length(body) between 1 and 4000),
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'read', 'opened', 'clicked', 'failed', 'cancelled')),
  source_type text null check (source_type is null or char_length(source_type) <= 80),
  source_id uuid null,
  template_id uuid null references public.notification_templates(id) on delete set null,
  campaign_id uuid null references public.campaigns(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (recipient_user_id is not null or member_id is not null or trainer_id is not null)
);

create index if not exists communication_history_member_idx on public.communication_history (member_id, created_at desc) where member_id is not null;
create index if not exists communication_history_trainer_idx on public.communication_history (trainer_id, created_at desc) where trainer_id is not null;
create index if not exists communication_history_gym_channel_idx on public.communication_history (gym_id, channel, status, created_at desc);
create index if not exists communication_history_campaign_idx on public.communication_history (campaign_id, created_at desc) where campaign_id is not null;

drop trigger if exists set_notification_templates_updated_at on public.notification_templates;
create trigger set_notification_templates_updated_at before update on public.notification_templates for each row execute function public.set_updated_at();
drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at before update on public.notification_preferences for each row execute function public.set_updated_at();
drop trigger if exists set_communication_segments_updated_at on public.communication_segments;
create trigger set_communication_segments_updated_at before update on public.communication_segments for each row execute function public.set_updated_at();
drop trigger if exists set_campaigns_updated_at on public.campaigns;
create trigger set_campaigns_updated_at before update on public.campaigns for each row execute function public.set_updated_at();
drop trigger if exists set_announcements_updated_at on public.announcements;
create trigger set_announcements_updated_at before update on public.announcements for each row execute function public.set_updated_at();
drop trigger if exists set_communication_automation_rules_updated_at on public.communication_automation_rules;
create trigger set_communication_automation_rules_updated_at before update on public.communication_automation_rules for each row execute function public.set_updated_at();

create or replace view public.communication_channel_daily_summary
with (security_invoker = true) as
select
  gym_id,
  date_trunc('day', created_at)::date as communication_date,
  channel,
  status,
  count(*) as total
from public.communication_history
group by gym_id, date_trunc('day', created_at)::date, channel, status;

create or replace view public.campaign_performance_summary
with (security_invoker = true) as
select
  c.gym_id,
  c.id as campaign_id,
  c.name,
  c.campaign_type,
  c.status,
  count(cr.id) as recipients,
  count(cr.id) filter (where cr.status in ('sent', 'delivered', 'opened', 'clicked')) as sent,
  count(cr.id) filter (where cr.status in ('delivered', 'opened', 'clicked')) as delivered,
  count(cr.id) filter (where cr.status in ('opened', 'clicked')) as opened,
  count(cr.id) filter (where cr.status = 'clicked') as clicked,
  count(cr.id) filter (where cr.status = 'failed') as failed
from public.campaigns c
left join public.campaign_recipients cr on cr.campaign_id = c.id
group by c.gym_id, c.id, c.name, c.campaign_type, c.status;

create or replace view public.notification_unread_summary
with (security_invoker = true) as
select
  gym_id,
  user_id,
  member_id,
  trainer_id,
  category,
  count(*) as unread_count,
  count(*) filter (where priority in ('high', 'urgent')) as priority_unread
from public.notifications
where status = 'unread'
group by gym_id, user_id, member_id, trainer_id, category;

alter table public.notification_templates enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.communication_segments enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.email_logs enable row level security;
alter table public.whatsapp_logs enable row level security;
alter table public.sms_logs enable row level security;
alter table public.announcements enable row level security;
alter table public.communication_automation_rules enable row level security;
alter table public.communication_history enable row level security;

grant select, insert, update on public.notification_templates to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert, update on public.notifications to authenticated;
grant select, insert, update on public.communication_segments to authenticated;
grant select, insert, update on public.campaigns to authenticated;
grant select, insert, update on public.campaign_recipients to authenticated;
grant select, insert, update on public.email_logs to authenticated;
grant select, insert, update on public.whatsapp_logs to authenticated;
grant select, insert, update on public.sms_logs to authenticated;
grant select, insert, update on public.announcements to authenticated;
grant select, insert, update on public.communication_automation_rules to authenticated;
grant select, insert on public.communication_history to authenticated;
grant select on public.communication_channel_daily_summary, public.campaign_performance_summary, public.notification_unread_summary to authenticated;

drop policy if exists "communication templates visible in scope" on public.notification_templates;
create policy "communication templates visible in scope"
on public.notification_templates for select to authenticated
using (is_system or gym_id is null or public.is_super_admin() or gym_id = public.current_user_gym_id());

drop policy if exists "staff can manage communication templates" on public.notification_templates;
create policy "staff can manage communication templates"
on public.notification_templates for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "preferences visible to owner or staff" on public.notification_preferences;
create policy "preferences visible to owner or staff"
on public.notification_preferences for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "preferences manageable by owner or staff" on public.notification_preferences;
create policy "preferences manageable by owner or staff"
on public.notification_preferences for all to authenticated
using (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
)
with check (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "notifications visible to recipient or staff" on public.notifications;
create policy "notifications visible to recipient or staff"
on public.notifications for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (select 1 from public.members m where m.id = notifications.member_id and m.user_id = (select auth.uid()))
  or exists (select 1 from public.trainers t where t.id = notifications.trainer_id and t.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "notifications updateable by recipient or staff" on public.notifications;
create policy "notifications updateable by recipient or staff"
on public.notifications for update to authenticated
using (
  user_id = (select auth.uid())
  or exists (select 1 from public.members m where m.id = notifications.member_id and m.user_id = (select auth.uid()))
  or exists (select 1 from public.trainers t where t.id = notifications.trainer_id and t.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
)
with check (
  user_id = (select auth.uid())
  or exists (select 1 from public.members m where m.id = notifications.member_id and m.user_id = (select auth.uid()))
  or exists (select 1 from public.trainers t where t.id = notifications.trainer_id and t.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff trainers can create notifications" on public.notifications;
create policy "staff trainers can create notifications"
on public.notifications for insert to authenticated
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff', 'trainer']))
  or user_id = (select auth.uid())
);

drop policy if exists "segments visible in scope" on public.communication_segments;
create policy "segments visible in scope"
on public.communication_segments for select to authenticated
using (is_system or gym_id is null or public.is_super_admin() or gym_id = public.current_user_gym_id());

drop policy if exists "staff can manage segments" on public.communication_segments;
create policy "staff can manage segments"
on public.communication_segments for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "announcements visible in scope" on public.announcements;
create policy "announcements visible in scope"
on public.announcements for select to authenticated
using (
  status in ('published', 'scheduled')
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can manage announcements" on public.announcements;
create policy "staff can manage announcements"
on public.announcements for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "campaigns visible to staff" on public.campaigns;
create policy "campaigns visible to staff"
on public.campaigns for select to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "staff can manage campaigns" on public.campaigns;
create policy "staff can manage campaigns"
on public.campaigns for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "campaign recipients visible to staff or recipient" on public.campaign_recipients;
create policy "campaign recipients visible to staff or recipient"
on public.campaign_recipients for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (select 1 from public.members m where m.id = campaign_recipients.member_id and m.user_id = (select auth.uid()))
  or exists (select 1 from public.trainers t where t.id = campaign_recipients.trainer_id and t.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can manage campaign recipients" on public.campaign_recipients;
create policy "staff can manage campaign recipients"
on public.campaign_recipients for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "communication logs visible in scope" on public.email_logs;
create policy "communication logs visible in scope"
on public.email_logs for select to authenticated
using (
  recipient_user_id = (select auth.uid())
  or exists (select 1 from public.members m where m.id = email_logs.member_id and m.user_id = (select auth.uid()))
  or exists (select 1 from public.trainers t where t.id = email_logs.trainer_id and t.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can write email logs" on public.email_logs;
create policy "staff can write email logs"
on public.email_logs for insert to authenticated
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff', 'trainer'])));

drop policy if exists "whatsapp logs visible in scope" on public.whatsapp_logs;
create policy "whatsapp logs visible in scope"
on public.whatsapp_logs for select to authenticated
using (
  recipient_user_id = (select auth.uid())
  or exists (select 1 from public.members m where m.id = whatsapp_logs.member_id and m.user_id = (select auth.uid()))
  or exists (select 1 from public.trainers t where t.id = whatsapp_logs.trainer_id and t.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can write whatsapp logs" on public.whatsapp_logs;
create policy "staff can write whatsapp logs"
on public.whatsapp_logs for insert to authenticated
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff', 'trainer'])));

drop policy if exists "sms logs visible in scope" on public.sms_logs;
create policy "sms logs visible in scope"
on public.sms_logs for select to authenticated
using (
  recipient_user_id = (select auth.uid())
  or exists (select 1 from public.members m where m.id = sms_logs.member_id and m.user_id = (select auth.uid()))
  or exists (select 1 from public.trainers t where t.id = sms_logs.trainer_id and t.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff can write sms logs" on public.sms_logs;
create policy "staff can write sms logs"
on public.sms_logs for insert to authenticated
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff', 'trainer'])));

drop policy if exists "automation rules visible to staff" on public.communication_automation_rules;
create policy "automation rules visible to staff"
on public.communication_automation_rules for select to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "staff can manage automation rules" on public.communication_automation_rules;
create policy "staff can manage automation rules"
on public.communication_automation_rules for all to authenticated
using (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])))
with check (public.is_super_admin() or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff'])));

drop policy if exists "communication history visible in scope" on public.communication_history;
create policy "communication history visible in scope"
on public.communication_history for select to authenticated
using (
  recipient_user_id = (select auth.uid())
  or exists (select 1 from public.members m where m.id = communication_history.member_id and m.user_id = (select auth.uid()))
  or exists (select 1 from public.trainers t where t.id = communication_history.trainer_id and t.user_id = (select auth.uid()))
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);

drop policy if exists "staff trainers can write communication history" on public.communication_history;
create policy "staff trainers can write communication history"
on public.communication_history for insert to authenticated
with check (
  public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff', 'trainer']))
  or recipient_user_id = (select auth.uid())
);

with system_segments (name, segment_key, description, definition) as (
  values
    ('All Members', 'all_members', 'Every member record in the gym.', '{"type":"all_members"}'::jsonb),
    ('Active Members', 'active_members', 'Members with an active membership.', '{"membership_status":"active"}'::jsonb),
    ('Expired Members', 'expired_members', 'Members with expired memberships.', '{"membership_status":"expired"}'::jsonb),
    ('Inactive Members', 'inactive_members', 'Members with no recent attendance activity.', '{"attendance_inactive_days":15}'::jsonb),
    ('Premium Members', 'premium_members', 'Members on premium or elite access plans.', '{"access_levels":["premium","elite"]}'::jsonb),
    ('PT Clients', 'pt_clients', 'Members with active personal training packages.', '{"has_active_pt":true}'::jsonb),
    ('Yoga Members', 'yoga_members', 'Members who book or attend yoga classes.', '{"class_category":"yoga"}'::jsonb)
)
insert into public.communication_segments (gym_id, name, segment_key, description, definition, is_system)
select null, name, segment_key, description, definition, true
from system_segments
where not exists (
  select 1 from public.communication_segments existing
  where existing.gym_id is null and existing.segment_key = system_segments.segment_key
);

with system_templates (name, slug, category, channel, subject, body_text, body_html, variables) as (
  values
    ('Welcome Email', 'welcome-email', 'system', 'email', 'Welcome to Apex Performance Club', 'Hi {{member_name}}, welcome to Apex Performance Club. Your member journey starts today.', '<p>Hi {{member_name}},</p><p>Welcome to Apex Performance Club. Your member journey starts today.</p>', '["member_name"]'::jsonb),
    ('Membership Created', 'membership-created', 'membership', 'email', 'Your membership is active', 'Hi {{member_name}}, your {{plan_name}} membership is active until {{expiry_date}}.', '<p>Hi {{member_name}}, your <strong>{{plan_name}}</strong> membership is active until {{expiry_date}}.</p>', '["member_name","plan_name","expiry_date"]'::jsonb),
    ('Membership Expiry Reminder', 'membership-expiry-reminder', 'membership', 'whatsapp', null, 'Hi {{member_name}}, your membership expires on {{expiry_date}}. Renew now to keep training without interruption.', null, '["member_name","expiry_date"]'::jsonb),
    ('Payment Success', 'payment-success', 'payments', 'email', 'Payment received', 'Hi {{member_name}}, we received your payment of {{amount}}. Thank you.', '<p>Hi {{member_name}}, we received your payment of <strong>{{amount}}</strong>. Thank you.</p>', '["member_name","amount"]'::jsonb),
    ('Class Reminder', 'class-reminder', 'classes', 'in_app', null, '{{class_name}} starts at {{class_time}}. Please arrive 10 minutes early.', null, '["class_name","class_time"]'::jsonb),
    ('Workout Reminder', 'workout-reminder', 'workouts', 'push', null, 'Your workout is waiting. Keep the routine moving today.', null, '[]'::jsonb),
    ('Goal Achievement', 'goal-achievement', 'workouts', 'email', 'Goal achieved', 'Strong work, {{member_name}}. You completed {{goal_title}}.', '<p>Strong work, {{member_name}}. You completed <strong>{{goal_title}}</strong>.</p>', '["member_name","goal_title"]'::jsonb),
    ('Trainer Assignment', 'trainer-assignment', 'system', 'email', 'Trainer assigned', 'Hi {{member_name}}, {{trainer_name}} has been assigned as your trainer.', '<p>Hi {{member_name}}, {{trainer_name}} has been assigned as your trainer.</p>', '["member_name","trainer_name"]'::jsonb)
)
insert into public.notification_templates (gym_id, name, slug, category, channel, subject, body_text, body_html, variables, is_system, status)
select null, name, slug, category, channel, subject, body_text, body_html, variables, true, 'active'
from system_templates
where not exists (
  select 1
  from public.notification_templates existing
  where existing.gym_id is null
    and existing.slug = system_templates.slug
    and existing.channel = system_templates.channel
);
