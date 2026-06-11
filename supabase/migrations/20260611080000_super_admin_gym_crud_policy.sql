-- QA Phase 3 Super Admin remediation.
-- Super Admin needs global gym CRUD for the dedicated /super-admin portal.

grant insert, update, delete on public.gyms to authenticated;

drop policy if exists "super admins can insert gyms" on public.gyms;
create policy "super admins can insert gyms"
on public.gyms
for insert
to authenticated
with check (public.is_super_admin());

drop policy if exists "super admins can update gyms" on public.gyms;
create policy "super admins can update gyms"
on public.gyms
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "super admins can delete gyms" on public.gyms;
create policy "super admins can delete gyms"
on public.gyms
for delete
to authenticated
using (public.is_super_admin());
