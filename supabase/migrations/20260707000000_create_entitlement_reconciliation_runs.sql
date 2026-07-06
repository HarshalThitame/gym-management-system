create table if not exists public.entitlement_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('all', 'organization')),
  scope_id uuid null,
  mode text not null check (mode in ('preview', 'apply')),
  status text not null check (status in ('running', 'completed', 'failed')),
  requested_by uuid null references public.profiles(id) on delete set null,
  completed_by uuid null references public.profiles(id) on delete set null,
  preview_summary jsonb not null default '{}'::jsonb,
  applied_summary jsonb not null default '{}'::jsonb,
  differences jsonb not null default '[]'::jsonb,
  error_message text null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null
);

create index if not exists entitlement_reconciliation_runs_scope_idx
  on public.entitlement_reconciliation_runs (scope_type, scope_id, started_at desc);

create index if not exists entitlement_reconciliation_runs_status_idx
  on public.entitlement_reconciliation_runs (status, started_at desc);

alter table public.entitlement_reconciliation_runs enable row level security;

drop policy if exists "reconciliation runs readable by super admins" on public.entitlement_reconciliation_runs;
create policy "reconciliation runs readable by super admins"
  on public.entitlement_reconciliation_runs
  for select to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name = 'super_admin'
    )
  );

drop policy if exists "reconciliation runs insertable by super admins" on public.entitlement_reconciliation_runs;
create policy "reconciliation runs insertable by super admins"
  on public.entitlement_reconciliation_runs
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name = 'super_admin'
    )
  );

drop policy if exists "reconciliation runs updatable by super admins" on public.entitlement_reconciliation_runs;
create policy "reconciliation runs updatable by super admins"
  on public.entitlement_reconciliation_runs
  for update to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name = 'super_admin'
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name = 'super_admin'
    )
  );
