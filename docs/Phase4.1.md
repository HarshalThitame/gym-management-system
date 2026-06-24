Continue from docs/Phase4.1.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 4.1 — Package Sync & Entitlement Cleanup for Super Admin panel.

Short overview:
  Phase 4 is the polish and hardening phase — no new features. Phase 4.1 handles
  the post-build cleanup: ensuring organization_entitlements stays in sync with the
  updated package_features (after all the removals in Phase 1.1 and additions in
  Phases 1-3), building a Super Admin "Feature Availability Audit" page that compares
  what each plan promises vs what's actually implemented in the app, and adding
  runtime integrity checks that validate the entitlement pipeline end-to-end.
  This is a Super Admin-only phase — no Org Owner UI changes.

  Supabase: https://bobqiyhljubfrzmhqnqq.supabase.co (see .env.local for keys)
  Use Promise.all for all independent Supabase queries.

Reference: docs/ENTERPRISE_PRODUCTION_PLAN.md Phase 4 Session 21.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

PART A: Entitlement Sync After All Changes

Step A1: Read existing sync infrastructure.
  - features/subscription/entitlement-sync-service.ts (full file — syncOrganizationEntitlements
    copies package_features → organization_entitlements, syncOrganizationUsageLimits copies
    package_limits → organization_usage_limits, both log to subscription_events)
  - features/entitlement/entitlement-repository.ts (getSubscriptionWithPackageFeatures
    already queries package_features, not organization_entitlements — so sync is the
    bridge between the two)
  - features/entitlement/entitlement-service.ts (getOrganizationEntitlements uses
    getSubscriptionWithPackageFeatures — already reads from the source of truth)

Step A2: Understanding current sync flow.
  The entitlement pipeline currently works like this:
    package_features (source of truth) → getSubscriptionWithPackageFeatures() → activeFeatureKeys
    organization_entitlements (snapshot copy) → syncOrganizationEntitlements() copies from package_features

  After Phase 1.1 (17 features removed from package_features) and Phases 1-3 (no new
  features added to package_features — those were done in the seed migrations), the
  organization_entitlements for existing Enterprise orgs may have stale entries for
  the removed features. The sync function handles this: it upserts all features from
  package_features into organization_entitlements. Features NOT in package_features
  remain in organization_entitlements (stale). This isn't a production problem because
  the entitlement pipeline reads from package_features, not organization_entitlements.

  But it IS messy. We should clean up stale entitlements.

Step A3: Create a cleanup migration/script.
  File: supabase/migrations/YYYYMMDD_cleanup_stale_entitlements.sql

  This migration removes organization_entitlements rows that reference feature codes
  no longer present in the org's current package_features. This handles orgs that had
  an active Enterprise subscription when the 17 features were present.

  SQL:
    DELETE FROM organization_entitlements oe
    WHERE NOT EXISTS (
      SELECT 1 FROM organization_subscriptions os
      JOIN package_features pf ON pf.package_id = os.package_id
      WHERE os.organization_id = oe.organization_id
        AND pf.feature_code = oe.feature_code
        AND os.status IN ('active', 'trial')
    );

  Same for usage limits:
    DELETE FROM organization_usage_limits oul
    WHERE NOT EXISTS (
      SELECT 1 FROM organization_subscriptions os
      JOIN package_limits pl ON pl.package_id = os.package_id
      WHERE os.organization_id = oul.organization_id
        AND pl.limit_code = oul.limit_code
        AND os.status IN ('active', 'trial')
    );

Step A4: Create a Super Admin "Sync All" server action.
  File: features/super-admin/actions/entitlement-sync-actions.ts
  Mark as "use server".

  Export:
  - syncAllOrganizationEntitlements()
    Gate: super_admin role only (requireRole check).
    Fetches all organizations with active/trial subscriptions.
    For each, calls syncOrganizationEntitlements + syncOrganizationUsageLimits.
    Runs in parallel batches of 10 (to avoid rate limiting).
    Returns { synced: number; failed: number; errors: string[] }

  - cleanupStaleEntitlements()
    Gate: super_admin only.
    Runs the SQL from Step A3.
    Returns { deletedEntitlements: number; deletedLimits: number }

  - getEntitlementHealthReport()
    Gate: super_admin only.
    Returns {
      totalOrgs: number,
      orgsWithActiveSub: number,
      orgsWithStaleEntitlements: number,
      staleFeaturesPerOrg: { orgId, orgName, staleFeatureCodes: string[] }[],
      orgsWithMissingEntitlements: number,
      lastSyncTimestamps: { orgId, orgName, entitlementsSyncedAt, limitsSyncedAt }[]
    }

  Parallel DB pattern for syncAll:
    const { data: orgs } = await supabase.from("organization_subscriptions")
      .select("organization_id").in("status", ["active", "trial"]);
    // Process in batches of 10 in parallel:
    for (let i = 0; i < orgs.length; i += 10) {
      const batch = orgs.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(org => Promise.all([
          syncOrganizationEntitlements(org.organization_id),
          syncOrganizationUsageLimits(org.organization_id)
        ]))
      );
    }

---

PART B: Super Admin Feature Audit Page

Step B1: Understand the goal.
  The Super Admin needs a page that shows:
  - Per plan: which features are in package_features vs which are actually implemented
    in the app (sidebar, route, API, UI)
  - Mismatch detection: feature in plan but no implementation → "GAP"
  - Gap severity: P0 (critical), P1 (important), P2 (advanced), N/A (service/infrastructure)
  - Overall audit score per plan: % of promised features that are fully implemented

  This page reads from BOTH the database (package_features) AND the app code
  (feature-registry, MODULE_FEATURE_MAP, sidebar config, route config).

Step B2: Create the audit report page.
  File: app/(super-admin)/super-admin/feature-audit/page.tsx
  Server component (no client interactivity needed — it's a read-only report).

  Data sources to fetch in parallel:
    1. All packages with their package_features + package_limits
    2. The app's FEATURE_KEYS registry
    3. The app's MODULE_FEATURE_MAP
    4. The app's sidebar module list from organization-owner-modules.tsx

  For each feature in each package, check:
    - Exists in FEATURE_KEYS? → YES/NO
    - Has MODULE_FEATURE_MAP entry? → YES (module name) / NO
    - Has sidebar entry? → YES (label) / NO
    - Has route? → YES (dedicated or [module] dynamic) / NO
    - Has server actions? → YES (action files list) / NO
    - Has UI component? → YES (module file exists) / PARTIAL / NO
    - Status: FULLY_IMPLEMENTED / PARTIAL / CONFIGURED_ONLY / NOT_IMPLEMENTED / SERVICE_OR_INFRA

  File: features/super-admin/services/feature-audit-service.ts
  "use server" functions to build the audit report.

  Function: buildFeatureAuditReport()
    Returns: { plans: PlanAudit[]; summary: { totalFeatures, implemented, partial, configured, notImplemented, serviceInfra, implementationRate } }
    PlanAudit = { packageName, features: FeatureAuditRow[], summary: same breakdown per plan }
    FeatureAuditRow = { featureCode, category, planValue, inFeatureKeys, hasModuleMap, hasSidebar, hasRoute, hasActions, hasUI, status, gapSeverity }

    This function imports from:
    - features/entitlement/feature-registry.ts (FEATURE_KEYS, MODULE_FEATURE_MAP, FEATURE_CATEGORIES)
    - features/organization-owner/lib/organization-owner-modules.tsx (organizationOwnerModules)
    - features/subscription/feature-definitions.ts (FEATURE_CATEGORIES)

    It queries Supabase for package data, then cross-references with app code.
    No feature gate (Super Admin only via route/layout guard).

  Step B3: Determine UI status for each feature.
    Create a helper function that maps feature codes to implementation status:

    const FEATURE_IMPLEMENTATION_MAP: Record<string, {
      hasSidebar: boolean; sidebarModule?: string;
      hasRoute: boolean; route?: string;
      hasActions: boolean; actionFiles?: string[];
      hasUI: boolean; uiFiles?: string[];
      status: 'full' | 'partial' | 'configured' | 'not_implemented' | 'service_infra';
      gapSeverity: 'P0' | 'P1' | 'P2' | 'N/A';
    }>

    This map is manually authored based on the audit performed in Phase 1.1 and
    all features built in Phases 1-3. It's the "ground truth" of what's implemented.

    Features with no implementation = "not_implemented" + P0/P1/P2.
    Features from the "REMOVE" list = marked as "service_infra" with N/A severity
    (they were already removed from package_features in Phase 1.1).

  This map is large (~90 entries for Enterprise features). Build it systematically
  by iterating through FEATURE_KEYS and checking each against the MODULE_FEATURE_MAP,
  sidebar modules, and action files.

Step B4: Create the audit page UI.
  File: features/super-admin/components/feature-audit-view.tsx
  "use client" component. Renders the audit report from server data.

  Layout:
  - Hero section: "Feature Availability Audit" title + description
  - Plan selector: tabs for Starter, Growth, Enterprise
  - Summary cards per plan:
    - Total features in plan
    - Implementation rate % (green bar)
    - Fully implemented count (green)
    - Partially implemented count (yellow)
    - Configured only count (orange)
    - Not implemented count (red)
    - Service/Infrastructure features (gray, excluded from rate)
  - Feature table (filterable by status, category, severity):
    - Columns: Feature Code, Category, Plan Value, Sidebar, Route, Actions, UI, Status, Gap
    - Sortable, searchable
    - Status column: colored badge (green/yellow/orange/red/gray)
    - Gap column: P0 (red), P1 (orange), P2 (yellow), N/A (gray)
  - Export as CSV

Step B5: Add audit page to Super Admin sidebar.
  File: features/super-admin/lib/super-admin-modules.tsx (or similar config)
  Check how the Super Admin sidebar is configured.
  Add: "Feature Audit" entry linking to /super-admin/feature-audit.
  This page is always visible (no feature gate for Super Admin).

---

PART C: Runtime Integrity Checks

Step C1: Create a runtime feature key validator.
  File: features/entitlement/feature-key-validator.ts

  Export:
  - validateFeatureKeyIntegrity()
    Runs at build time or on-demand via Super Admin action.
    Checks:
    1. Every key in FEATURE_KEYS is in the OrgFeatureFlags interface (compile-time via TS)
    2. Every key in FEATURE_KEYS has a mapping in feature-resolver's FEATURE_MAP
    3. Every key in MODULE_FEATURE_MAP is in FEATURE_KEYS (mapping integrity)
    4. Every sidebar module's featureKey is in FEATURE_KEYS
    5. No duplicate feature keys
    6. All package_features rows reference valid FEATURE_KEYS (DB check)

    Returns { valid: boolean; errors: IntegrityError[] }
    IntegrityError = { type: 'missing_from_map' | 'missing_from_keys' | ...; key: string; detail: string }

  This function is called at startup or triggered manually by Super Admin.
  Run it as a Super Admin server action: validateAppIntegrity()

  Parallel checks:
    const [keysResult, mapResult, sidebarResult, dbResult] = await Promise.all([
      checkFeatureKeysAgainstFlags(),  // in-memory
      checkFeatureKeysAgainstResolverMap(),  // in-memory
      checkSidebarKeys(),  // in-memory
      supabase.from("package_features").select("feature_code"),  // DB
    ]);

Step C2: Create a Super Admin integrity check page.
  File: app/(super-admin)/super-admin/feature-audit/integrity/page.tsx
  Or add a "Run Integrity Check" button to the main audit page.

  Calls validateFeatureKeyIntegrity and displays results:
  - Green checkmark: "All integrity checks passed"
  - Red X with error list: each error with key and detail
  - "Fix Stale Entitlements" button → calls cleanupStaleEntitlements
  - "Sync All Organizations" button → calls syncAllOrganizationEntitlements

---

Final Validation:
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Verification checklist:
  Sync:
  - syncAllOrganizationEntitlements runs without errors
  - cleanupStaleEntitlements removes orphaned rows
  - getEntitlementHealthReport returns accurate counts
  - Existing orgs still have correct activeFeatureKeys after sync
  Audit Page:
  - /super-admin/feature-audit renders with plan tabs
  - Starter/Growth/Enterprise tabs show correct feature lists
  - Implementation rate % is accurate
  - Feature table filters work (status, category, severity)
  - CSV export downloads valid report
  - "Feature Audit" visible in Super Admin sidebar
  - Page shows GAP warnings for features configured but not implemented
  Integrity:
  - validateFeatureKeyIntegrity returns valid: true (or lists specific errors)
  - No duplicate feature keys
  - All MODULE_FEATURE_MAP keys are in FEATURE_KEYS
  - All sidebar featureKeys are in FEATURE_KEYS
  - All package_features rows have valid keys
  General:
  - All Super Admin actions gated by super_admin role (not feature key)
  - No Org Owner facing changes
  - typecheck/lint/build all pass

---

Files to Create:
  supabase/migrations/YYYYMMDD_cleanup_stale_entitlements.sql
  features/super-admin/actions/entitlement-sync-actions.ts
  features/super-admin/services/feature-audit-service.ts
  features/super-admin/components/feature-audit-view.tsx
  features/entitlement/feature-key-validator.ts
  app/(super-admin)/super-admin/feature-audit/page.tsx
  app/(super-admin)/super-admin/feature-audit/integrity/page.tsx (or combine)

Files to Modify:
  features/super-admin/lib/super-admin-modules.tsx (add Feature Audit sidebar entry)
  app/(super-admin)/super-admin/layout.tsx (no changes — dynamic [module] routing may already handle it)

Supabase parallel patterns (use throughout):
  // Health report: fetch all orgs + subscriptions + stale checks in parallel
  const [orgsRes, subsRes, staleFeatures] = await Promise.all([
    supabase.from("organizations").select("id, name").order("name"),
    supabase.from("organization_subscriptions").select("organization_id, status, package_id")
      .in("status", ["active", "trial"]),
    supabase.rpc("get_stale_entitlement_orgs"),  // custom function if needed
  ]);

  // Audit report: fetch all packages + features + limits in parallel
  const [packagesRes, allFeatures, allLimits] = await Promise.all([
    supabase.from("packages").select("id, name, slug").eq("is_active", true).order("sort_order"),
    supabase.from("package_features").select("package_id, feature_code, value")
      .in("package_id", packageIds),
    supabase.from("package_limits").select("package_id, limit_code, value")
      .in("package_id", packageIds),
  ]);
  // Then cross-reference with in-memory app data (FEATURE_KEYS, MODULE_FEATURE_MAP, etc.)

  // Batch sync: process orgs in parallel batches of 10
  const batchResults = await Promise.allSettled(
    batch.map(org => Promise.all([
      syncOrganizationEntitlements(org.organization_id, "Manual bulk sync"),
      syncOrganizationUsageLimits(org.organization_id, "Manual bulk sync"),
    ]))
  );

Key design decisions:
  - Audit page is Super Admin only — no Org Owner access, no feature gate.
  - FEATURE_IMPLEMENTATION_MAP is manually maintained (one-time creation, updated
    when new features are built). This is the canonical reference for "what exists."
  - Integrity checks run at build time or on-demand. Not automatic on every request
    (performance).
  - Stale entitlement cleanup is a migration + manual Super Admin action, not a
    cron job (to avoid accidental data loss during debugging).
  - All sync operations are idempotent (upsert-based). Safe to re-run.
  - The audit page helps prevent future drift between package promises and app reality.
