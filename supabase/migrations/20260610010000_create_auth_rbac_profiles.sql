create extension if not exists pgcrypto;

create table if not exists public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR',
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  gym_id uuid null references public.gyms(id) on delete set null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  email text null,
  phone text null check (phone is null or char_length(phone) between 8 and 20),
  avatar_url text null,
  status text not null default 'active' check (status in ('active', 'invited', 'suspended', 'archived')),
  emergency_contact_name text null check (emergency_contact_name is null or char_length(emergency_contact_name) <= 120),
  emergency_contact_phone text null check (emergency_contact_phone is null or char_length(emergency_contact_phone) between 8 and 20),
  notification_preferences jsonb not null default '{"email": true, "sms": false, "whatsapp": true}'::jsonb,
  privacy_settings jsonb not null default '{"profile_visible_to_trainers": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('super_admin', 'gym_admin', 'reception_staff', 'trainer', 'member')),
  display_name text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  gym_id uuid null references public.gyms(id) on delete cascade,
  assigned_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, role_id, gym_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete set null,
  actor_id uuid null references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 3 and 100),
  entity_type text not null check (char_length(entity_type) between 2 and 80),
  entity_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet null,
  user_agent text null,
  created_at timestamptz not null default now()
);

insert into public.roles (name, display_name, description)
values
  ('super_admin', 'Super Admin', 'Platform-wide administrator with access to every gym and all protected operations.'),
  ('gym_admin', 'Gym Admin', 'Gym owner or manager with full operational control within one gym.'),
  ('reception_staff', 'Reception Staff', 'Front-desk operator with member, lead, attendance, and limited payment permissions.'),
  ('trainer', 'Trainer', 'Fitness coach with access to assigned members, classes, and plans.'),
  ('member', 'Member', 'Gym member with access to personal portal data and self-service actions.')
on conflict (name) do update
set
  display_name = excluded.display_name,
  description = excluded.description;

create index if not exists gyms_status_idx on public.gyms (status);
create index if not exists profiles_gym_status_idx on public.profiles (gym_id, status);
create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_phone_idx on public.profiles (phone);
create index if not exists user_roles_user_id_idx on public.user_roles (user_id);
create index if not exists user_roles_role_id_idx on public.user_roles (role_id);
create index if not exists user_roles_gym_id_idx on public.user_roles (gym_id);
create unique index if not exists user_roles_unique_global_idx on public.user_roles (user_id, role_id) where gym_id is null;
create unique index if not exists user_roles_unique_gym_idx on public.user_roles (user_id, role_id, gym_id) where gym_id is not null;
create index if not exists audit_logs_gym_created_at_idx on public.audit_logs (gym_id, created_at desc);
create index if not exists audit_logs_actor_created_at_idx on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_gyms_updated_at on public.gyms;
create trigger set_gyms_updated_at
before update on public.gyms
for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.current_user_gym_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.gym_id
  from public.profiles p
  where p.id = (select auth.uid())
  limit 1;
$$;

create or replace function public.has_role(role_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and r.name = role_name
  );
$$;

create or replace function public.has_any_role(role_names text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and r.name = any(role_names)
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('super_admin');
$$;

create or replace function public.can_access_gym(target_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or (
      target_gym_id is not null
      and target_gym_id = public.current_user_gym_id()
      and public.has_any_role(array['gym_admin', 'reception_staff', 'trainer', 'member'])
    );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  selected_role text;
  selected_role_id uuid;
  selected_gym_id uuid;
begin
  requested_role := coalesce(new.raw_app_meta_data->>'default_role', 'member');
  selected_role := case
    when requested_role in ('super_admin', 'gym_admin', 'reception_staff', 'trainer', 'member') then requested_role
    else 'member'
  end;

  selected_gym_id := nullif(new.raw_app_meta_data->>'gym_id', '')::uuid;

  insert into public.profiles (id, gym_id, full_name, email, phone, status)
  values (
    new.id,
    selected_gym_id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    nullif(new.raw_user_meta_data->>'phone', ''),
    case when new.raw_app_meta_data ? 'invited_by' then 'invited' else 'active' end
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end,
    phone = coalesce(public.profiles.phone, excluded.phone),
    updated_at = now();

  select id into selected_role_id from public.roles where name = selected_role;

  if selected_role_id is not null then
    insert into public.user_roles (user_id, role_id, gym_id)
    values (new.id, selected_role_id, selected_gym_id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.gyms enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_logs enable row level security;

grant select on public.gyms to authenticated;
grant select on public.roles to authenticated;
grant select on public.profiles to authenticated;
grant update (
  full_name,
  phone,
  avatar_url,
  emergency_contact_name,
  emergency_contact_phone,
  notification_preferences,
  privacy_settings,
  updated_at
) on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.audit_logs to authenticated;
grant insert on public.audit_logs to service_role;

drop policy if exists "authenticated users can read active gyms in scope" on public.gyms;
create policy "authenticated users can read active gyms in scope"
on public.gyms
for select
to authenticated
using (
  status = 'active'
  and (
    public.is_super_admin()
    or id = public.current_user_gym_id()
  )
);

drop policy if exists "users can read own profile or staff can read gym profiles" on public.profiles;
create policy "users can read own profile or staff can read gym profiles"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (
    id = (select auth.uid())
    or public.is_super_admin()
    or (
      gym_id = public.current_user_gym_id()
      and public.has_any_role(array['gym_admin', 'reception_staff'])
    )
  )
);

drop policy if exists "users can update own profile preferences" on public.profiles;
create policy "users can update own profile preferences"
on public.profiles
for update
to authenticated
using (
  status in ('active', 'invited')
  and id = (select auth.uid())
)
with check (
  id = (select auth.uid())
);

drop policy if exists "authenticated users can read role catalog" on public.roles;
create policy "authenticated users can read role catalog"
on public.roles
for select
to authenticated
using (true);

drop policy if exists "users and staff can read role assignments" on public.user_roles;
create policy "users and staff can read role assignments"
on public.user_roles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin'])
  )
);

drop policy if exists "staff can read audit logs in scope" on public.audit_logs;
create policy "staff can read audit logs in scope"
on public.audit_logs
for select
to authenticated
using (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin'])
  )
);

create index if not exists leads_gym_status_created_at_idx on public.leads (gym_id, status, created_at desc);

drop policy if exists "staff can read leads in scope" on public.leads;
create policy "staff can read leads in scope"
on public.leads
for select
to authenticated
using (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
);

drop policy if exists "staff can update leads in scope" on public.leads;
create policy "staff can update leads in scope"
on public.leads
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can read avatars" on storage.objects;
create policy "public can read avatars"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

drop policy if exists "users can upload own avatars" on storage.objects;
create policy "users can upload own avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "users can update own avatars" on storage.objects;
create policy "users can update own avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "users can delete own avatars" on storage.objects;
create policy "users can delete own avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
