-- Enterprise Gym/Branch governance hardening.
-- This migration makes the location hierarchy compatible with true multi-branch
-- gyms and introduces nullable branch scope on core operational records.

-- The earlier platform layer allowed at most one branch per gym. Enterprise
-- tenant hierarchies need multiple branches under a single gym record.
drop index if exists public.branches_unique_gym_id_idx;

alter table public.members
add column if not exists branch_id uuid null references public.branches(id) on delete set null;

alter table public.payments
add column if not exists branch_id uuid null references public.branches(id) on delete set null;

alter table public.attendance_sessions
add column if not exists branch_id uuid null references public.branches(id) on delete set null;

create index if not exists members_branch_status_idx
on public.members (branch_id, status)
where branch_id is not null;

create index if not exists payments_branch_status_created_at_idx
on public.payments (branch_id, status, created_at desc)
where branch_id is not null;

create index if not exists attendance_sessions_branch_status_idx
on public.attendance_sessions (branch_id, status, check_in_at desc)
where branch_id is not null;

-- Safe backfill only where the gym has exactly one branch. Multi-branch gyms
-- are intentionally left null because automatic assignment would be ambiguous.
with single_branch_gyms as (
  select gym_id, (array_agg(id order by id::text))[1] as branch_id
  from public.branches
  where gym_id is not null
  group by gym_id
  having count(*) = 1
)
update public.members m
set branch_id = sbg.branch_id
from single_branch_gyms sbg
where m.branch_id is null
  and m.gym_id = sbg.gym_id;

with single_branch_gyms as (
  select gym_id, (array_agg(id order by id::text))[1] as branch_id
  from public.branches
  where gym_id is not null
  group by gym_id
  having count(*) = 1
)
update public.payments p
set branch_id = sbg.branch_id
from single_branch_gyms sbg
where p.branch_id is null
  and p.gym_id = sbg.gym_id;

with single_branch_gyms as (
  select gym_id, (array_agg(id order by id::text))[1] as branch_id
  from public.branches
  where gym_id is not null
  group by gym_id
  having count(*) = 1
)
update public.attendance_sessions a
set branch_id = sbg.branch_id
from single_branch_gyms sbg
where a.branch_id is null
  and a.gym_id = sbg.gym_id;

comment on column public.members.branch_id is
  'Nullable operational branch scope. Null means legacy or unresolved gym-level member record.';

comment on column public.payments.branch_id is
  'Nullable operational branch scope. Null means legacy or unresolved gym-level financial record.';

comment on column public.attendance_sessions.branch_id is
  'Nullable operational branch scope. Null means legacy or unresolved gym-level attendance record.';
