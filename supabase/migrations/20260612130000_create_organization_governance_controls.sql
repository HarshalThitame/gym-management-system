-- Enterprise governance controls for Super Admin organization operations.
-- Destructive or high-risk tenant actions are requested first, then approved
-- by a Super Admin with fresh MFA before they are applied.

create table if not exists public.organization_approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action text not null check (
    action in (
      'transfer_owner',
      'suspend',
      'delete',
      'bulk_suspend',
      'bulk_assign_package'
    )
  ),
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'cancelled', 'expired')
  ),
  requested_by uuid null references auth.users(id) on delete set null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  target_user_id uuid null references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  before_snapshot jsonb not null default '{}'::jsonb,
  after_snapshot jsonb not null default '{}'::jsonb,
  reason text null,
  review_note text null,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organization_approval_requests is
  'Approval queue for high-risk Super Admin organization actions.';
comment on column public.organization_approval_requests.before_snapshot is
  'Governed organization state captured when the request is created.';
comment on column public.organization_approval_requests.after_snapshot is
  'Expected organization state after approval is applied.';
comment on column public.organization_approval_requests.expires_at is
  'Pending approvals expire automatically at the application layer after this timestamp.';

create index if not exists organization_approval_requests_org_status_idx
on public.organization_approval_requests (organization_id, status, requested_at desc);

create index if not exists organization_approval_requests_action_status_idx
on public.organization_approval_requests (action, status, requested_at desc);

create index if not exists organization_approval_requests_requested_by_idx
on public.organization_approval_requests (requested_by, requested_at desc);

create index if not exists organization_approval_requests_expires_at_idx
on public.organization_approval_requests (expires_at)
where status = 'pending';

create unique index if not exists organization_approval_requests_one_pending_action_idx
on public.organization_approval_requests (organization_id, action)
where status = 'pending';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_organization_approval_requests_updated_at
on public.organization_approval_requests;

create trigger set_organization_approval_requests_updated_at
before update on public.organization_approval_requests
for each row execute function public.set_updated_at();

alter table public.organization_approval_requests enable row level security;

grant select, insert, update, delete on public.organization_approval_requests to authenticated;

drop policy if exists "organization approval requests manageable by super admins"
on public.organization_approval_requests;

create policy "organization approval requests manageable by super admins"
on public.organization_approval_requests
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());
