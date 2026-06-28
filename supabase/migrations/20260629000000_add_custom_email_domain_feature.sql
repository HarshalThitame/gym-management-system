-- ============================================================================
-- Add custom_email_domain feature to catalog and Enterprise package
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- ADD FEATURE CATALOG ENTRY
-- ════════════════════════════════════════════════════════════════════════════

with cats as (select id, code from public.feature_categories)
insert into public.feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order) values
  ('custom_email_domain', 'Custom Email Domain', 'Send emails from your own domain via Resend DNS verification', (select id from cats where code = 'communication'), 'boolean', 'false', 8)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

-- ════════════════════════════════════════════════════════════════════════════
-- ENABLE FOR ENTERPRISE PACKAGE
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_enterprise_id uuid;
begin
  select id into v_enterprise_id from public.packages where slug = 'enterprise';
  if found then
    insert into public.package_features (package_id, feature_code, value) values
      (v_enterprise_id, 'custom_email_domain', 'true')
    on conflict (package_id, feature_code) do update set value = excluded.value;
  end if;
end $$;
