update public.tenant_domains
set
  domain_type = 'system',
  ssl_status = 'managed_by_vercel',
  metadata = metadata || jsonb_build_object(
    'system_domain', true,
    'system_domain_reason', 'apex_vercel_production_domain',
    'system_domain_classified_at', now()
  ),
  updated_at = now()
where normalized_domain = 'apexgymmanagementsystem.vercel.app';
