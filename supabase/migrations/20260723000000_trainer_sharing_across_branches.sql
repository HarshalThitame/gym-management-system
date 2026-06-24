-- Phase 3.2: Trainer Sharing Across Branches
-- Junction table: trainer_gym_assignments allows trainers to serve multiple gyms
-- within the same organization, with conflict prevention across all assigned gyms.

create table if not exists public.trainer_gym_assignments (
  id uuid default gen_random_uuid() primary key,
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  is_primary boolean default false,
  assigned_at timestamptz default now(),
  unique (trainer_id, gym_id)
);

create index if not exists trainer_gym_assignments_trainer_idx
  on public.trainer_gym_assignments (trainer_id);

create index if not exists trainer_gym_assignments_gym_idx
  on public.trainer_gym_assignments (gym_id);

create index if not exists trainer_gym_assignments_org_idx
  on public.trainer_gym_assignments (organization_id);

alter table if exists public.trainer_gym_assignments enable row level security;

drop policy if exists "Organization owners can manage trainer gym assignments" on public.trainer_gym_assignments;
create policy "Organization owners can manage trainer gym assignments"
  on public.trainer_gym_assignments for all
  to authenticated
  using (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid() and status = 'active'
    )
  );

-- Backfill: mark existing trainer gym_id as primary assignment
insert into public.trainer_gym_assignments (trainer_id, gym_id, organization_id, is_primary)
select
  t.id,
  t.gym_id,
  g.organization_id,
  true
from public.trainers t
join public.gyms g on g.id = t.gym_id
where t.gym_id is not null
  and not exists (
    select 1 from public.trainer_gym_assignments tga
    where tga.trainer_id = t.id and tga.gym_id = t.gym_id
  );
