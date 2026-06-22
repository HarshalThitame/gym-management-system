-- Phase 1.4: Trainer Ratings table for Trainer Performance Report
-- Enables avg rating aggregation per trainer

create table public.trainer_ratings (
  id uuid default gen_random_uuid() primary key,
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  gym_id uuid references public.gyms(id) on delete set null,
  member_id uuid references public.members(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  rating numeric not null check (rating >= 1 and rating <= 5),
  review_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists trainer_ratings_trainer_idx on public.trainer_ratings (trainer_id);
create index if not exists trainer_ratings_org_idx on public.trainer_ratings (organization_id);
create index if not exists trainer_ratings_gym_idx on public.trainer_ratings (gym_id);

-- RLS
alter table public.trainer_ratings enable row level security;

-- Policies
create policy "Organization owners can view ratings for their org"
  on public.trainer_ratings for select
  using (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  );

create policy "Organization owners can insert ratings"
  on public.trainer_ratings for insert
  with check (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  );

create policy "Organization owners can update ratings"
  on public.trainer_ratings for update
  using (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  );

create policy "Organization owners can delete ratings"
  on public.trainer_ratings for delete
  using (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  );

-- Service role bypass (already default for service_role, explicit for clarity)
create policy "Service role full access"
  on public.trainer_ratings for all
  to service_role
  using (true)
  with check (true);
