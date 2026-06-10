with auth_user_defaults as (
  select
    u.id,
    u.email,
    coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), u.email, 'Member') as full_name,
    nullif(u.raw_user_meta_data->>'phone', '') as phone,
    case
      when coalesce(u.raw_app_meta_data->>'default_role', 'member') in ('super_admin', 'gym_admin', 'reception_staff', 'trainer', 'member')
        then coalesce(u.raw_app_meta_data->>'default_role', 'member')
      else 'member'
    end as role_name,
    case
      when nullif(u.raw_app_meta_data->>'gym_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then nullif(u.raw_app_meta_data->>'gym_id', '')::uuid
      else null
    end as gym_id
  from auth.users u
)
insert into public.profiles (id, gym_id, full_name, email, phone, status)
select id, gym_id, full_name, email, phone, 'active'
from auth_user_defaults
on conflict (id) do update
set
  email = excluded.email,
  full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end,
  phone = coalesce(public.profiles.phone, excluded.phone),
  updated_at = now();

with auth_user_defaults as (
  select
    u.id,
    case
      when coalesce(u.raw_app_meta_data->>'default_role', 'member') in ('super_admin', 'gym_admin', 'reception_staff', 'trainer', 'member')
        then coalesce(u.raw_app_meta_data->>'default_role', 'member')
      else 'member'
    end as role_name,
    case
      when nullif(u.raw_app_meta_data->>'gym_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then nullif(u.raw_app_meta_data->>'gym_id', '')::uuid
      else null
    end as gym_id
  from auth.users u
)
insert into public.user_roles (user_id, role_id, gym_id)
select aud.id, r.id, aud.gym_id
from auth_user_defaults aud
join public.roles r on r.name = aud.role_name
where not exists (
  select 1
  from public.user_roles ur
  where ur.user_id = aud.id
)
on conflict do nothing;
