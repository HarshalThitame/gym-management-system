create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete set null,
  user_id uuid null references auth.users(id) on delete set null,
  member_code text not null,
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text null,
  phone text not null check (char_length(phone) between 8 and 20),
  date_of_birth date null check (date_of_birth is null or date_of_birth <= current_date),
  gender text null check (gender is null or gender in ('female', 'male', 'non_binary', 'prefer_not_to_say')),
  address text null check (address is null or char_length(address) <= 500),
  emergency_contact_name text null check (emergency_contact_name is null or char_length(emergency_contact_name) <= 120),
  emergency_contact_phone text null check (emergency_contact_phone is null or char_length(emergency_contact_phone) between 8 and 20),
  profile_photo_url text null,
  assigned_trainer_id uuid null references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  joined_at date not null default current_date,
  created_by uuid null references auth.users(id) on delete set null,
  notes text null check (notes is null or char_length(notes) <= 1000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, member_code)
);

create table if not exists public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null check (char_length(description) between 10 and 800),
  plan_type text not null check (plan_type in ('monthly', 'quarterly', 'half_yearly', 'annual', 'custom')),
  duration_days integer not null check (duration_days > 0 and duration_days <= 1095),
  price_amount integer not null check (price_amount >= 0),
  joining_fee_amount integer not null default 0 check (joining_fee_amount >= 0),
  currency text not null default 'INR',
  access_level text not null default 'standard' check (access_level in ('basic', 'standard', 'premium', 'elite', 'custom')),
  features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  is_public boolean not null default true,
  display_order integer not null default 100,
  created_by uuid null references auth.users(id) on delete set null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, slug)
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  membership_plan_id uuid not null references public.membership_plans(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'cancelled', 'frozen', 'suspended')),
  start_date date not null,
  end_date date not null,
  activated_at timestamptz null,
  cancelled_at timestamptz null,
  frozen_at timestamptz null,
  suspended_at timestamptz null,
  renewal_of_membership_id uuid null references public.memberships(id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'online', 'imported')),
  price_amount integer not null check (price_amount >= 0),
  joining_fee_amount integer not null default 0 check (joining_fee_amount >= 0),
  discount_amount integer not null default 0 check (discount_amount >= 0),
  total_amount integer generated always as (greatest(price_amount + joining_fee_amount - discount_amount, 0)) stored,
  invoice_number text null,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'partially_paid', 'waived')),
  notes text null check (notes is null or char_length(notes) <= 1000),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create unique index if not exists memberships_one_open_membership_idx
on public.memberships (member_id)
where status in ('pending', 'active', 'frozen', 'suspended');

create table if not exists public.membership_history (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  event text not null check (event in ('created', 'renewed', 'upgraded', 'downgraded', 'frozen', 'suspended', 'reactivated', 'cancelled', 'expired', 'plan_changed', 'dates_changed')),
  from_plan_id uuid null references public.membership_plans(id) on delete set null,
  to_plan_id uuid null references public.membership_plans(id) on delete set null,
  from_status text null,
  to_status text null,
  previous_start_date date null,
  previous_end_date date null,
  new_start_date date null,
  new_end_date date null,
  reason text null check (reason is null or char_length(reason) <= 500),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.membership_status_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  from_status text null,
  to_status text not null check (to_status in ('pending', 'active', 'expired', 'cancelled', 'frozen', 'suspended')),
  reason text null check (reason is null or char_length(reason) <= 500),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.member_documents (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  document_type text not null check (document_type in ('profile_photo', 'identity_proof', 'medical_declaration', 'membership_agreement', 'other')),
  file_name text not null check (char_length(file_name) between 1 and 180),
  file_path text not null,
  file_url text not null,
  mime_type text not null,
  file_size integer not null check (file_size > 0 and file_size <= 10485760),
  uploaded_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.membership_notification_events (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  event_type text not null check (event_type in ('membership_created', 'expiry_reminder', 'renewal_reminder', 'membership_expired')),
  channel text not null default 'system' check (channel in ('system', 'email', 'whatsapp', 'sms', 'push')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'cancelled')),
  scheduled_for timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists members_gym_status_idx on public.members (gym_id, status);
create index if not exists members_gym_joined_at_idx on public.members (gym_id, joined_at desc);
create index if not exists members_gym_name_idx on public.members (gym_id, lower(full_name));
create index if not exists members_gym_phone_idx on public.members (gym_id, phone);
create index if not exists members_gym_email_idx on public.members (gym_id, lower(email));
create index if not exists members_assigned_trainer_idx on public.members (assigned_trainer_id);
create index if not exists membership_plans_gym_status_idx on public.membership_plans (gym_id, status, display_order);
create index if not exists membership_plans_plan_type_idx on public.membership_plans (gym_id, plan_type);
create index if not exists memberships_gym_status_idx on public.memberships (gym_id, status);
create index if not exists memberships_gym_end_date_idx on public.memberships (gym_id, end_date, status);
create index if not exists memberships_member_created_idx on public.memberships (member_id, created_at desc);
create index if not exists memberships_plan_idx on public.memberships (membership_plan_id);
create unique index if not exists memberships_invoice_number_idx on public.memberships (gym_id, invoice_number) where invoice_number is not null;
create index if not exists membership_history_membership_created_idx on public.membership_history (membership_id, created_at desc);
create index if not exists membership_history_member_created_idx on public.membership_history (member_id, created_at desc);
create index if not exists membership_status_logs_membership_created_idx on public.membership_status_logs (membership_id, created_at desc);
create index if not exists member_documents_member_created_idx on public.member_documents (member_id, created_at desc);
create index if not exists membership_notification_events_due_idx on public.membership_notification_events (event_type, status, scheduled_for);

drop trigger if exists set_members_updated_at on public.members;
create trigger set_members_updated_at
before update on public.members
for each row execute function public.set_updated_at();

drop trigger if exists set_membership_plans_updated_at on public.membership_plans;
create trigger set_membership_plans_updated_at
before update on public.membership_plans
for each row execute function public.set_updated_at();

drop trigger if exists set_memberships_updated_at on public.memberships;
create trigger set_memberships_updated_at
before update on public.memberships
for each row execute function public.set_updated_at();

create or replace function public.generate_member_code(target_gym_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  select coalesce(count(*), 0) + 1 into next_number
  from public.members
  where gym_id is not distinct from target_gym_id;

  return 'APX-' || lpad(next_number::text, 5, '0');
end;
$$;

create or replace view public.membership_expiry_summary as
select
  memberships.gym_id,
  count(*) filter (where memberships.status = 'active') as active_memberships,
  count(*) filter (where memberships.status = 'expired') as expired_memberships,
  count(*) filter (where memberships.status = 'active' and memberships.end_date = current_date) as expiring_today,
  count(*) filter (where memberships.status = 'active' and memberships.end_date between current_date and current_date + interval '7 days') as expiring_this_week,
  count(*) filter (where memberships.status = 'active' and memberships.end_date between current_date and current_date + interval '30 days') as expiring_this_month,
  count(*) filter (where memberships.created_at >= date_trunc('month', now())) as new_memberships_this_month
from public.memberships
group by memberships.gym_id;

create or replace view public.membership_revenue_summary as
select
  memberships.gym_id,
  date_trunc('month', memberships.created_at)::date as month,
  count(*) as membership_count,
  sum(memberships.total_amount) as total_amount
from public.memberships
where memberships.payment_status in ('paid', 'waived')
group by memberships.gym_id, date_trunc('month', memberships.created_at)::date;

alter table public.members enable row level security;
alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_history enable row level security;
alter table public.membership_status_logs enable row level security;
alter table public.member_documents enable row level security;
alter table public.membership_notification_events enable row level security;

grant select, insert, update on public.members to authenticated;
grant select, insert, update on public.membership_plans to authenticated;
grant select, insert, update on public.memberships to authenticated;
grant select, insert on public.membership_history to authenticated;
grant select, insert on public.membership_status_logs to authenticated;
grant select, insert, update, delete on public.member_documents to authenticated;
grant select, insert, update on public.membership_notification_events to authenticated;
grant select on public.membership_expiry_summary to authenticated;
grant select on public.membership_revenue_summary to authenticated;

drop policy if exists "members visible to owner assigned trainer or staff" on public.members;
create policy "members visible to owner assigned trainer or staff"
on public.members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or assigned_trainer_id = (select auth.uid())
  or public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
);

drop policy if exists "staff can create members in scope" on public.members;
create policy "staff can create members in scope"
on public.members
for insert
to authenticated
with check (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
);

drop policy if exists "staff can update members in scope" on public.members;
create policy "staff can update members in scope"
on public.members
for update
to authenticated
using (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
)
with check (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
);

drop policy if exists "plans visible to authenticated users in scope" on public.membership_plans;
create policy "plans visible to authenticated users in scope"
on public.membership_plans
for select
to authenticated
using (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and (
      public.has_any_role(array['gym_admin', 'reception_staff'])
      or status = 'active'
    )
  )
  or gym_id is null
);

drop policy if exists "admins can create plans in scope" on public.membership_plans;
create policy "admins can create plans in scope"
on public.membership_plans
for insert
to authenticated
with check (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_role('gym_admin')
  )
);

drop policy if exists "admins can update plans in scope" on public.membership_plans;
create policy "admins can update plans in scope"
on public.membership_plans
for update
to authenticated
using (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_role('gym_admin')
  )
)
with check (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_role('gym_admin')
  )
);

drop policy if exists "memberships visible to owner assigned trainer or staff" on public.memberships;
create policy "memberships visible to owner assigned trainer or staff"
on public.memberships
for select
to authenticated
using (
  exists (
    select 1
    from public.members
    where members.id = memberships.member_id
      and (
        members.user_id = (select auth.uid())
        or members.assigned_trainer_id = (select auth.uid())
      )
  )
  or public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
);

drop policy if exists "staff can create memberships in scope" on public.memberships;
create policy "staff can create memberships in scope"
on public.memberships
for insert
to authenticated
with check (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
);

drop policy if exists "staff can update memberships in scope" on public.memberships;
create policy "staff can update memberships in scope"
on public.memberships
for update
to authenticated
using (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
)
with check (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
);

drop policy if exists "membership history visible in membership scope" on public.membership_history;
create policy "membership history visible in membership scope"
on public.membership_history
for select
to authenticated
using (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
  or exists (
    select 1
    from public.members
    where members.id = membership_history.member_id
      and members.user_id = (select auth.uid())
  )
);

drop policy if exists "staff can insert membership history" on public.membership_history;
create policy "staff can insert membership history"
on public.membership_history
for insert
to authenticated
with check (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
);

drop policy if exists "membership status logs visible in membership scope" on public.membership_status_logs;
create policy "membership status logs visible in membership scope"
on public.membership_status_logs
for select
to authenticated
using (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
  or exists (
    select 1
    from public.members
    where members.id = membership_status_logs.member_id
      and members.user_id = (select auth.uid())
  )
);

drop policy if exists "staff can insert membership status logs" on public.membership_status_logs;
create policy "staff can insert membership status logs"
on public.membership_status_logs
for insert
to authenticated
with check (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
);

drop policy if exists "member documents visible in member scope" on public.member_documents;
create policy "member documents visible in member scope"
on public.member_documents
for select
to authenticated
using (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
  or exists (
    select 1
    from public.members
    where members.id = member_documents.member_id
      and (
        members.user_id = (select auth.uid())
        or members.assigned_trainer_id = (select auth.uid())
      )
  )
);

drop policy if exists "staff can manage member documents" on public.member_documents;
create policy "staff can manage member documents"
on public.member_documents
for all
to authenticated
using (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
)
with check (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
);

drop policy if exists "staff can manage membership notifications" on public.membership_notification_events;
create policy "staff can manage membership notifications"
on public.membership_notification_events
for all
to authenticated
using (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
)
with check (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-documents',
  'member-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "staff can read member document files" on storage.objects;
create policy "staff can read member document files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'member-documents'
  and (
    public.is_super_admin()
    or public.has_any_role(array['gym_admin', 'reception_staff'])
  )
);

drop policy if exists "staff can upload member document files" on storage.objects;
create policy "staff can upload member document files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'member-documents'
  and (
    public.is_super_admin()
    or public.has_any_role(array['gym_admin', 'reception_staff'])
  )
);

drop policy if exists "staff can update member document files" on storage.objects;
create policy "staff can update member document files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'member-documents'
  and (
    public.is_super_admin()
    or public.has_any_role(array['gym_admin', 'reception_staff'])
  )
)
with check (
  bucket_id = 'member-documents'
  and (
    public.is_super_admin()
    or public.has_any_role(array['gym_admin', 'reception_staff'])
  )
);

drop policy if exists "staff can delete member document files" on storage.objects;
create policy "staff can delete member document files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'member-documents'
  and (
    public.is_super_admin()
    or public.has_any_role(array['gym_admin', 'reception_staff'])
  )
);
