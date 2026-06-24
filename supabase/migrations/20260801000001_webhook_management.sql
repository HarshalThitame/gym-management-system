-- ============================================================================
-- Phase 3.9B: Webhook Management
-- Outbound webhook configuration and delivery log tables for Org Owner panel.
-- Inbound Razorpay webhook handler already exists at app/api/webhooks/razorpay/.
-- This phase adds the outbound webhook configuration + delivery tracking side.
-- ============================================================================

-- Table: webhook_configs (outbound webhook endpoint configurations per org)
create table if not exists public.webhook_configs (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  url text not null,
  secret text,
  events text[] not null default '{}',
  is_active boolean default true,
  last_triggered_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_webhook_configs_org on public.webhook_configs(organization_id);

-- Table: webhook_delivery_logs (delivery history + retry support)
create table if not exists public.webhook_delivery_logs (
  id uuid default gen_random_uuid() primary key,
  webhook_id uuid not null references public.webhook_configs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null,
  payload jsonb,
  response_status integer,
  response_body text,
  duration_ms integer,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'retrying')),
  error_message text,
  attempt_count integer default 1,
  created_at timestamptz default now()
);

create index if not exists idx_webhook_logs_webhook on public.webhook_delivery_logs(webhook_id, created_at);
create index if not exists idx_webhook_logs_org on public.webhook_delivery_logs(organization_id);
create index if not exists idx_webhook_logs_status on public.webhook_delivery_logs(status);

-- RLS: webhook_configs
alter table public.webhook_configs enable row level security;

drop policy if exists "Org users can view webhook configs" on public.webhook_configs;
create policy "Org users can view webhook configs"
  on public.webhook_configs for select
  using (public.can_access_organization(organization_id));

drop policy if exists "Org owners can insert webhook configs" on public.webhook_configs;
create policy "Org owners can insert webhook configs"
  on public.webhook_configs for insert
  with check (public.can_manage_organization(organization_id));

drop policy if exists "Org owners can update webhook configs" on public.webhook_configs;
create policy "Org owners can update webhook configs"
  on public.webhook_configs for update
  using (public.can_manage_organization(organization_id));

drop policy if exists "Org owners can delete webhook configs" on public.webhook_configs;
create policy "Org owners can delete webhook configs"
  on public.webhook_configs for delete
  using (public.can_manage_organization(organization_id));

-- RLS: webhook_delivery_logs
alter table public.webhook_delivery_logs enable row level security;

drop policy if exists "Org users can view webhook delivery logs" on public.webhook_delivery_logs;
create policy "Org users can view webhook delivery logs"
  on public.webhook_delivery_logs for select
  using (public.can_access_organization(organization_id));
