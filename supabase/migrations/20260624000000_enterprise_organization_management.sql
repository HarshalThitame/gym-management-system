-- Enterprise Organization Management System
-- Adds organization lifecycle, status history, audit logs, branding, contacts

-- ════════════════════════════════════════════════════════════════════════
-- 1. Extend organizations table with lifecycle support
-- ════════════════════════════════════════════════════════════════════════

-- Add organization lifecycle statuses
alter table public.organizations 
  drop constraint if exists organizations_status_check;
alter table public.organizations
  add constraint organizations_status_check
  check (status in ('draft', 'pending_verification', 'active', 'suspended', 'paused', 'cancelled', 'archived'));

-- Add lifecycle metadata columns
alter table public.organizations add column if not exists archived_at timestamptz;
alter table public.organizations add column if not exists suspended_at timestamptz;
alter table public.organizations add column if not exists suspension_reason text;
alter table public.organizations add column if not exists activated_at timestamptz;
alter table public.organizations add column if not exists paused_at timestamptz;
alter table public.organizations add column if not exists cancelled_at timestamptz;
alter table public.organizations add column if not exists cancellation_reason text;
alter table public.organizations add column if not exists verified_at timestamptz;
alter table public.organizations add column if not exists tags text[] default '{}';
comment on column public.organizations.tags is 'Labels for filtering (e.g. enterprise, trial, beta, vip)';

-- ════════════════════════════════════════════════════════════════════════
-- 2. organization_status_history — immutable lifecycle audit
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.organization_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  previous_status text not null,
  new_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  reason text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.organization_status_history is 'Immutable audit trail of every organization status change.';

create index if not exists org_status_history_org_idx on public.organization_status_history (organization_id, created_at desc);

alter table public.organization_status_history enable row level security;

drop policy if exists "org status history super admin" on public.organization_status_history;
create policy "org status history super admin"
  on public.organization_status_history for select to authenticated
  using (public.is_super_admin());

drop policy if exists "org status history org owner" on public.organization_status_history;
create policy "org status history org owner"
  on public.organization_status_history for select to authenticated
  using (public.is_organization_owner(organization_id));

drop policy if exists "org status history insert" on public.organization_status_history;
create policy "org status history insert"
  on public.organization_status_history for insert to authenticated
  with check (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════
-- 3. organization_audit_logs — comprehensive org audit trail
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.organization_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in (
    'created', 'updated', 'status_changed', 'owner_transferred',
    'package_assigned', 'subscription_created', 'subscription_changed',
    'settings_updated', 'branding_updated', 'contact_updated',
    'billing_updated', 'domain_added', 'domain_removed',
    'suspended', 'activated', 'paused', 'archived', 'cancelled',
    'ownership_transferred', 'verification_submitted', 'verification_approved',
    'admin_note_added', 'bulk_update'
  )),
  details jsonb default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

comment on table public.organization_audit_logs is 'Comprehensive immutable audit trail for all organization-level actions.';

create index if not exists org_audit_org_idx on public.organization_audit_logs (organization_id, created_at desc);
create index if not exists org_audit_action_idx on public.organization_audit_logs (action);

alter table public.organization_audit_logs enable row level security;

drop policy if exists "org audit super admin" on public.organization_audit_logs;
create policy "org audit super admin"
  on public.organization_audit_logs for select to authenticated
  using (public.is_super_admin());

drop policy if exists "org audit org owner" on public.organization_audit_logs;
create policy "org audit org owner"
  on public.organization_audit_logs for select to authenticated
  using (public.is_organization_owner(organization_id));

drop policy if exists "org audit insert" on public.organization_audit_logs;
create policy "org audit insert"
  on public.organization_audit_logs for insert to authenticated
  with check (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════
-- 4. organization_branding — per-org brand settings
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.organization_branding (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  logo_url text,
  favicon_url text,
  primary_color text default '#2563eb',
  secondary_color text default '#7c3aed',
  accent_color text default '#06b6d4',
  font_family text default 'Inter',
  custom_css text,
  email_branding jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

comment on table public.organization_branding is 'White-label branding configuration per organization.';

alter table public.organization_branding enable row level security;

drop policy if exists "org branding super admin" on public.organization_branding;
create policy "org branding super admin"
  on public.organization_branding for select to authenticated
  using (public.is_super_admin());

drop policy if exists "org branding org owner" on public.organization_branding;
create policy "org branding org owner"
  on public.organization_branding for select to authenticated
  using (public.is_organization_owner(organization_id));

drop policy if exists "org branding update" on public.organization_branding;
create policy "org branding update"
  on public.organization_branding for update to authenticated
  using (public.is_organization_owner(organization_id))
  with check (public.is_organization_owner(organization_id));

-- ════════════════════════════════════════════════════════════════════════
-- 5. Trigger: auto-log status changes
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.log_organization_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.organization_status_history (
      organization_id, previous_status, new_status, reason
    ) values (
      new.id, old.status, new.status,
      case when new.status = 'suspended' then new.suspension_reason
           when new.status = 'cancelled' then new.cancellation_reason
           else null end
    );

    insert into public.organization_audit_logs (
      organization_id, action, details
    ) values (
      new.id, 'status_changed',
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists log_org_status_change on public.organizations;
create trigger log_org_status_change
  after update of status on public.organizations
  for each row
  execute function public.log_organization_status_change();

-- ════════════════════════════════════════════════════════════════════════
-- 6. Seed organization_branding for existing orgs
-- ════════════════════════════════════════════════════════════════════════

insert into public.organization_branding (organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;
