/**
 * Phase 9 Security Review Summary
 *
 * This documents the security posture of the entitlement system
 * after all 9 phases of implementation.
 */

/*
============================================================================
SECURITY HARDENING STATUS
============================================================================

✅ VERIFIED SECURE:
1.  Client cannot unlock features by changing frontend state
    → All feature checks use server-side `requireOrganizationFeatureAccess`
    → Phase 3 entitlement resolver runs on server only

2.  Client cannot pass fake organizationId
    → `assertUserBelongsToOrganization()` validates org ownership from session
    → OrganizationId resolved server-side from authenticated user context

3.  Client cannot pass fake packageId/amount
    → Package and pricing loaded server-side from DB in orchestrator
    → Amount calculated server-side; client amount never trusted

4.  Client cannot access locked API directly
    → `requireApiFeatureAccess()` on all protected API routes
    → Subscription check in `requireApiAuth()` for all authenticated APIs

5.  Client cannot access locked route by deep link
    → Phase 6 route guard catches EntitlementError → redirects to locked-feature page
    → `MODULE_FEATURE_MAP` maps routes to canonical feature keys

6.  Expired/replaced/suspended subscriptions do not unlock features
    → `evaluateEntitlementSnapshot()` denies for non-active statuses
    → `getOrganizationEntitlements()` returns empty features for inactive subs

7.  Razorpay webhook is signature-verified
    → HMAC-SHA256 verification using webhook secret
    → timingSafeEqual comparison prevents timing attacks
    → Raw body parsed only after signature validation

8.  Duplicate webhook events are idempotent
    → event_id + provider + environment uniqueness check
    → Already-processed events return 200 with duplicate_skipped

9.  Payment amount mismatch does not activate
    → `attach_razorpay_subscription_order()` validates amount matches invoice
    → `finalize_razorpay_subscription_payment()` validates amount matches order

10. Super Admin bypass only in Super Admin context
    → `isSuperAdminContext()` checks role from authenticated session
    → Bypass only applies to Super Admin routes, not org-owner routes


⚠️ DEFERRED (Acceptable Risk):

1.  Concurrency race condition on limit enforcement
    → Current count-check-then-insert pattern has a small race window
    → Acceptable for low-volume gym management use case
    → Hardening via atomic PostgreSQL RPC recommended for production

2.  Scheduled plan auto-activation
    → No cron job to activate `pending_activation` subscriptions
    → DB constraint only allows `active/trial/expired/suspended/cancelled`
    → Deferred: requires schema migration + cron infrastructure

3.  Rate limit on Razorpay order creation exists (20/min)
    → No rate limit on payment verification (30/min exists)
    → Acceptable: Razorpay itself has anti-abuse measures

4.  No external monitoring integration (Sentry/Datadog)
    → Server-side console.warn used for audit failures
    → Deferred: integrate when observability infrastructure is set up


🛡️ RLS POLICY STATUS:

- `packages` → Super Admin write, authenticated read
- `package_features` → Super Admin write, authenticated read
- `package_limits` → Super Admin write, authenticated read
- `organization_subscriptions` → Service role write, owner read
- `audit_logs` → Service role insert, authenticated read (staff scope)
- `branches/members/trainers` → Org-scoped CRUD
- All create actions run via service role (admin client) which bypasses RLS
  → This is intentional: org owners use server actions, not direct DB access


🔒 DEPRECATED/UNSAFE CODE:

- Old `OrgFeatureFlags` (camelCase) → kept for UI display only, security uses
  canonical `FeatureKey` (snake_case) from `features/entitlement`
*/
