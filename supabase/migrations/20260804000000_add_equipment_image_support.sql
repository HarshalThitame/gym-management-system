alter table public.equipment
  add column if not exists image_url text,
  add column if not exists image_storage_path text,
  add column if not exists image_source text check (image_source in ('upload', 'ai')),
  add column if not exists image_prompt text;

comment on column public.equipment.image_url is 'Public asset URL for the equipment image.';
comment on column public.equipment.image_storage_path is 'Supabase storage path for the persisted equipment image.';
comment on column public.equipment.image_source is 'Whether the image came from a device upload or AI generation.';
comment on column public.equipment.image_prompt is 'Prompt used for AI-generated equipment imagery, when applicable.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'equipment-images',
  'equipment-images',
  true,
  4194304,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated users can read equipment images" on storage.objects;
create policy "authenticated users can read equipment images"
on storage.objects for select to authenticated
using (bucket_id = 'equipment-images');
