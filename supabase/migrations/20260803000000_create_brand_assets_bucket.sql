insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated users can read brand assets" on storage.objects;
create policy "authenticated users can read brand assets"
on storage.objects for select to authenticated
using (bucket_id = 'brand-assets');

drop policy if exists "super_admin can manage brand assets" on storage.objects;
create policy "super_admin can manage brand assets"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'brand-assets'
  and public.is_super_admin()
)
with check (
  bucket_id = 'brand-assets'
  and public.is_super_admin()
);

drop policy if exists "super_admin can upload brand assets" on storage.objects;
create policy "super_admin can upload brand assets"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'brand-assets'
  and public.is_super_admin()
);
