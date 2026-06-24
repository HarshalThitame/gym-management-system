-- ============================================================================
-- Phase 3.9A: Google Calendar Sync
-- Calendar integration table for org-level + trainer-level Google Calendar
-- connections. Supports class session auto-sync with pluggable provider
-- interface. OAuth2 tokens stored (encrypt in production via pgsodium/vault).
-- ============================================================================

-- Table: calendar_integrations (org-level Google/Outlook calendar connection)
create table if not exists public.calendar_integrations (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'google' check (provider in ('google', 'outlook')),
  connected_by uuid references public.profiles(id),
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  calendar_id text,
  sync_enabled boolean default false,
  sync_classes boolean default true,
  sync_pt_sessions boolean default false,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, provider)
);

-- Table: calendar_sync_logs (audit trail for calendar sync operations)
create table if not exists public.calendar_sync_logs (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid references public.calendar_integrations(id) on delete set null,
  event_type text not null check (event_type in ('create', 'update', 'delete', 'sync_error')),
  class_session_id uuid references public.class_sessions(id) on delete set null,
  external_event_id text,
  status text not null default 'success' check (status in ('success', 'failed', 'pending')),
  error_message text,
  created_at timestamptz default now()
);

create index if not exists idx_calendar_sync_logs_org on public.calendar_sync_logs(organization_id);
create index if not exists idx_calendar_sync_logs_session on public.calendar_sync_logs(class_session_id);
create index if not exists idx_calendar_sync_logs_created on public.calendar_sync_logs(created_at);

-- Table: trainer_calendar_connections (trainer personal calendar sync)
create table if not exists public.trainer_calendar_connections (
  id uuid default gen_random_uuid() primary key,
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'google',
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  calendar_id text,
  sync_enabled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (trainer_id, provider)
);

-- RLS: calendar_integrations
alter table public.calendar_integrations enable row level security;

drop policy if exists "Org users can view calendar integrations" on public.calendar_integrations;
create policy "Org users can view calendar integrations"
  on public.calendar_integrations for select
  using (public.can_access_organization(organization_id));

drop policy if exists "Org owners can insert calendar integrations" on public.calendar_integrations;
create policy "Org owners can insert calendar integrations"
  on public.calendar_integrations for insert
  with check (public.can_manage_organization(organization_id));

drop policy if exists "Org owners can update calendar integrations" on public.calendar_integrations;
create policy "Org owners can update calendar integrations"
  on public.calendar_integrations for update
  using (public.can_manage_organization(organization_id));

-- RLS: calendar_sync_logs
alter table public.calendar_sync_logs enable row level security;

drop policy if exists "Org users can view calendar sync logs" on public.calendar_sync_logs;
create policy "Org users can view calendar sync logs"
  on public.calendar_sync_logs for select
  using (public.can_access_organization(organization_id));

drop policy if exists "Org owners can insert calendar sync logs" on public.calendar_sync_logs;
create policy "Org owners can insert calendar sync logs"
  on public.calendar_sync_logs for insert
  with check (public.can_manage_organization(organization_id));

-- RLS: trainer_calendar_connections
alter table public.trainer_calendar_connections enable row level security;

drop policy if exists "Org users can view trainer calendar connections" on public.trainer_calendar_connections;
create policy "Org users can view trainer calendar connections"
  on public.trainer_calendar_connections for select
  using (public.can_access_organization(organization_id));

drop policy if exists "Org owners can manage trainer calendar connections" on public.trainer_calendar_connections;
create policy "Org owners can manage trainer calendar connections"
  on public.trainer_calendar_connections for all
  using (public.can_manage_organization(organization_id));
