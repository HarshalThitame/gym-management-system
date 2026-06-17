-- Pricing & Billing Cycle Update
-- Updates monthly/annual pricing with "2 months free" model

-- Starter: monthly=2999, annual=29990 (2 months free)
UPDATE package_pricing SET price = 2999000 WHERE package_id = (SELECT id FROM packages WHERE slug = 'starter') AND billing_period = 'annual';
UPDATE packages SET metadata = metadata || '{"price_monthly": 299900, "price_annual": 2999000, "annual_effective_monthly": 249900, "annual_savings": 599800, "annual_discount_label": "2 months free", "trial_days": 14, "is_trial_available": true, "billing_cycle_options": ["monthly", "annual"]}'::jsonb WHERE slug = 'starter';

-- Growth: monthly=7499, annual=74990 (2 months free)
UPDATE package_pricing SET price = 7499000 WHERE package_id = (SELECT id FROM packages WHERE slug = 'growth') AND billing_period = 'annual';
UPDATE packages SET metadata = metadata || '{"price_monthly": 749900, "price_annual": 7499000, "annual_effective_monthly": 624900, "annual_savings": 1499800, "annual_discount_label": "2 months free", "trial_days": 14, "is_trial_available": true, "billing_cycle_options": ["monthly", "annual"]}'::jsonb WHERE slug = 'growth';

-- Enterprise: custom pricing
UPDATE packages SET metadata = metadata || '{"is_custom_pricing": true, "custom_price_label": "Contact Sales", "annual_discount_label": "Volume deals / Custom contract", "trial_days": 0, "is_trial_available": false, "billing_cycle_options": ["custom"]}'::jsonb WHERE slug = 'enterprise';
