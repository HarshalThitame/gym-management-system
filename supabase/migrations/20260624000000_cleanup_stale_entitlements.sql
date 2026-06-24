-- Cleanup stale organization_entitlements and organization_usage_limits
-- after Phase 1.1 feature removals and Phases 1-3 additions.
-- Removes rows referencing feature/limit codes no longer in the org's
-- current active/trial package's package_features or package_limits.

DELETE FROM organization_entitlements oe
WHERE NOT EXISTS (
  SELECT 1 FROM organization_subscriptions os
  JOIN package_features pf ON pf.package_id = os.package_id
  WHERE os.organization_id = oe.organization_id
    AND pf.feature_code = oe.feature_code
    AND os.status IN ('active', 'trial')
);

DELETE FROM organization_usage_limits oul
WHERE NOT EXISTS (
  SELECT 1 FROM organization_subscriptions os
  JOIN package_limits pl ON pl.package_id = os.package_id
  WHERE os.organization_id = oul.organization_id
    AND pl.limit_code = oul.limit_code
    AND os.status IN ('active', 'trial')
);
