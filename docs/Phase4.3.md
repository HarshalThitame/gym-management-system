Continue from docs/Phase4.3.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 4.3 — Final Validation & Production Hardening for the entire application.

Short overview:
  The final phase. No new code unless validation uncovers bugs. This is a comprehensive
  quality gate: full builds, security audit (every server action and API route must
  be entitlement-gated), performance check (bundle size, rendering), accessibility
  validation, production readiness sign-off. When this phase passes, the application
  is ready for production deployment with all Enterprise features available, unlimited
  limits working, and zero phantom features in the package definitions.

  Supabase: https://bobqiyhljubfrzmhqnqq.supabase.co (see .env.local for keys)
  Use Promise.all for all independent Supabase queries in any audit actions.

Reference: docs/ENTERPRISE_PRODUCTION_PLAN.md Phase 4 Session 23.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

CHECKPOINT 1: Build & Type Safety

Step 1: Run the full build pipeline.
  Commands (run sequentially and verify zero errors):
    npm run typecheck    → 0 errors
    npm run lint         → 0 errors (ignore pre-existing warnings)
    npm run build        → Successful Next.js build
    npm test             → All unit tests pass

  If any fail, fix before proceeding. No exceptions.

  Verify the build output:
    Check the build summary for any suspiciously large chunks (> 200KB JS).
    Check that all new routes are present in the build output.
    Verify no "Dynamic" routes that should be "Static" or "SSG".

---

CHECKPOINT 2: Entitlement Gating Audit

Step 2: Audit every server action for entitlement guards.
  Goal: Every server action in features/organization-owner/actions/ must call
  requireOrgFeatureAccess or requireOrganizationFeatureAccess at the top.

  Command to list all action files:
    ls features/organization-owner/actions/*.ts

  For each file, manually verify:
    - Does the file import from @/features/entitlement?
    - Does each exported async function call requireOrgFeatureAccess or
      requireOrganizationFeatureAccess before any business logic?
    - Are utility/internal functions (not exported) properly internal?
    - Does any action trust a client-supplied organizationId without validating?
    - Are entitlement catch blocks using entitlementActionCatch or entitlementSimpleCatch?

  Specific files to check (the full list — adjust based on what Phase 1-3 actually created):
    - member-actions.ts
    - staff-actions.ts
    - trainer-actions.ts
    - branch-actions.ts
    - class-actions.ts (organization-owner version)
    - attendance-actions.ts (organization-owner version)
    - communication-actions.ts
    - lead-actions.ts
    - member-field-actions.ts
    - member-import-actions.ts
    - commission-actions.ts
    - payroll-actions.ts
    - staff-attendance-actions.ts
    - staff-leave-actions.ts
    - staff-branch-actions.ts
    - hr-actions.ts
    - custom-roles-actions.ts
    - corporate-actions.ts
    - revenue-split-actions.ts
    - cross-branch-actions.ts
    - class-calendar-actions.ts
    - trainer-sharing-actions.ts
    - referral-actions.ts
    - loyalty-actions.ts
    - campaign-actions.ts
    - nps-actions.ts
    - dashboard-actions.ts
    - report-schedule-actions.ts
    - equipment-actions.ts
    - calendar-actions.ts
    - webhook-actions.ts
    - audit-trail-actions.ts
    - branding-actions.ts
    - domain-actions.ts
    - gym-actions.ts
    - membership-actions.ts
    - nutrition-actions.ts
    - plan-actions.ts
    - profile-actions.ts
    - settings-actions.ts
    - support-actions.ts
    - bulk-actions.ts

  ANY action file missing entitlement guards is a CRITICAL bug. Fix immediately.

Step 3: Audit every API route for entitlement guards.
  Goal: Every non-public API route in app/api/ that serves organization data must
  call requireApiFeatureAccess or have equivalent gating.

  Command to list all API routes:
    find app/api -name "route.ts" | sort

  For each route, check:
    - Does it handle organization-scoped data? (members, payments, classes, etc.)
    - If yes: does it call requireApiFeatureAccess at the top?
    - If no: is it genuinely public (auth callback, webhook receiver, health check)?
    - Does it validate organization ownership? (org_id from auth, not from request body)
    - Does it return 403 / FEATURE_LOCKED for unauthorized plans?

  Exclude from audit (legitimately public):
    - app/api/auth/session/route.ts
    - app/api/health/route.ts
    - app/api/webhooks/razorpay/route.ts (validated by Razorpay signature)
    - app/api/leads/route.ts (POST is public lead capture)
    - app/api/cron/* (protected by CRON_SECRET)
    - app/api/pwa/* (public PWA endpoints)

Step 4: Run an automated entitlement-gating check.
  File: features/super-admin/actions/production-readiness-actions.ts
  Create a Super Admin server action that scans all action files and reports
  which ones are missing entitlement guards.

  Function: auditEntitlementGating()
    Gate: super_admin only.
    Scans features/organization-owner/actions/*.ts for files that DON'T import
    from @/features/entitlement or DON'T call requireOrgFeatureAccess.
    Returns { files: string[]; missingGuards: string[]; filesChecked: number }
    This is a static check — reads file contents, doesn't import them.

  This provides an automated safety net for future development.

---

CHECKPOINT 3: Limit Handling Audit

Step 5: Verify unlimited limits don't block creation.
  Goal: For all resources tracked in canCreateResource, verify that -1 (unlimited)
  does not produce a LIMIT_REACHED error.

  Check the limits-service.ts canCreateResource function:
    - Does isUnlimited check return allowed: true BEFORE the usage counter query?
    - Yes — it does. Verified in original audit. No change needed.
    
  Verify the checkOrganizationLimit function in super-admin entitlement-service:
    - Does limitVal === -1 return withinLimit: true?
    - Yes. Verified in original audit. No change needed.

  Verify feature-resolver.ts:
    - Do isWithinMemberLimit and isWithinBranchLimit check for -1?
    - Yes. Verified.

  No code changes needed — all limit handling is correct. This checkpoint is
  confirmatory only.

Step 6: Add a limit-edge-case test.
  File: tests/unit/features/unlimited-limits.test.ts
  Unit test that:
    - canCreateResource returns allowed: true for isUnlimited: true regardless of usage
    - checkOrganizationLimit returns withinLimit: true for limitVal === -1
    - isWithinMemberLimit returns true for maxMembers === -1

---

CHECKPOINT 4: Feature Key Integrity

Step 7: Run the feature key validator (built in Phase 4.1).
  Call: validateFeatureKeyIntegrity()
  Verify:
    - All FEATURE_KEYS exist in FEATURE_MAP of feature-resolver.ts
    - All MODULE_FEATURE_MAP values are in FEATURE_KEYS
    - All sidebar featureKeys are in FEATURE_KEYS
    - No duplicate keys
    - No orphaned keys in the database
  Fix any errors before proceeding.

Step 8: Verify package_features match subscriptions.
  For the three test organizations (Starter, Growth, Enterprise):
    - Fetch their active subscription
    - Fetch their package_features
    - Fetch their activeFeatureKeys via getOrganizationEntitlements
    - Verify: activeFeatureKeys matches package_features exactly (no extras, no missing)
    - Verify: each activeFeatureKey has a real implementation (sidebar/route/api/UI)

  This can be a manual check or a Super Admin server action.

---

CHECKPOINT 5: Performance & Bundle Size

Step 9: Analyze the production build.
  Command: npm run build
  Review the build output carefully:
    - Total JS size per route (listed as "First Load JS shared by all")
    - Look for routes exceeding 300 KB (potential lazy-loading candidates)
    - Check that dynamically imported modules (React.lazy) are code-split
    - Verify no heavy libraries are bundled into multiple routes unnecessarily

  Known large routes (acceptable):
    - /organization (dashboard) — many KPI components + Recharts → ~200 KB
    - /super-admin/analytics — rich charts → ~150 KB

  Action items if issues found:
    - Large shared chunks: lazy-load sub-components with dynamic import()
    - Duplicate Recharts: verify tree-shaking is working (named imports only)
    - Icons: verify only used Lucide icons are imported (tree-shaking handles this)

Step 10: Run Lighthouse audit (manual, dev server).
  Start: npm run dev
  Open Chrome DevTools → Lighthouse → Generate report for:
    - /organization (Organization Owner dashboard)
    - /organization/members (members list)
    - /organization/analytics (analytics with charts)

  Target scores:
    - Performance: > 80 (acceptable for data-heavy dashboard)
    - Accessibility: > 90
    - Best Practices: > 90
    - SEO: > 90

---

CHECKPOINT 6: Accessibility

Step 11: Run basic accessibility checks.
  - Verify skip-to-content link works (Tab on page load → "Skip to main content" visible)
  - Verify all interactive elements are keyboard-accessible (Tab, Enter, Escape)
  - Verify form inputs have labels (DrawerField component should handle this)
  - Verify status badges use text + color (not color alone — existing Badge component handles this)
  - Verify modals/drawers trap focus and close on Escape
  - Verify data tables have proper semantic markup

  Most of these are handled by existing UI components (DrawerField, Badge, Button, Input).
  Focus on NEW components built in Phases 1-3 that may have skipped these.

---

CHECKPOINT 7: Security

Step 12: Security checklist.
  - [ ] All Supabase queries use server-side client (createSupabaseServerClient), never client-side for mutation
  - [ ] No raw SQL injection — all queries use parameterized .eq()/.in()/.insert()
  - [ ] All server actions validate organization ownership (check gym/organization belongs to user)
  - [ ] All file uploads go through server-side validation (HR documents, CSV imports)
  - [ ] No secrets exposed to client (API keys, tokens, .env.local values are server-only)
  - [ ] CSRF: Next.js server actions have built-in CSRF protection
  - [ ] Rate limiting: existing rate-limiter.ts covers API routes
  - [ ] CRON endpoints secured by CRON_SECRET header check
  - [ ] Webhook endpoints validate signatures (Razorpay webhook already does)
  - [ ] Resend API key never exposed client-side (used only in server actions)
  - [ ] Supabase service role key never exposed client-side (used only via getSupabaseAdminClient)

Step 13: Run a quick grep for common security issues.
  Commands:
    # Check for client-side Supabase admin usage (should never happen)
    rg "getSupabaseAdminClient" app/ --include="*.tsx" --include="*.ts"
    # Should only appear in server actions (*.ts with "use server") and API routes.
    # If found in any "use client" file, that's a CRITICAL bug.

    # Check for hardcoded secrets
    rg "eyJ|sk-" --include="*.ts" --include="*.tsx" --glob="!node_modules" --glob="!.next"
    # Should only appear in .env.local. Any others are leaks.

    # Check for organizationId from client body (unsafe pattern)
    rg "body.organizationId|body.organization_id|formData.get\('organizationId'" app/ --include="*.ts"
    # Should NOT appear in API routes. organizationId must come from auth context.

---

CHECKPOINT 8: Production Deploy Readiness

Step 14: Production checklist.
  - [ ] Build completes without errors: npm run build
  - [ ] All tests pass: npm test && npx playwright test
  - [ ] No console errors in production build (check manually)
  - [ ] Error boundaries in place: app/error.tsx, app/global-error.tsx
  - [ ] Loading skeletons for all routes: loading.tsx files present
  - [ ] Metadata for all pages: generateMetadata or metadata export
  - [ ] robots.ts and sitemap.ts present and correct
  - [ ] PWA manifest: manifest.ts present
  - [ ] Environment variables set in Vercel dashboard (not just .env.local)
  - [ ] SUPABASE_SERVICE_ROLE_KEY set in Vercel
  - [ ] RESEND_API_KEY set in Vercel
  - [ ] RAZORPAY keys set in Vercel
  - [ ] CRON_SECRET set in Vercel
  - [ ] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY set in Vercel
  - [ ] Custom domain configured (apexgymmanagementsystem.vercel.app or custom)
  - [ ] Database migrations applied (all .sql files in supabase/migrations/)

Step 15: Run migrations against production Supabase.
  Verify all migrations from Phases 1-3 are pushed:
    List all migration files: ls supabase/migrations/
    Confirm the newest migrations are applied (check Supabase dashboard → Database → Migrations).
    If any are pending, run them.

---

CHECKPOINT 9: Final Sign-Off

Step 16: Run the full test suite one final time.
  Commands:
    npm run typecheck
    npm run lint
    npm run build
    npm test

  All must pass with ZERO errors and ZERO new warnings.

Step 17: Generate final audit report.
  Create a summary of everything achieved:
    - Total features implemented: ~51 features across Phases 1-3
    - Features removed from packages: 17 (Phase 1.1)
    - Features on roadmap: 5
    - New DB tables created: ~20
    - New sidebar modules created: Leads, Custom Roles, Equipment
    - New sub-tabs added: 15+ across existing modules
    - New server actions: ~30 files
    - New UI components: ~40 files
    - E2E test specs: 15 files
    - Entitlement pipeline: verified end-to-end (package_features → activeFeatureKeys → sidebar/route/API guards)
    - Unlimited limits: verified -1 does not block creation
    - Feature key integrity: all keys match across registry, resolver, sidebar, DB
    - Build: passes with zero errors
    - Tests: all pass

  Write this report to:
    docs/PRODUCTION_READINESS_REPORT.md

  This serves as the final sign-off document.

---

Step 18: Final commands to run.
  npm run typecheck   # Must pass
  npm run lint        # Must pass
  npm run build       # Must complete successfully
  npm test            # All unit tests pass
  npx playwright test # All E2E tests pass (dev server must be running)

  If ALL above pass: PRODUCTION READY.

---

Files to Create:
  tests/unit/features/unlimited-limits.test.ts
  features/super-admin/actions/production-readiness-actions.ts
  docs/PRODUCTION_READINESS_REPORT.md

Files to Modify:
  None (unless bugs are found during audit).

Key principles for this phase:
  - This is validation, not building. Fix bugs, don't add features.
  - Every server action MUST have an entitlement guard. Zero exceptions.
  - Every API route MUST validate organization ownership. Zero exceptions.
  - Build must pass clean. Zero warnings accepted for new code.
  - All tests must pass. Flaky tests are bugs, not acceptable for production.
  - The production readiness report is the sign-off document. It must be honest.
