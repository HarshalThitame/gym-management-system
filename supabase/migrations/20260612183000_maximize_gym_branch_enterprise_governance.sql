-- Maximum enterprise governance hardening for Gym/Branch management.
-- This migration keeps older migrations untouched and adds the missing
-- branch-level integrity, approval queue, and safe branch remediation helpers.

alter table public.invoices
add column if not exists branch_id uuid null references public.branches(id) on delete set null;

create index if not exists invoices_branch_status_issued_at_idx
on public.invoices (branch_id, status, issued_at desc)
where branch_id is not null;

-- Backfill branch scope only when the source relation is unambiguous.
update public.invoices i
set branch_id = m.branch_id
from public.members m
where i.branch_id is null
  and i.member_id = m.id
  and m.branch_id is not null;

update public.payments p
set branch_id = i.branch_id
from public.invoices i
where p.branch_id is null
  and p.invoice_id = i.id
  and i.branch_id is not null;

update public.attendance_sessions a
set branch_id = m.branch_id
from public.members m
where a.branch_id is null
  and a.member_id = m.id
  and m.branch_id is not null;

comment on column public.invoices.branch_id is
  'Nullable operational branch scope for branch-level revenue, reconciliation, and governance.';

create or replace function public.branch_belongs_to_gym(target_branch_id uuid, target_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_branch_id is null
    or exists (
      select 1
      from public.branches b
      where b.id = target_branch_id
        and b.gym_id is not distinct from target_gym_id
    );
$$;

create or replace function public.member_branch_scope_matches(
  target_member_id uuid,
  target_gym_id uuid,
  target_branch_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members m
    where m.id = target_member_id
      and m.gym_id is not distinct from target_gym_id
      and (
        target_branch_id is null
        or m.branch_id is null
        or m.branch_id = target_branch_id
      )
      and public.branch_belongs_to_gym(coalesce(target_branch_id, m.branch_id), target_gym_id)
  );
$$;

create or replace function public.enforce_member_branch_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is not null and not public.branch_belongs_to_gym(new.branch_id, new.gym_id) then
    raise exception 'Member branch must belong to the same gym.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_invoice_branch_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is not null and not public.branch_belongs_to_gym(new.branch_id, new.gym_id) then
    raise exception 'Invoice branch must belong to the same gym.'
      using errcode = '23514';
  end if;

  if not public.member_branch_scope_matches(new.member_id, new.gym_id, new.branch_id) then
    raise exception 'Invoice member, gym, and branch must match.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_payment_branch_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_branch_id uuid;
begin
  if new.branch_id is not null and not public.branch_belongs_to_gym(new.branch_id, new.gym_id) then
    raise exception 'Payment branch must belong to the same gym.'
      using errcode = '23514';
  end if;

  if not public.member_branch_scope_matches(new.member_id, new.gym_id, new.branch_id) then
    raise exception 'Payment member, gym, and branch must match.'
      using errcode = '23514';
  end if;

  if new.invoice_id is not null then
    select branch_id
    into invoice_branch_id
    from public.invoices
    where id = new.invoice_id;

    if invoice_branch_id is not null and new.branch_id is distinct from invoice_branch_id then
      raise exception 'Payment branch must match invoice branch.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_attendance_branch_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is not null and not public.branch_belongs_to_gym(new.branch_id, new.gym_id) then
    raise exception 'Attendance branch must belong to the same gym.'
      using errcode = '23514';
  end if;

  if not public.member_branch_scope_matches(new.member_id, new.gym_id, new.branch_id) then
    raise exception 'Attendance member, gym, and branch must match.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_member_branch_integrity on public.members;
create trigger enforce_member_branch_integrity
before insert or update of gym_id, branch_id on public.members
for each row execute function public.enforce_member_branch_integrity();

drop trigger if exists enforce_invoice_branch_integrity on public.invoices;
create trigger enforce_invoice_branch_integrity
before insert or update of gym_id, branch_id, member_id on public.invoices
for each row execute function public.enforce_invoice_branch_integrity();

drop trigger if exists enforce_payment_branch_integrity on public.payments;
create trigger enforce_payment_branch_integrity
before insert or update of gym_id, branch_id, member_id, invoice_id on public.payments
for each row execute function public.enforce_payment_branch_integrity();

drop trigger if exists enforce_attendance_branch_integrity on public.attendance_sessions;
create trigger enforce_attendance_branch_integrity
before insert or update of gym_id, branch_id, member_id on public.attendance_sessions
for each row execute function public.enforce_attendance_branch_integrity();

create or replace function public.can_record_attendance_session(
  target_gym_id uuid,
  target_member_id uuid,
  target_membership_id uuid,
  target_branch_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members m
    join public.memberships ms on ms.member_id = m.id
    where m.id = target_member_id
      and m.gym_id = target_gym_id
      and public.member_branch_scope_matches(m.id, target_gym_id, target_branch_id)
      and m.status = 'active'
      and ms.id = target_membership_id
      and ms.gym_id = target_gym_id
      and ms.status = 'active'
      and ms.payment_status in ('paid', 'waived')
      and ms.start_date <= current_date
      and ms.end_date >= current_date
  );
$$;

drop policy if exists "staff can insert valid attendance sessions" on public.attendance_sessions;
create policy "staff can insert valid attendance sessions"
on public.attendance_sessions
for insert
to authenticated
with check (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
    and public.can_record_attendance_session(gym_id, member_id, membership_id, branch_id)
  )
);

drop policy if exists "staff can update attendance sessions in scope" on public.attendance_sessions;
create policy "staff can update attendance sessions in scope"
on public.attendance_sessions
for update
to authenticated
using (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
  )
)
with check (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
    and (
      status <> 'inside'
      or public.can_record_attendance_session(gym_id, member_id, membership_id, branch_id)
    )
  )
);

create or replace function public.financial_invoice_scope_matches(
  row_gym_id uuid,
  row_member_id uuid,
  row_membership_id uuid,
  row_branch_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members
    where members.id = row_member_id
      and members.gym_id is not distinct from row_gym_id
      and public.member_branch_scope_matches(members.id, row_gym_id, row_branch_id)
  )
  and (
    row_membership_id is null
    or exists (
      select 1
      from public.memberships
      where memberships.id = row_membership_id
        and memberships.member_id = row_member_id
        and memberships.gym_id is not distinct from row_gym_id
    )
  );
$$;

create or replace function public.financial_payment_scope_matches(
  row_gym_id uuid,
  row_member_id uuid,
  row_membership_id uuid,
  row_invoice_id uuid,
  row_amount integer,
  row_branch_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.financial_invoice_scope_matches(row_gym_id, row_member_id, row_membership_id, row_branch_id)
  and (
    row_invoice_id is null
    or exists (
      select 1
      from public.invoices
      where invoices.id = row_invoice_id
        and invoices.member_id = row_member_id
        and invoices.gym_id is not distinct from row_gym_id
        and (invoices.branch_id is null or invoices.branch_id is not distinct from row_branch_id)
        and (
          row_membership_id is null
          or invoices.membership_id is null
          or invoices.membership_id = row_membership_id
        )
        and row_amount <= invoices.total_amount
    )
  );
$$;

create or replace function public.enforce_invoice_financial_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.financial_invoice_scope_matches(new.gym_id, new.member_id, new.membership_id, new.branch_id) then
    raise exception 'Invoice member, membership, gym, and branch must match.'
      using errcode = '23514';
  end if;

  if new.amount_paid > greatest(new.subtotal_amount - new.discount_amount + new.tax_amount, 0) then
    raise exception 'Invoice amount paid cannot exceed invoice total.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_payment_financial_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.financial_payment_scope_matches(new.gym_id, new.member_id, new.membership_id, new.invoice_id, new.amount, new.branch_id) then
    raise exception 'Payment member, membership, invoice, gym, and branch must match.'
      using errcode = '23514';
  end if;

  if new.provider = 'razorpay'
    and new.status in ('paid', 'partially_refunded', 'refunded')
    and new.provider_payment_id is null then
    raise exception 'Finalized Razorpay payments require a provider payment id.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop policy if exists "staff can write invoices" on public.invoices;
create policy "staff can write invoices"
on public.invoices for all to authenticated
using (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
    and public.financial_invoice_scope_matches(gym_id, member_id, membership_id, branch_id)
  )
)
with check (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
    and public.financial_invoice_scope_matches(gym_id, member_id, membership_id, branch_id)
  )
);

drop policy if exists "staff can write payments" on public.payments;
create policy "staff can write payments"
on public.payments for all to authenticated
using (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
    and public.financial_payment_scope_matches(gym_id, member_id, membership_id, invoice_id, amount, branch_id)
  )
)
with check (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
    and public.financial_payment_scope_matches(gym_id, member_id, membership_id, invoice_id, amount, branch_id)
  )
);

create table if not exists public.gym_branch_approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  gym_id uuid null references public.gyms(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete cascade,
  action text not null check (
    action in (
      'transfer_gym_admin',
      'gym_lifecycle',
      'branch_lifecycle',
      'move_gym',
      'move_branch',
      'bulk_lifecycle'
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

comment on table public.gym_branch_approval_requests is
  'Maker-checker approval queue for high-risk Super Admin gym and branch governance actions.';

create index if not exists gym_branch_approval_requests_org_status_idx
on public.gym_branch_approval_requests (organization_id, status, requested_at desc);

create index if not exists gym_branch_approval_requests_gym_status_idx
on public.gym_branch_approval_requests (gym_id, status, requested_at desc)
where gym_id is not null;

create index if not exists gym_branch_approval_requests_branch_status_idx
on public.gym_branch_approval_requests (branch_id, status, requested_at desc)
where branch_id is not null;

create index if not exists gym_branch_approval_requests_action_status_idx
on public.gym_branch_approval_requests (action, status, requested_at desc);

create index if not exists gym_branch_approval_requests_expires_at_idx
on public.gym_branch_approval_requests (expires_at)
where status = 'pending';

create unique index if not exists gym_branch_approval_requests_one_pending_entity_action_idx
on public.gym_branch_approval_requests (
  organization_id,
  coalesce(gym_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
  action
)
where status = 'pending';

drop trigger if exists set_gym_branch_approval_requests_updated_at
on public.gym_branch_approval_requests;

create trigger set_gym_branch_approval_requests_updated_at
before update on public.gym_branch_approval_requests
for each row execute function public.set_updated_at();

alter table public.gym_branch_approval_requests enable row level security;

grant select, insert, update, delete on public.gym_branch_approval_requests to authenticated;

drop policy if exists "gym branch approval requests manageable by super admins"
on public.gym_branch_approval_requests;

create policy "gym branch approval requests manageable by super admins"
on public.gym_branch_approval_requests
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create or replace function public.expire_gym_branch_approval_requests(p_actor_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer := 0;
begin
  if auth.role() <> 'service_role' and not public.is_super_admin() then
    raise exception 'Only Super Admins can expire gym and branch approvals.'
      using errcode = '42501';
  end if;

  update public.gym_branch_approval_requests
  set
    status = 'expired',
    reviewed_by = p_actor_id,
    reviewed_at = now(),
    review_note = coalesce(review_note, 'Expired automatically.')
  where status = 'pending'
    and expires_at <= now();

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

grant execute on function public.expire_gym_branch_approval_requests(uuid) to authenticated, service_role;

create or replace function public.apply_branch_scope_remediation(
  p_branch_id uuid,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch public.branches%rowtype;
  v_member_count integer := 0;
  v_invoice_count integer := 0;
  v_payment_count integer := 0;
  v_attendance_count integer := 0;
begin
  if auth.role() <> 'service_role' and not public.is_super_admin() then
    raise exception 'Only Super Admins can remediate branch scope.'
      using errcode = '42501';
  end if;

  select *
  into v_branch
  from public.branches
  where id = p_branch_id;

  if not found then
    raise exception 'Branch was not found.'
      using errcode = 'P0002';
  end if;

  if v_branch.gym_id is null then
    raise exception 'Branch must be attached to a gym before remediation.'
      using errcode = '22023';
  end if;

  update public.members
  set branch_id = v_branch.id
  where gym_id = v_branch.gym_id
    and branch_id is null;
  get diagnostics v_member_count = row_count;

  update public.invoices i
  set branch_id = coalesce(m.branch_id, v_branch.id)
  from public.members m
  where i.member_id = m.id
    and i.gym_id = v_branch.gym_id
    and i.branch_id is null
    and coalesce(m.branch_id, v_branch.id) = v_branch.id;
  get diagnostics v_invoice_count = row_count;

  update public.payments p
  set branch_id = coalesce(i.branch_id, m.branch_id, v_branch.id)
  from public.members m
  left join public.invoices i on i.id = p.invoice_id
  where p.member_id = m.id
    and p.gym_id = v_branch.gym_id
    and p.branch_id is null
    and coalesce(i.branch_id, m.branch_id, v_branch.id) = v_branch.id;
  get diagnostics v_payment_count = row_count;

  update public.attendance_sessions a
  set branch_id = coalesce(m.branch_id, v_branch.id)
  from public.members m
  where a.member_id = m.id
    and a.gym_id = v_branch.gym_id
    and a.branch_id is null
    and coalesce(m.branch_id, v_branch.id) = v_branch.id;
  get diagnostics v_attendance_count = row_count;

  return jsonb_build_object(
    'branchId', v_branch.id,
    'memberRecords', v_member_count,
    'invoiceRecords', v_invoice_count,
    'paymentRecords', v_payment_count,
    'attendanceRecords', v_attendance_count,
    'remediatedBy', p_actor_id,
    'remediatedAt', now()
  );
end;
$$;

grant execute on function public.apply_branch_scope_remediation(uuid, uuid) to authenticated, service_role;

comment on function public.apply_branch_scope_remediation(uuid, uuid) is
  'Assigns unresolved gym-scoped members, invoices, payments, and attendance sessions to a selected branch under the same gym.';
