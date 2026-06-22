-- Phase 2.2: HR Document Storage
-- Table: hr_documents
-- Feature key: hr_document_storage
-- Bucket: hr-documents (create manually in Supabase dashboard or via SQL below)

create table public.hr_documents (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  staff_id uuid not null,
  doc_type text not null check (doc_type in ('contract', 'certificate', 'id_proof', 'joining_letter', 'other')),
  file_name text not null,
  file_url text not null,
  file_size integer,
  content_type text,
  expiry_date date,
  notes text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_documents_org_staff_idx on public.hr_documents (organization_id, staff_id);
create index if not exists hr_documents_expiry_idx on public.hr_documents (expiry_date) where expiry_date is not null;
create index if not exists hr_documents_doc_type_idx on public.hr_documents (organization_id, doc_type);

-- RLS
alter table public.hr_documents enable row level security;

create policy "Organization owners can manage hr_documents"
  on public.hr_documents for all
  to authenticated
  using (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select id from public.organizations
      where owner_user_id = auth.uid()
    )
  );

create policy "Service role full access on hr_documents"
  on public.hr_documents for all
  to service_role
  using (true)
  with check (true);

-- Trigger for updated_at
drop trigger if exists set_hr_documents_updated_at on public.hr_documents;
create trigger set_hr_documents_updated_at before update on public.hr_documents for each row execute function public.set_updated_at();

-- Grants
grant select, insert, update, delete on public.hr_documents to authenticated;
