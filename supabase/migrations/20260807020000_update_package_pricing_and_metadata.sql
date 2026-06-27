-- Remove quarterly/half_yearly pricing from all packages
delete from package_pricing where billing_period in ('quarterly', 'half_yearly');

-- Update Enterprise package description (remove phantom feature references)
update packages
set
  description = 'Enterprise plan is for large gym chains and multi-branch networks that need unlimited branches, unlimited members, advanced CRM, custom roles, API access, accounting integrations, and premium enterprise controls.',
  metadata = metadata::jsonb || '{"short_description": "Unlimited everything. Advanced CRM, custom roles, API access, priority support.", "target_customer": "Large gym chains, multi-branch networks, premium fitness brands, and enterprise organizations."}'::jsonb
where slug = 'enterprise';
