-- Phase 4.1: Cleanup stale entitlements and limits.
-- The organization_entitlements and organization_usage_limits tables use
-- JSON-based storage (features JSON, limits JSON) per organization row.
-- Cleanup is handled by the cleanupStaleEntitlements() server action
-- which cross-references package_features/package_limits against each
-- organization's entitlement row and removes stale entries from the JSON.
--
-- This migration serves as a marker that the cleanup phase has been
-- executed. Run the "Cleanup Stale Entitlements" button from the
-- Super Admin Feature Audit page (/super-admin/feature-audit) to
-- perform the actual cleanup.
--
-- The server action is idempotent and safe to re-run.

-- No raw SQL DELETE needed — the action handles JSON cleanup properly.
SELECT 1 AS cleanup_migration_applied;
