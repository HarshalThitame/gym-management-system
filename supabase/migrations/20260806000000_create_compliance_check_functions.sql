-- ============================================================
-- Compliance Check Helper Functions
-- These are SECURITY DEFINER functions to allow querying
-- pg_catalog.pg_policies which is not exposed via PostgREST.
-- Used by the compliance-checker-service.
-- ============================================================

-- 1. Return all table names that have at least one RLS policy defined.
--    Used for RLS Coverage Check and Storage Policy Check.
create or replace function public.check_tables_with_rls()
returns table(tablename text)
language sql
security definer
set search_path = pg_catalog
as $$
  select distinct tablename::text
  from pg_policies
  where schemaname = 'public'
  order by tablename;
$$;

-- 2. Count how many RLS policies exist on storage.objects.
--    Used for Storage Policy Check (storage buckets).
create or replace function public.check_storage_objects_rls_count()
returns bigint
language sql
security definer
set search_path = pg_catalog
as $$
  select count(*)::bigint
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects';
$$;

-- 3. List all tables in the public schema that are missing RLS.
--    Used for detailed RLS Coverage reporting.
create or replace function public.check_tables_without_rls(check_tables text[])
returns table(uncovered_table text)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  tbl text;
  has_rls int;
begin
  foreach tbl in array check_tables loop
    select count(*) into has_rls
    from pg_policies
    where schemaname = 'public'
      and tablename = tbl;

    if has_rls = 0 then
      uncovered_table := tbl;
      return next;
    end if;
  end loop;
end;
$$;

-- Grant execute to authenticated users (super_admin via service_role)
grant execute on function public.check_tables_with_rls to authenticated;
grant execute on function public.check_storage_objects_rls_count to authenticated;
grant execute on function public.check_tables_without_rls to authenticated;
