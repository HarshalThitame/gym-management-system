-- Program Template Support
alter table public.workout_programs
  add column if not exists is_template boolean not null default false,
  add column if not exists cloned_from uuid null references public.workout_programs(id) on delete set null;

-- Progress Photos Table
create table if not exists public.member_progress_photos (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  photo_url text not null,
  photo_type text not null check (photo_type in ('front', 'back', 'side', 'custom')),
  recorded_on date not null default current_date,
  notes text null check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

-- RLS
alter table if exists public.member_progress_photos enable row level security;

drop policy if exists "Trainers can manage progress photos" on public.member_progress_photos;
create policy "Trainers can manage progress photos"
  on public.member_progress_photos for all
  to authenticated
  using (
    exists (
      select 1 from public.trainers t
      where t.id = member_progress_photos.trainer_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trainers t
      where t.id = member_progress_photos.trainer_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists "Members can view own progress photos" on public.member_progress_photos;
create policy "Members can view own progress photos"
  on public.member_progress_photos for select
  to authenticated
  using (
    exists (
      select 1 from public.members m
      where m.id = member_progress_photos.member_id
        and m.user_id = auth.uid()
    )
  );

-- Storage bucket for progress photos
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', true)
on conflict (id) do nothing;

drop policy if exists "Trainers can upload progress photos" on storage.objects;
create policy "Trainers can upload progress photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'progress-photos'
  );

drop policy if exists "Anyone can view progress photos" on storage.objects;
create policy "Anyone can view progress photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'progress-photos');
