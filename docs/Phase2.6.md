Continue from docs/Phase2.6.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 2.6 — Cross-Branch Member Access for Organization Owner panel.

What this phase is about:
  Currently the attendance check-in flow in processCheckIn blocks members from checking
  in at gyms they don't belong to (line 492 of attendance-actions.ts: "Member does not
  belong to this gym"). The Enterprise plan promises cross_branch_member_access — the
  ability for members to check in at any branch in the organization. This phase builds
  configurable access rules that override the gym-scope check, creates a management UI
  for Org Owners to set per-member or org-wide cross-branch rules, and logs all
  cross-branch access events. Gated through the entitlement pipeline.

Reference: docs/ENTERPRISE_PRODUCTION_PLAN.md Phase 2 Session 11.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

Step 1: Read existing files to understand the check-in flow.
  - features/attendance/actions/attendance-actions.ts (processCheckIn function at line 469,
    validateMemberAccess at line 680, requireAttendanceFeatures at line 658, the gym-scope
    block at line 492, resolveAttendanceBranchScope at line 507)
  - features/attendance/lib/business-rules.ts (validateMembershipForAccess, branch logic)
  - features/attendance/services/attendance-service.ts (getActiveMembershipForMember)
  - features/organization-owner/components/modules/GymsModule.tsx (Branches module pattern)
  - types/database.ts (members table, branches table, attendance_sessions)

Step 2: Understand the current access block.
  In processCheckIn (line 469), after validateMemberAccess:
    ```ts
    if (contextGymId && validation.member.gym_id !== contextGymId) {
      // BLOCK: member doesn't belong to this gym
      return { status: "error", message: "Member does not belong to this gym." };
    }
    ```
  This is the line that cross-branch access needs to override. When the org has the
  cross_branch_member_access feature AND an access rule permits it, this block should
  be bypassed.

Step 3: Create cross_branch_access_rules table migration.
  File: supabase/migrations/YYYYMMDD_create_cross_branch_access.sql

  Table: cross_branch_access_rules
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    name text NOT NULL
    member_id uuid REFERENCES members(id) ON DELETE CASCADE
      -- NULL means "applies to all members" (org-wide rule)
    from_branch_id uuid REFERENCES branches(id) ON DELETE CASCADE
      -- NULL means "any branch" (the branch the member belongs to)
    to_branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE
      -- The branch the member is allowed to access
    is_allowed boolean DEFAULT true
      -- true = allow access, false = explicitly deny
    priority integer DEFAULT 0
      -- Higher priority rules evaluated first. Member-specific overrides org-wide.
    is_active boolean DEFAULT true
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()

  Check constraint: (member_id IS NOT NULL) OR (member_id IS NULL)
    -- Either per-member or org-wide, not both.

  Indexes: on organization_id, on member_id, on (from_branch_id, to_branch_id).
  Enable RLS.

  Table: cross_branch_access_logs (audit)
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE
    attendance_session_id uuid REFERENCES attendance_sessions(id) ON DELETE SET NULL
    from_gym_id uuid REFERENCES gyms(id) ON DELETE SET NULL
    to_gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE SET NULL
    rule_id uuid REFERENCES cross_branch_access_rules(id) ON DELETE SET NULL
    decision text NOT NULL CHECK (decision IN ('allowed', 'denied'))
    reason text
    created_at timestamptz DEFAULT now()

  Index: on organization_id, on member_id, on created_at.
  Enable RLS.

Step 4: Create the access rule evaluation engine.
  File: features/organization-owner/actions/cross-branch-actions.ts
  Mark as "use server".

  Export:
  -- Rule management --
  - getAccessRules(organizationId) → AccessRule[]
    Gate: requireOrgFeatureAccess(organizationId, "cross_branch_member_access")

  - createAccessRule(organizationId, data: { name, memberId?, fromBranchId?, toBranchId, isAllowed, priority? })
    Returns AccessRule
    Gate: requireOrgFeatureAccess(organizationId, "cross_branch_member_access")

  - updateAccessRule(organizationId, ruleId, data)
    Returns AccessRule
    Gate: requireOrgFeatureAccess(organizationId, "cross_branch_member_access")

  - deleteAccessRule(organizationId, ruleId) → void
    Gate: requireOrgFeatureAccess(organizationId, "cross_branch_member_access")

  -- Access evaluation (called by attendance check-in) --
  - evaluateCrossBranchAccess(organizationId, memberId, fromGymId, toGymId, memberBranchId?)
    Returns { allowed: boolean; ruleName?: string; reason?: string }

    Logic (do NOT gate this function — it's called from check-in, not from UI):
    1. Check if org has cross_branch_member_access feature (via hasFeatureAccess, silent)
    2. If not, return { allowed: false, reason: "Feature not enabled" }
    3. Query active rules for this org, ordered by priority DESC
    4. For each rule:
       a. If member_id is set: only applies to that member. If not set: applies to all.
       b. If from_branch_id is set: only applies from that branch. If not: from any branch.
       c. If to_branch_id matches the target gym → check is_allowed
       d. Return first matching rule's decision
    5. If no rules match: return { allowed: false, reason: "No access rule matches" }

  -- Access logs --
  - getAccessLogs(organizationId, filters?: { memberId?, gymId?, decision?, dateFrom?, dateTo?, page?, pageSize? })
    Returns { logs: AccessLog[]; total: number }
    Gate: requireOrgFeatureAccess(organizationId, "cross_branch_member_access")

  Import: requireOrgFeatureAccess, hasFeatureAccess from @/features/entitlement.
  Import: createSupabaseServerClient from @/lib/supabase/server.

Step 5: Modify the attendance check-in to respect cross-branch rules.
  File: features/attendance/actions/attendance-actions.ts

  In processCheckIn (around line 492), modify the gym-scope block:

  Current code:
    if (contextGymId && validation.member.gym_id !== contextGymId) {
      // Block access
      return { status: "error", message: "Member does not belong to this gym." };
    }

  Replace with:
    if (contextGymId && validation.member.gym_id !== contextGymId) {
      // Check cross-branch access rules
      const orgId = input.context.organizationId;
      if (orgId) {
        const access = await evaluateCrossBranchAccess(
          orgId,
          input.memberId,
          validation.member.gym_id!,  // from (member's home gym)
          contextGymId,                // to (check-in gym)
          validation.member.branch_id
        );
        if (access.allowed) {
          // Log the cross-branch access
          await supabase.from("cross_branch_access_logs").insert({
            organization_id: orgId,
            member_id: input.memberId,
            from_gym_id: validation.member.gym_id,
            to_gym_id: contextGymId,
            rule_id: access.ruleId ?? null,
            decision: "allowed",
            reason: access.ruleName ?? "Cross-branch access rule"
          });
          // Allow the check-in to proceed — skip the block
        } else {
          // Log the denial
          await supabase.from("cross_branch_access_logs").insert({
            organization_id: orgId,
            member_id: input.memberId,
            from_gym_id: validation.member.gym_id,
            to_gym_id: contextGymId,
            decision: "denied",
            reason: access.reason ?? "No cross-branch access rule"
          });
          await recordDeniedAccess(supabase, input.context, {
            ...validation,
            allowed: false,
            reasonCode: "cross_branch_denied",
            message: "Cross-branch access not permitted for this member."
          }, { gymId: contextGymId, ... });
          return { status: "error", message: "Cross-branch access not permitted." };
        }
      } else {
        // No org context — fall back to original block
        await recordDeniedAccess(...);
        return { status: "error", message: "Member does not belong to this gym." };
      }
    }

  Import evaluateCrossBranchAccess from @/features/organization-owner/actions/cross-branch-actions.
  Use a dynamic import or conditional require to avoid circular dependency issues.
  Wrap the import in a try/catch — if the feature module doesn't exist or fails,
  fall back to the original blocking behavior (safe default).

  IMPORTANT: The cross-branch check should only fire when gyms differ AND the org
  has the feature. If the org doesn't have cross_branch_member_access, the original
  blocking behavior is preserved.

Step 6: Create access rules management UI.
  File: features/organization-owner/components/modules/CrossBranchAccessPanel.tsx
  "use client" component, rendered as a sub-tab in the Branches module.

  Props: { dashboard: OrganizationOwnerDashboard; hasFeature: boolean }

  Layout — Rules Tab:
  - Summary stat cards: Total Rules, Org-Wide Rules, Per-Member Rules, Cross-Branch Check-ins Today
  - "Add Rule" button → opens drawer:
    - Rule name input
    - Rule type toggle: "All Members" or "Specific Member"
    - If "Specific Member": member selector dropdown
    - Source branch dropdown (or "Any Branch" option)
    - Target branch dropdown (required)
    - Access: "Allow" or "Deny" toggle
    - Priority number input
    - Preview: "Member X from Branch A can/cannot access Branch B"
  - Data table: Rule Name, Type (Org-wide / Per-member), From, To, Access (Allow/Deny badge),
    Priority, Active toggle, Actions (Edit, Delete)
  - Bulk enable/disable

  Layout — Logs Tab:
  - Date range filter, member filter, gym filter, decision filter
  - Data table: Date/Time, Member Name, From Gym, To Gym, Decision (Allow/Deny badge), Rule, Reason
  - Summary: total cross-branch check-ins in period
  - CSV export

Step 7: Integrate into Branches module.
  File: features/organization-owner/components/modules/GymsModule.tsx

  Add a sub-tab: "Cross-Branch Access" — CrossBranchAccessPanel
  Gated: only show if org has cross_branch_member_access feature.
  Use the entitlement provider pattern: const hasFeature = useHasFeature("cross_branch_member_access");

  Import CrossBranchAccessPanel.

Step 8: Add cross-branch access KPI to dashboard (optional).
  File: features/organization-owner/components/enterprise-dashboard.tsx
  Add an "Cross-Branch Check-ins" stat card showing count of cross-branch accesses today.
  Gate: show only if crossBranchMemberAccess in activeFeatureKeys.

Step 9: Validation.
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Verification checklist:
  Rules:
  - Branches module shows "Cross-Branch Access" sub-tab for Enterprise plan
  - "Cross-Branch Access" hidden for Growth and Starter plans
  - Create org-wide rule (all members from any branch → target branch)
  - Create per-member rule (specific member from branch A → branch B)
  - Edit rule updates correctly
  - Delete rule removes it
  - Active toggle enables/disables rules
  - Priority ordering respected (higher priority evaluated first)
  Check-in:
  - Member from Gym A checks in at Gym B with matching allow rule → SUCCESS
  - Member from Gym A checks in at Gym B with no rule → BLOCKED ("cross-branch access not permitted")
  - Member from Gym A checks in at Gym B with deny rule → BLOCKED
  - Member checks in at their home gym → no cross-branch check, normal flow
  - Org without feature → original blocking behavior preserved (no cross-branch)
  - Cross-branch check-in logged in cross_branch_access_logs
  Logs:
  - Access logs table shows all cross-branch events
  - Allowed entries show green badge, Denied show red
  - Date range and filters work
  - CSV export downloads correctly
  Edge Cases:
  - Member with no gym_id — should be handled gracefully (no cross-branch possible)
  - contextGymId is null (super admin check-in) — skip cross-branch check
  - Deleted rule doesn't affect existing logs
  - Disabled rule treated as if it doesn't exist
  General:
  - All actions gated via requireOrgFeatureAccess (no hardcoded plan checks)
  - Attendance check-in still works for normal (same-gym) flow — no regression
  - typecheck/lint/build all pass

---

Files to Create:
  supabase/migrations/YYYYMMDD_create_cross_branch_access.sql
  features/organization-owner/actions/cross-branch-actions.ts
  features/organization-owner/components/modules/CrossBranchAccessPanel.tsx

Files to Modify:
  features/attendance/actions/attendance-actions.ts (modify processCheckIn gym-scope block)
  features/organization-owner/components/modules/GymsModule.tsx (add "Cross-Branch Access" tab)
  features/organization-owner/components/enterprise-dashboard.tsx (optional KPI card)

Key design decisions:
  - Cross-branch access is a sub-tab of Branches module, not a separate sidebar module.
    It's a branch configuration feature, closely related to branch management.
  - The check-in modification is MINIMAL — only the gym-scope block in processCheckIn
    is extended. All other check-in logic (membership validation, duplicate detection,
    branch scope) remains unchanged.
  - Safe default: if the cross-branch module doesn't exist or fails, fall back to the
    original blocking behavior. Cross-branch is opt-in per org.
  - Rules are evaluated in priority order. First matching rule wins.
  - Per-member rules take precedence over org-wide rules (via priority system).
  - The feature check at check-in time is silent (hasFeatureAccess) — doesn't throw,
    just returns false and falls through to original blocking.
  - Logs are written at check-in time regardless, so the Org Owner can see both
    allowed and denied cross-branch attempts.
