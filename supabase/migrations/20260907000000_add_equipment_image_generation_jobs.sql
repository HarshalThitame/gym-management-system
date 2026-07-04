-- Equipment Image Generation Jobs
-- Async job queue for AI-powered equipment image generation

create table if not exists public.equipment_image_generation_jobs (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  equipment_name text not null,
  equipment_type text not null,
  brand text,
  model text,
  custom_prompt text,
  resolved_prompt text,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'expired', 'cancelled')),
  provider text not null default 'openai',
  provider_model text not null default 'gpt-image-2',
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  last_error text,
  error_category text,
  preview_data_url text,
  preview_storage_path text,
  provider_latency_ms integer,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.equipment_image_generation_jobs is 'Async queue for AI-generated equipment images.';
comment on column public.equipment_image_generation_jobs.preview_data_url is 'Temporary base64 data URL of the generated preview. Cleared on acceptance or expiry.';
comment on column public.equipment_image_generation_jobs.preview_storage_path is 'Temporary storage path in equipment-images/tmp/ if preview is persisted to storage.';
comment on column public.equipment_image_generation_jobs.expires_at is 'Previews older than this will be cleaned up.';
comment on column public.equipment_image_generation_jobs.error_category is 'Classified failure reason: auth, rate_limit, timeout, provider_unavailable, invalid_prompt, unknown';

create index if not exists eq_img_jobs_org_status_idx on public.equipment_image_generation_jobs (organization_id, status);
create index if not exists eq_img_jobs_requested_by_idx on public.equipment_image_generation_jobs (requested_by);
create index if not exists eq_img_jobs_status_created_idx on public.equipment_image_generation_jobs (status, created_at) where status = 'queued';
create index if not exists eq_img_jobs_expires_idx on public.equipment_image_generation_jobs (expires_at) where status = 'completed';

alter table public.equipment_image_generation_jobs enable row level security;

drop policy if exists "Organization owners full access to image generation jobs" on public.equipment_image_generation_jobs;
create policy "Organization owners full access to image generation jobs"
  on public.equipment_image_generation_jobs for all
  to authenticated
  using (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  );

drop trigger if exists set_eq_img_jobs_updated_at on public.equipment_image_generation_jobs;
create trigger set_eq_img_jobs_updated_at
  before update on public.equipment_image_generation_jobs
  for each row execute function public.set_updated_at();
