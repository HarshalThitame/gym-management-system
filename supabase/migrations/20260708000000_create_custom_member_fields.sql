-- Phase 1.3: Custom Member Fields + Member Data Import/Export
-- Creates tables for org-level custom field definitions and per-member values

create table public.custom_member_fields (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  field_name text not null,
  field_type text not null check (field_type in ('text', 'number', 'date', 'select')),
  options jsonb default '[]'::jsonb,
  required boolean default false,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.member_custom_field_values (
  id uuid default gen_random_uuid() primary key,
  member_id uuid not null references public.members(id) on delete cascade,
  field_id uuid not null references public.custom_member_fields(id) on delete cascade,
  value text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (member_id, field_id)
);

-- Indexes
create index if not exists custom_member_fields_org_idx on public.custom_member_fields (organization_id);
create index if not exists member_custom_field_values_member_idx on public.member_custom_field_values (member_id);
create index if not exists member_custom_field_values_field_idx on public.member_custom_field_values (field_id);

-- RLS: enable
alter table public.custom_member_fields enable row level security;
alter table public.member_custom_field_values enable row level security;

-- RLS policies for custom_member_fields
create policy "org owners can select own custom fields"
  on public.custom_member_fields
  for select
  to authenticated
  using (
    organization_id in (
      select id from public.organizations where owner_user_id = auth.uid()
    )
  );

create policy "org owners can insert own custom fields"
  on public.custom_member_fields
  for insert
  to authenticated
  with check (
    organization_id in (
      select id from public.organizations where owner_user_id = auth.uid()
    )
  );

create policy "org owners can update own custom fields"
  on public.custom_member_fields
  for update
  to authenticated
  using (
    organization_id in (
      select id from public.organizations where owner_user_id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select id from public.organizations where owner_user_id = auth.uid()
    )
  );

create policy "org owners can delete own custom fields"
  on public.custom_member_fields
  for delete
  to authenticated
  using (
    organization_id in (
      select id from public.organizations where owner_user_id = auth.uid()
    )
  );

-- RLS policies for member_custom_field_values
create policy "org owners can select values via org"
  on public.member_custom_field_values
  for select
  to authenticated
  using (
    member_id in (
      select m.id from public.members m
      join public.gyms g on g.id = m.gym_id
      where g.organization_id in (
        select id from public.organizations where owner_user_id = auth.uid()
      )
    )
  );

create policy "org owners can insert values via org"
  on public.member_custom_field_values
  for insert
  to authenticated
  with check (
    member_id in (
      select m.id from public.members m
      join public.gyms g on g.id = m.gym_id
      where g.organization_id in (
        select id from public.organizations where owner_user_id = auth.uid()
      )
    )
  );

create policy "org owners can update values via org"
  on public.member_custom_field_values
  for update
  to authenticated
  using (
    member_id in (
      select m.id from public.members m
      join public.gyms g on g.id = m.gym_id
      where g.organization_id in (
        select id from public.organizations where owner_user_id = auth.uid()
      )
    )
  )
  with check (
    member_id in (
      select m.id from public.members m
      join public.gyms g on g.id = m.gym_id
      where g.organization_id in (
        select id from public.organizations where owner_user_id = auth.uid()
      )
    )
  );

create policy "org owners can delete values via org"
  on public.member_custom_field_values
  for delete
  to authenticated
  using (
    member_id in (
      select m.id from public.members m
      join public.gyms g on g.id = m.gym_id
      where g.organization_id in (
        select id from public.organizations where owner_user_id = auth.uid()
      )
    )
  );
