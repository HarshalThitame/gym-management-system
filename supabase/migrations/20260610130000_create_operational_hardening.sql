create table if not exists public.api_rate_limits (
  key text primary key,
  count integer not null default 0 check (count >= 0),
  reset_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists api_rate_limits_reset_idx on public.api_rate_limits (reset_at);

alter table public.api_rate_limits enable row level security;

revoke all on public.api_rate_limits from anon, authenticated;

drop trigger if exists set_api_rate_limits_updated_at on public.api_rate_limits;
create trigger set_api_rate_limits_updated_at before update on public.api_rate_limits for each row execute function public.set_updated_at();

create or replace function public.check_api_rate_limit(bucket_key text, max_requests integer, window_seconds integer)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  current_reset timestamptz;
  next_reset timestamptz;
begin
  if bucket_key is null or length(trim(bucket_key)) = 0 then
    raise exception 'rate limit key is required';
  end if;

  if max_requests <= 0 or window_seconds <= 0 then
    raise exception 'rate limit arguments must be positive';
  end if;

  next_reset := now() + make_interval(secs => window_seconds);

  insert into public.api_rate_limits as limits (key, count, reset_at)
  values (bucket_key, 1, next_reset)
  on conflict (key) do update
  set
    count = case
      when limits.reset_at <= now() then 1
      else limits.count + 1
    end,
    reset_at = case
      when limits.reset_at <= now() then excluded.reset_at
      else limits.reset_at
    end,
    updated_at = now()
  returning limits.count, limits.reset_at into current_count, current_reset;

  allowed := current_count <= max_requests;
  remaining := greatest(max_requests - current_count, 0);
  reset_at := current_reset;
  return next;
end;
$$;

grant execute on function public.check_api_rate_limit(text, integer, integer) to service_role;

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
    )
    or exists (
      select 1
      from public.branches b
      join public.branch_users bu on bu.branch_id = b.id
      where b.gym_id = target_gym_id
        and bu.user_id = (select auth.uid())
        and bu.status = 'active'
    );
$$;

create or replace function public.storage_object_first_uuid(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  first_segment text;
begin
  first_segment := (storage.foldername(object_name))[1];
  return first_segment::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

grant execute on function public.storage_object_first_uuid(text) to authenticated;

drop policy if exists "staff can read invoice PDFs" on storage.objects;
drop policy if exists "staff can upload invoice PDFs" on storage.objects;

create policy "invoice PDFs visible in tenant scope"
on storage.objects for select to authenticated
using (
  bucket_id = 'invoices'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.invoices i
      join public.members m on m.id = i.member_id
      where i.id = public.storage_object_first_uuid(storage.objects.name)
        and (
          public.can_access_gym(i.gym_id)
          or m.user_id = (select auth.uid())
        )
    )
  )
);

create policy "invoice PDFs uploadable by tenant staff"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'invoices'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.invoices i
      where i.id = public.storage_object_first_uuid(storage.objects.name)
        and public.can_access_gym(i.gym_id)
        and public.has_any_role(array['gym_admin', 'reception_staff'])
    )
  )
);

drop policy if exists "staff can read member document files" on storage.objects;
drop policy if exists "staff can upload member document files" on storage.objects;
drop policy if exists "staff can update member document files" on storage.objects;
drop policy if exists "staff can delete member document files" on storage.objects;

create policy "member documents visible in owner or tenant staff scope"
on storage.objects for select to authenticated
using (
  bucket_id = 'member-documents'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.members m
      where m.id = public.storage_object_first_uuid(storage.objects.name)
        and (
          m.user_id = (select auth.uid())
          or (
            public.can_access_gym(m.gym_id)
            and public.has_any_role(array['gym_admin', 'reception_staff'])
          )
        )
    )
  )
);

create policy "member documents uploadable by tenant staff"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'member-documents'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.members m
      where m.id = public.storage_object_first_uuid(storage.objects.name)
        and public.can_access_gym(m.gym_id)
        and public.has_any_role(array['gym_admin', 'reception_staff'])
    )
  )
);

create policy "member documents updatable by tenant staff"
on storage.objects for update to authenticated
using (
  bucket_id = 'member-documents'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.members m
      where m.id = public.storage_object_first_uuid(storage.objects.name)
        and public.can_access_gym(m.gym_id)
        and public.has_any_role(array['gym_admin', 'reception_staff'])
    )
  )
)
with check (
  bucket_id = 'member-documents'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.members m
      where m.id = public.storage_object_first_uuid(storage.objects.name)
        and public.can_access_gym(m.gym_id)
        and public.has_any_role(array['gym_admin', 'reception_staff'])
    )
  )
);

create policy "member documents deletable by tenant staff"
on storage.objects for delete to authenticated
using (
  bucket_id = 'member-documents'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.members m
      where m.id = public.storage_object_first_uuid(storage.objects.name)
        and public.can_access_gym(m.gym_id)
        and public.has_any_role(array['gym_admin', 'reception_staff'])
    )
  )
);

drop policy if exists "authenticated can read progress photos" on storage.objects;
drop policy if exists "authenticated can upload progress photos" on storage.objects;
drop policy if exists "authenticated can update progress photos" on storage.objects;
drop policy if exists "authenticated can delete progress photos" on storage.objects;

create policy "progress photos visible in owner trainer or tenant staff scope"
on storage.objects for select to authenticated
using (
  bucket_id = 'progress-photos'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.members m
      where m.id = public.storage_object_first_uuid(storage.objects.name)
        and (
          m.user_id = (select auth.uid())
          or public.is_trainer_for_member(m.id)
          or (
            public.can_access_gym(m.gym_id)
            and public.has_any_role(array['gym_admin', 'reception_staff'])
          )
        )
    )
  )
);

create policy "progress photos uploadable in owner trainer or tenant staff scope"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'progress-photos'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.members m
      where m.id = public.storage_object_first_uuid(storage.objects.name)
        and (
          m.user_id = (select auth.uid())
          or public.is_trainer_for_member(m.id)
          or (
            public.can_access_gym(m.gym_id)
            and public.has_any_role(array['gym_admin', 'reception_staff'])
          )
        )
    )
  )
);

create policy "progress photos updatable in owner trainer or tenant staff scope"
on storage.objects for update to authenticated
using (
  bucket_id = 'progress-photos'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.members m
      where m.id = public.storage_object_first_uuid(storage.objects.name)
        and (
          m.user_id = (select auth.uid())
          or public.is_trainer_for_member(m.id)
          or (
            public.can_access_gym(m.gym_id)
            and public.has_any_role(array['gym_admin', 'reception_staff'])
          )
        )
    )
  )
)
with check (
  bucket_id = 'progress-photos'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.members m
      where m.id = public.storage_object_first_uuid(storage.objects.name)
        and (
          m.user_id = (select auth.uid())
          or public.is_trainer_for_member(m.id)
          or (
            public.can_access_gym(m.gym_id)
            and public.has_any_role(array['gym_admin', 'reception_staff'])
          )
        )
    )
  )
);

create policy "progress photos deletable in owner trainer or tenant staff scope"
on storage.objects for delete to authenticated
using (
  bucket_id = 'progress-photos'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.members m
      where m.id = public.storage_object_first_uuid(storage.objects.name)
        and (
          m.user_id = (select auth.uid())
          or public.is_trainer_for_member(m.id)
          or (
            public.can_access_gym(m.gym_id)
            and public.has_any_role(array['gym_admin', 'reception_staff'])
          )
        )
    )
  )
);

drop policy if exists "staff can read trainer certificate files" on storage.objects;
drop policy if exists "staff or trainers can upload trainer certificates" on storage.objects;

create policy "trainer certificate files visible in trainer or tenant staff scope"
on storage.objects for select to authenticated
using (
  bucket_id = 'trainer-certificates'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.trainers t
      where t.id = public.storage_object_first_uuid(storage.objects.name)
        and (
          t.user_id = (select auth.uid())
          or (
            public.can_access_gym(t.gym_id)
            and public.has_any_role(array['gym_admin', 'reception_staff'])
          )
        )
    )
  )
);

create policy "trainer certificate files uploadable in trainer or tenant admin scope"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'trainer-certificates'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.trainers t
      where t.id = public.storage_object_first_uuid(storage.objects.name)
        and (
          t.user_id = (select auth.uid())
          or (
            public.can_access_gym(t.gym_id)
            and public.has_any_role(array['gym_admin'])
          )
        )
    )
  )
);
