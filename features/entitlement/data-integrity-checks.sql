-- ============================================================================
-- ENTITLEMENT DATA INTEGRITY CHECKS
-- Run these queries periodically or via a cron job to detect data anomalies.
-- No destructive actions — report-only queries.
-- ============================================================================

-- 1. Organizations with more than one active/trial subscription
-- Expected: 0 rows (unique constraint on organization_id should prevent this,
-- but verify as a safety check).
SELECT organization_id, COUNT(*) AS subscription_count
FROM public.organization_subscriptions
WHERE status IN ('active', 'trial')
GROUP BY organization_id
HAVING COUNT(*) > 1;

-- 2. Active/trial subscriptions with missing package_id
-- Expected: 0 rows
SELECT id, organization_id, status, package_id
FROM public.organization_subscriptions
WHERE status IN ('active', 'trial')
  AND package_id IS NULL;

-- 3. Active/trial subscriptions linked to inactive or deleted packages
-- Expected: 0 rows
SELECT os.id AS subscription_id, os.organization_id, os.status, os.package_id,
       p.name AS package_name, p.is_active
FROM public.organization_subscriptions os
JOIN public.packages p ON p.id = os.package_id
WHERE os.status IN ('active', 'trial')
  AND p.is_active = false;

-- 4. Active/trial subscriptions with end_date in the past
-- Expected: 0 rows (subscription should have been marked expired/cancelled)
SELECT id, organization_id, status, expires_at
FROM public.organization_subscriptions
WHERE status IN ('active', 'trial')
  AND expires_at IS NOT NULL
  AND expires_at < now();

-- 5. Cancelled subscriptions with no cancelled_at timestamp
-- Expected: 0 rows (check constraint should enforce this)
SELECT id, organization_id, status, cancelled_at
FROM public.organization_subscriptions
WHERE status = 'cancelled'
  AND cancelled_at IS NULL;

-- 6. Paid invoices with no linked subscription (if subscription_id is NOT NULL)
-- Expected: 0 rows for invoices that should have a subscription
SELECT id, invoice_number, organization_id, subscription_id, status, total_amount
FROM public.org_subscription_invoices
WHERE status = 'paid'
  AND subscription_id IS NULL
  AND package_id IS NOT NULL;

-- 7. Payments captured but no subscription created/updated
-- Checks payments marked 'paid' where the invoice has no subscription link
SELECT p.id AS payment_id, p.organization_id, p.invoice_id, p.status,
       i.subscription_id, i.status AS invoice_status
FROM public.org_subscription_payments p
JOIN public.org_subscription_invoices i ON i.id = p.invoice_id
WHERE p.status = 'paid'
  AND i.subscription_id IS NULL;

-- 8. Packages with no feature rows in package_features
-- Expected: only intentional (e.g., custom/enterprise packages)
SELECT p.id, p.name, p.slug, p.is_active
FROM public.packages p
LEFT JOIN public.package_features pf ON pf.package_id = p.id
WHERE p.is_active = true
  AND pf.package_id IS NULL;

-- 9. package_features referencing invalid feature_catalog codes
-- Expected: 0 rows
SELECT pf.package_id, pf.feature_code, p.name AS package_name
FROM public.package_features pf
JOIN public.packages p ON p.id = pf.package_id
LEFT JOIN public.feature_catalog fc ON fc.code = pf.feature_code
WHERE fc.code IS NULL;

-- 10. Organization subscriptions with provider='razorpay' but no provider_environment
-- Expected: 0 rows
SELECT id, organization_id, status, provider, provider_environment
FROM public.organization_subscriptions
WHERE provider = 'razorpay'
  AND provider_environment IS NULL;
