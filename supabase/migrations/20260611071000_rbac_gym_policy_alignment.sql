-- QA Phase 2 RBAC hardening.
-- Align gym visibility with the strict can_access_gym helper.

drop policy if exists "authenticated users can read active gyms in scope" on public.gyms;
create policy "authenticated users can read active gyms in scope"
on public.gyms
for select
to authenticated
using (
  status = 'active'
  and public.can_access_gym(id)
);

