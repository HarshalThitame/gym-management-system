Continue from docs/Phase3.1.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 3.1 — Cross-Branch Class Booking for Organization Owner panel.

Short overview:
  Currently the bookClassAction (class-actions.ts line 362) blocks members from booking
  classes at any gym other than their home gym: "Member cannot book classes outside their gym."
  The Enterprise plan includes cross_branch_class_booking — members should be able to book
  and attend classes at any branch in the organization. This phase modifies the class booking
  flow to check if the org has the feature, and if so, skips the gym-scope block. The existing
  capacity tracking, waitlist, conflict checks, and attendance all work across gyms natively.
  No new DB tables needed — this is a pure feature-gate modification on the booking flow.

  Supabase: https://bobqiyhljubfrzmhqnqq.supabase.co (see .env.local for keys)
  Run DB migrations in parallel where possible (use multiple Supabase calls in Promise.all).

Reference: docs/ENTERPRISE_PRODUCTION_PLAN.md Phase 3 Session 12.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

Step 1: Read existing files to understand the class booking flow.
  - features/classes/actions/class-actions.ts
    - bookClassAction (line 341): the main booking function
    - Line 362: `if (bundle.session.gym_id !== member.gym_id)` — THIS is the block to modify
    - cancelClassBookingAction (line 453): cancellation with gym-scope check for staff
    - getSessionBundle: fetches session + class details
    - getBookingMember: resolves member from context or memberId param
  - features/classes/schemas/classes.ts (BookClassSchema, class table types)
  - features/classes/services/class-service.ts (getActiveMembershipForMember, other helpers)
  - features/classes/lib/business-rules.ts (capacity, conflict, eligibility checks)
  - features/organization-owner/components/modules/ClassesModule.tsx (Org Owner classes view)
  - features/entitlement/feature-registry.ts (cross_branch_class_booking in FEATURE_KEYS)
  - features/attendance/actions/attendance-actions.ts (Phase 2.6 cross-branch pattern — same idea)

Step 2: No migration needed.
  This phase requires ZERO database changes. The feature is a boolean gate — either the org
  allows cross-branch booking or it doesn't. All existing tables (class_sessions, class_bookings,
  class_waitlists) already support cross-gym operations. The only change is removing the
  gym-scope block in bookClassAction when the feature is enabled.

Step 3: Modify bookClassAction to support cross-branch booking.
  File: features/classes/actions/class-actions.ts

  Current code at line 362:
    if (bundle.session.gym_id !== member.gym_id) {
      return { status: "error", message: "Member cannot book classes outside their gym." };
    }

  Replace with cross-branch aware check:

    if (bundle.session.gym_id !== member.gym_id) {
      const orgId = getContextOrganizationId(context);
      if (orgId) {
        const hasCrossBranch = await hasFeatureAccess(orgId, "cross_branch_class_booking");
        if (!hasCrossBranch) {
          return { status: "error", message: "Member cannot book classes outside their gym." };
        }
        // Feature enabled — allow cross-branch booking. Fall through to continue booking.
      } else {
        return { status: "error", message: "Member cannot book classes outside their gym." };
      }
    }

  Import hasFeatureAccess from @/features/entitlement at the top:
    import { hasFeatureAccess } from "@/features/entitlement";

  Note: hasFeatureAccess is silent (returns boolean, doesn't throw). If it fails or returns
  false, we fall back to the original blocking behavior — safe default.

Step 4: Also update cancelClassBookingAction for cross-branch awareness.
  File: features/classes/actions/class-actions.ts

  At line 476, the cancellation flow has a staff-scope check:
    if (isStaff && getContextGymId(context) && booking.gym_id !== getContextGymId(context)) {
      return { status: "error", message: "Booking does not belong to this gym." };
    }

  This is correct for single-gym staff. No change needed — staff can only manage their own
  gym's bookings. But for organization_owner role, they should be able to cancel any booking
  across branches. The current check only fires for staff roles with a contextGymId.
  Verify that organization_owner is not blocked (they typically have no contextGymId).

Step 5: Update class attendance tracking for cross-branch awareness.
  File: features/classes/actions/class-actions.ts

  Find the markClassAttendance function (if it exists — search for "attendance" in the file).
  When marking attendance, the current code likely checks gym scope for the member.
  If the member booked cross-branch, their gym_id won't match the class session gym_id.
  This needs to be handled — skip the gym check if the booking exists and the org has
  cross_branch_class_booking.

  Search for: markClassAttendance, class_attendance, or similar function.
  If this function is in a different file, read:
    features/classes/services/class-service.ts
    features/attendance/actions/attendance-actions.ts (the processCheckIn may handle
    class attendance via attendance_sessions)

  The processCheckIn in attendance-actions.ts already handles cross-branch access
  (Phase 2.6 modification). If class attendance goes through attendance_sessions,
  it's already covered. If there's a separate class_attendance table/flow, modify
  that to skip gym check for cross-branch bookings.

Step 6: Add cross-branch booking indicator in Org Owner ClassesModule.
  File: features/organization-owner/components/modules/ClassesModule.tsx

  Add a section or badge showing cross-branch booking activity:
  - In the class session detail view, show "Cross-branch bookings: X" count
  - In the session list, add an icon/badge for sessions with bookings from other gyms
  - Optional: add a filter "Show cross-branch sessions only"

  Use the entitlement provider: const hasFeature = useHasFeature("cross_branch_class_booking");
  Only show cross-branch indicators if feature is enabled.

Step 7: Add cross-branch count to class booking query.
  File: features/organization-owner/services/module-data-resolver.ts

  In the classes resolver case, when fetching class_sessions, also fetch a cross-branch
  booking count per session:
    SELECT session_id, COUNT(*) as cross_branch_count
    FROM class_bookings cb
    JOIN members m ON m.id = cb.member_id
    WHERE cb.session_id IN (session_ids)
    AND m.gym_id != cb.gym_id
    GROUP BY session_id

  This gives the ClassesModule the data it needs for the cross-branch indicator.

Step 8: Validation.
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Verification checklist:
  Booking:
  - Member from Gym A books a class at Gym B → SUCCESS (feature enabled)
  - Member from Gym A books a class at Gym B → BLOCKED "outside their gym" (feature disabled)
  - Member from Gym A books a class at Gym A → SUCCESS (same gym, always allowed)
  - Starter plan orgs: cross-branch booking blocked (feature not in plan)
  - Growth plan orgs: cross-branch booking blocked (feature not in plan)
  - Waitlist works cross-branch (member joins waitlist at other gym)
  Cancellation:
  - Member cancels own cross-branch booking → SUCCESS
  - Gym admin at Gym B cancels cross-branch booking at their gym → SUCCESS
  - Gym admin at Gym A cannot cancel booking at Gym B → blocked (by gym scope)
  - Org Owner cancels any booking anywhere → SUCCESS
  Attendance:
  - Class attendance marked for cross-branch member → SUCCESS
  - Attendance flow doesn't block on wrong gym for cross-branch bookings
  UI:
  - ClassesModule shows cross-branch booking counts (if feature enabled)
  - No cross-branch indicators shown for plans without the feature
  Edge Cases:
  - Class at capacity: cross-branch member joins waitlist correctly
  - Class cancelled: all bookings (including cross-branch) get notified
  - Member with no gym_id: handled by existing validation
  - Session from deleted gym: handled by existing validation
  General:
  - No hardcoded plan checks — all gated via hasFeatureAccess
  - typecheck/lint/build all pass
  - Existing same-gym booking still works — no regression

---

Files to Modify:
  features/classes/actions/class-actions.ts (modify bookClassAction gym-scope block at line 362)
  features/organization-owner/services/module-data-resolver.ts (add cross-branch count per session)
  features/organization-owner/components/modules/ClassesModule.tsx (add cross-branch indicators)

Files to Create:
  None. ZERO new files. This is a pure flow modification on existing code.

Supabase parallel operations pattern:
  When running DB queries in this file, batch independent reads into Promise.all:

    const [result1, result2, result3] = await Promise.all([
      supabase.from("table1").select("*").eq("org_id", orgId),
      supabase.from("table2").select("*").eq("org_id", orgId),
      supabase.from("table3").select("*").eq("org_id", orgId),
    ]);

  This is the existing pattern used throughout class-actions.ts.

Key design decisions:
  - ZERO new database tables. cross_branch_class_booking is a boolean feature flag.
  - The modification is MINIMAL — only one if-block in bookClassAction changes.
  - hasFeatureAccess is silent (returns boolean). If it fails, we block — safe default.
  - Cross-branch booking uses the same capacity/conflict/waitlist logic. No changes needed
    because these checks are session-scoped, not gym-scoped.
  - Attendance flows through the existing attendance_sessions table, which Phase 2.6
    already made cross-branch-aware.
  - Staff gym-scope for cancellation is preserved — only org_owner can cancel across branches.
