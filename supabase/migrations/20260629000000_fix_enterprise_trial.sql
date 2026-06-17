-- Fix Enterprise trial_days - should be 0 (no free trial for Enterprise)
UPDATE packages SET trial_days = 0 WHERE slug = 'enterprise' AND trial_days IS DISTINCT FROM 0;
