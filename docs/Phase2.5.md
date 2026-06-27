Continue from docs/Phase2.5.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 2.5 — Branch Revenue Split for Organization Owner panel.

What this phase is about:
  The Enterprise plan includes branch_revenue_split — the ability to track and split
  revenue across branches (typically for P&L reporting across multi-branch organizations).
  Currently payments are tracked per organization but there's no per-branch revenue
  attribution or split configuration. The feature key is registered but has zero
  implementation. This phase builds revenue split rules, per-branch revenue reports,
  and integrates into the existing Revenue module. (franchise_fee_management was
  removed in Phase 1.1; all phantom features are now cleaned from the codebase,
  so this phase focuses only on branch revenue splitting.)

Reference: docs/ENTERPRISE_PRODUCTION_PLAN.md Phase 2 Session 10.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

Step 1: Read existing files to understand payment and revenue tracking.
  - features/organization-owner/components/modules/RevenueModule.tsx (props, data display patterns)
  - features/organization-owner/services/revenue-service.ts (how revenue data is fetched/computed)
  - features/organization-owner/services/organization-owner-service.ts (OrganizationOwnerDashboard, revenue fields)
  - features/organization-owner/actions/member-actions.ts (saveMemberAction creates payments)
  - features/memberships/actions/membership-actions.ts (membership payments)
  - types/database.ts (payments table type, branch_metrics table type)
  - supabase/migrations/ (payments table, branch_metrics table structure)

Step 2: Understand current revenue flow.
  Payments are recorded in the payments table with: id, organization_id, gym_id, member_id,
  amount, payment_method, status, etc. The gym_id links a payment to a gym (and gym belongs
  to a branch). The Revenue module aggregates payments across all branches for the org.

  The goal is to add configurable split rules so that when a payment is made at Branch A but
  the member belongs to Branch B, the revenue can be split between them (e.g., 70% to Branch A
  for operations, 30% to Branch B for member ownership).

Step 3: Create revenue_split_rules table migration.
  File: supabase/migrations/YYYYMMDD_create_revenue_split.sql

  Table: revenue_split_rules
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    name text NOT NULL
    source_branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE
    target_branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE
    split_percentage numeric(5,2) NOT NULL CHECK (split_percentage >= 0 AND split_percentage <= 100)
    description text
    is_active boolean DEFAULT true
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()

  Indexes: on organization_id, on (source_branch_id, target_branch_id).
  Enable RLS.

  Table: revenue_split_logs (audit table)
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    payment_id uuid REFERENCES payments(id) ON DELETE SET NULL
    source_branch_id uuid REFERENCES branches(id) ON DELETE SET NULL
    target_branch_id uuid REFERENCES branches(id) ON DELETE SET NULL
    original_amount integer NOT NULL
    split_amount integer NOT NULL
    split_percentage numeric(5,2) NOT NULL
    rule_id uuid REFERENCES revenue_split_rules(id) ON DELETE SET NULL
    created_at timestamptz DEFAULT now()

  Index on organization_id.
  Enable RLS.

Step 4: Create revenue split server actions.
  File: features/organization-owner/actions/revenue-split-actions.ts
  Mark as "use server".

  Export:
  - getSplitRules(organizationId) → SplitRule[]
    Gate: requireOrgFeatureAccess(organizationId, "branch_revenue_split")

  - createSplitRule(organizationId, data: { name, sourceBranchId, targetBranchId, splitPercentage, description? })
    Returns SplitRule
    Gate: requireOrgFeatureAccess(organizationId, "branch_revenue_split")
    Validation: percentage 0-100, source != target, branches belong to org.

  - updateSplitRule(organizationId, ruleId, data)
    Returns SplitRule
    Gate: requireOrgFeatureAccess(organizationId, "branch_revenue_split")

  - deleteSplitRule(organizationId, ruleId) → void
    Gate: requireOrgFeatureAccess(organizationId, "branch_revenue_split")

  - getSplitLogs(organizationId, filters?: { branchId?, dateFrom?, dateTo?, page?, pageSize? })
    Returns { logs: SplitLog[]; total: number; summary: { totalOriginal: number; totalSplit: number } }
    Gate: requireOrgFeatureAccess(organizationId, "branch_revenue_split")

  - getBranchRevenueReport(organizationId, dateFrom?, dateTo?)
    Returns per-branch revenue breakdown with splits:
      { branchId, branchName, directRevenue, splitIn (revenue received from other branches),
        splitOut (revenue given to other branches), netRevenue, memberCount, attendanceCount }
    Gate: requireOrgFeatureAccess(organizationId, "branch_revenue_split")

  Import: requireOrgFeatureAccess from @/features/entitlement.
  Import: createSupabaseServerClient from @/lib/supabase/server.

Step 5: Create revenue split UI component.
  File: features/organization-owner/components/modules/RevenueSplitPanel.tsx
  "use client" component, rendered as a sub-tab in the Revenue module.

  Props: { dashboard: OrganizationOwnerDashboard; hasFeature: boolean }

  Layout — Rules Tab:
  - Summary: Total rules, total branches with splits
  - "Add Split Rule" button → opens drawer:
    - Rule name input
    - Source branch selector (dropdown of org's branches)
    - Target branch selector (dropdown, excludes selected source)
    - Split percentage slider or number input (0-100%)
    - Description textarea
    - Preview: "X% of payments at [source] will be attributed to [target]"
  - Data table: Rule Name, Source Branch, Target Branch, Split %, Status, Actions (Edit, Delete)
  - Toggle to activate/deactivate rules

  Layout — Reports Tab:
  - Date range picker
  - Summary stat cards per branch: Net Revenue, Split In, Split Out, Direct Revenue
  - Grouped bar chart: each branch showing direct vs split in vs split out (Recharts)
  - Data table: Branch Name, Direct Revenue, + Split In, - Split Out, = Net Revenue
  - Net Revenue column highlighted

  Layout — Logs Tab:
  - Date range filter, branch filter
  - Data table: Date, Payment ID, Source Branch, Target Branch, Original Amount,
    Split Amount, Split %
  - CSV export

Step 6: Apply split rules when payments are recorded.
  File: features/organization-owner/actions/revenue-split-actions.ts (same file)

  Export:
  - applySplitRules(organizationId, paymentId, paymentAmount, gymId)
    Called internally after every payment is recorded.
    Logic:
    1. Resolve gym_id to branch_id
    2. Query active split rules where source_branch_id = branch_id
    3. For each matching rule, calculate split_amount = paymentAmount * (split_percentage / 100)
    4. Create revenue_split_logs entries
    5. Return void (fire-and-forget, don't block payment processing)

  This is called from member-actions.ts and membership-actions.ts after payment creation.

Step 7: Hook into existing payment flow.
  File: features/organization-owner/actions/member-actions.ts
  After a payment insert (in saveMemberAction or related payment actions), call applySplitRules.
  Wrap in try/catch — split rule failure should not block the payment.
  Only call if org has branch_revenue_split feature (check via hasFeatureAccess or skip silently).

  File: features/memberships/actions/membership-actions.ts
  Same pattern — after any payment creation, call applySplitRules.

Step 8: Integrate into Revenue module.
  File: features/organization-owner/components/modules/RevenueModule.tsx

  Add a sub-tab: "Revenue Split" — RevenueSplitPanel
  Gated: only show if org has branch_revenue_split feature.
  Use useHasFeature("branch_revenue_split") from the entitlement provider.

  Existing tabs in RevenueModule (check current structure):
  - "Overview" / "Revenue" — existing revenue dashboard
  - "Revenue Split" — new tab (gated)

Step 9: Validation.
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Verification checklist:
  Split Rules:
  - Revenue module shows "Revenue Split" sub-tab for Enterprise plan
  - "Revenue Split" hidden for Growth and Starter plans
  - Create split rule with source, target, and percentage
  - Rule list shows all rules with correct data
  - Edit rule updates config
  - Delete rule removes it
  - Activate/deactivate toggle works
  Split Application:
  - Create a payment at a branch with an active split rule
  - Split log entry created with correct calculated amount
  - Payment succeeds even if split rule processing fails (try/catch)
  - Split percentage correctly applied (e.g., 30% of 1000 = 300)
  Reports:
  - Branch revenue report shows direct + split in - split out = net
  - Bar chart renders with correct data
  - Date range filter works
  - CSV export of split logs downloads correctly
  Edge Cases:
  - 0% split: no log created
  - 100% split: full amount moved to target branch
  - Multiple rules for same source → each applied independently
  - Source = target: validation prevents this
  - Branch with no rules: all revenue stays direct
  General:
  - All actions gated via requireOrgFeatureAccess (no hardcoded plan checks)
  - typecheck/lint/build all pass
  - Existing revenue display still works (no regression)

---

Files to Create:
  supabase/migrations/YYYYMMDD_create_revenue_split.sql
  features/organization-owner/actions/revenue-split-actions.ts
  features/organization-owner/components/modules/RevenueSplitPanel.tsx

Files to Modify:
  features/organization-owner/components/modules/RevenueModule.tsx (add "Revenue Split" tab)
  features/organization-owner/actions/member-actions.ts (call applySplitRules after payment)
  features/memberships/actions/membership-actions.ts (call applySplitRules after payment)

Key design decisions:
  - Revenue split is a sub-tab of Revenue module, not a separate sidebar module.
  - Split rules are directional: source_branch → target_branch with a percentage.
  - Splits are logged in revenue_split_logs for audit trail.
  - Payments are NOT modified (the original amount stays on the original gym/branch).
    Splits are purely for reporting — they show where revenue is attributed, not where
    money actually goes.
  - Multiple rules can apply to one payment (if multiple target branches configured).
  - All amounts stored in paise (integers), displayed via formatCurrency.
  - All server actions gated with requireOrgFeatureAccess(orgId, "branch_revenue_split").
