create table if not exists public.tasks (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid references public.gyms(id) on delete cascade,
  branch_id       uuid references public.branches(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  title           text not null,
  description     text,
  priority        text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status          text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  type            text not null default 'general' check (type in ('follow_up', 'renewal', 'payment', 'appointment', 'general')),
  assigned_to     uuid references auth.users(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  entity_type     text check (entity_type in ('lead', 'member', 'payment', 'appointment', 'general')),
  entity_id       uuid,
  due_date        timestamptz,
  completed_at    timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_tasks_gym_id on public.tasks(gym_id);
create index if not exists idx_tasks_assigned_to on public.tasks(assigned_to);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_due_date on public.tasks(due_date);

alter table public.tasks enable row level security;

create policy "Users can view tasks"
on public.tasks
for select
using (
  public.has_any_role(array['super_admin', 'organization_owner', 'gym_admin'])
  or (
    public.has_any_role(array['reception_staff', 'trainer'])
    and gym_id = (select p.gym_id from public.profiles p where p.id = auth.uid() limit 1)
  )
);

create policy "Users can create tasks"
on public.tasks
for insert
with check (
  public.has_any_role(array['super_admin', 'organization_owner', 'gym_admin', 'reception_staff'])
  and gym_id in (select p.gym_id from public.profiles p where p.id = auth.uid())
  and created_by = auth.uid()
);

create policy "Users can update tasks"
on public.tasks
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

create policy "Users can delete tasks"
on public.tasks
for delete
using (
  public.has_any_role(array['gym_admin', 'super_admin', 'organization_owner'])
);
