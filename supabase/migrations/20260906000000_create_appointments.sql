create type appointment_status as enum (
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no_show'
);

create type appointment_type as enum (
  'consultation',
  'pt_session',
  'trial_session',
  'trainer_meeting',
  'follow_up',
  'general'
);

create table if not exists public.appointments (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid references public.gyms(id) on delete cascade,
  branch_id       uuid references public.branches(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  member_id       uuid references public.members(id) on delete cascade,
  trainer_id      uuid references public.trainers(id) on delete set null,
  title           text not null,
  type            appointment_type not null default 'general',
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  status          appointment_status not null default 'scheduled',
  location        text,
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  cancelled_by    uuid references auth.users(id) on delete set null,
  cancel_reason   text,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_appointments_gym_id on public.appointments(gym_id);
create index if not exists idx_appointments_member_id on public.appointments(member_id);
create index if not exists idx_appointments_trainer_id on public.appointments(trainer_id);
create index if not exists idx_appointments_date on public.appointments(starts_at);
create index if not exists idx_appointments_status on public.appointments(status);

alter table public.appointments enable row level security;

create policy "Users can view appointments"
on public.appointments
for select
using (
  public.has_any_role(array['super_admin', 'organization_owner', 'gym_admin'])
  or (
    public.has_any_role(array['reception_staff', 'trainer'])
    and gym_id = (select p.gym_id from public.profiles p where p.id = auth.uid() limit 1)
  )
);

create policy "Users can create appointments"
on public.appointments
for insert
with check (
  public.has_any_role(array['super_admin', 'organization_owner', 'gym_admin', 'reception_staff'])
  and gym_id in (select p.gym_id from public.profiles p where p.id = auth.uid())
  and created_by = auth.uid()
);

create policy "Users can update appointments"
on public.appointments
for update
using (
  public.has_any_role(array['super_admin', 'organization_owner', 'gym_admin'])
  or (
    public.has_any_role(array['reception_staff'])
    and gym_id = (select p.gym_id from public.profiles p where p.id = auth.uid() limit 1)
  )
)
with check (
  public.has_any_role(array['super_admin', 'organization_owner', 'gym_admin'])
  or (
    public.has_any_role(array['reception_staff'])
    and gym_id = (select p.gym_id from public.profiles p where p.id = auth.uid() limit 1)
  )
);

create policy "Users can delete appointments"
on public.appointments
for delete
using (
  public.has_any_role(array['gym_admin', 'super_admin', 'organization_owner'])
);
