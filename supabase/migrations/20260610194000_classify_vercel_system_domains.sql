update public.tenant_domains
set
  domain_type = 'system',
  ssl_status = case
    when ssl_status in ('issued', 'managed_by_vercel') then 'managed_by_vercel'
    else ssl_status
  end,
  metadata = metadata || jsonb_build_object(
    'system_domain', true,
    'system_domain_reason', 'vercel_app_domain',
    'system_domain_classified_at', now()
  ),
  updated_at = now()
where normalized_domain like '%.vercel.app'
  and domain_type <> 'system';
