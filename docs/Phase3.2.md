Continue from docs/Phase3.2.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 3.2 — Network-Wide Class Calendar + Trainer Sharing Across Branches for Organization Owner panel.

Short overview:
  Currently classes are viewed per gym and trainers belong to a single gym. The Enterprise
  plan includes two features that unlock multi-branch operations: network_wide_class_calendar
  (a unified calendar view showing all classes across all branches in one place) and
  trainer_sharing_across_branches (assign trainers to multiple branches with conflict
  prevention when scheduling classes across those branches). The calendar is a UI-only
  aggregation — all class data already exists in class_sessions. Trainer sharing needs
  a junction table and modifications to the trainer save/schedule flows.

  Supabase: https://bobqiyhljubfrzmhqnqq.supabase.co (see .env.local for keys)
  Run all independent DB reads in Promise.all for parallel execution.

Reference: docs/ENTERPRISE_PRODUCTION_PLAN.md Phase 3 Session 13.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

PART A: Network-Wide Class Calendar

Step 1: Read existing files to understand class data fetching.
  - features/organization-owner/components/modules/ClassesModule.tsx (classes tab with KPIs + table)
  - features/organization-owner/services/module-data-resolver.ts (how class_sessions are loaded)
  - features/organization-owner/services/organization-owner-service.ts (dashboard.classSessions)
  - features/classes/actions/class-actions.ts (class session queries)
  - types/database.ts (class_sessions table type — has gym_id, session_date, starts_at, ends_at)
  - features/entitlement/feature-registry.ts (network_wide_class_calendar in FEATURE_KEYS)

Step 2: No migration needed for the calendar.
  All class session data already includes gym_id. The calendar is just a query that fetches
  sessions from ALL gyms in the org instead of filtering by a single gym. No new tables.

Step 3: Create the network-wide calendar component.
  File: features/organization-owner/components/modules/NetworkClassCalendar.tsx
  "use client" component, rendered as a new tab in the Classes module.

  Props: { dashboard: OrganizationOwnerDashboard; hasFeature: boolean }

  Layout:
  - If !hasFeature: show locked state
  - Month/week/day view toggle at top
  - Month view: grid calendar showing class dots per day. Click a day → list of classes.
  - Class dots color-coded by gym (one color per gym from a palette)
  - Gym filter checkboxes (multi-select: show/hide specific gyms)
  - Class type filter (dropdown)
  - Hover on a class: tooltip showing class name, gym name, trainer, time, capacity
  - Click a class: opens drawer/sidebar with full details (same as ClassesModule detail panel)
  - "Today" button to jump to current date
  - Previous/next month navigation arrows
  - Legend at bottom: gym name → color dot mapping

  Implementation approach:
  - Fetch class_sessions via server action: getNetworkCalendar(organizationId, month, year)
    Returns sessions grouped by date with gym name and color.
  - Gate: requireOrgFeatureAccess(organizationId, "network_wide_class_calendar")
  - Build a simple calendar grid in React (7 columns, 5-6 rows per month).
    No external calendar library needed — a pure Tailwind grid works fine.

  Server action: features/organization-owner/actions/class-calendar-actions.ts
  "use server"
  Export:
  - getNetworkCalendar(organizationId, year, month)
    Returns { gyms: { id, name, color }[]; sessions: CalendarSession[] }
    CalendarSession = { id, gym_id, class_name, trainer_name, session_date, starts_at, ends_at, capacity, booked_count, status }
    Gate: requireOrgFeatureAccess(organizationId, "network_wide_class_calendar")

    Query (parallel Supabase calls in Promise.all):
      const [gymsResult, sessionsResult] = await Promise.all([
        supabase.from("gyms").select("id, name").eq("organization_id", orgId).order("name"),
        supabase.from("class_sessions")
          .select("id, gym_id, class_id, session_date, starts_at, ends_at, capacity, booked_count, status, classes!inner(name), primary_trainer_id")
          .in("gym_id", gymIds)  // or .eq("organization_id" if gyms table has org_id
          .gte("session_date", `${year}-${month}-01`)
          .lt("session_date", nextMonth)
          .order("session_date"),
      ]);
      // Then fetch trainer names in a second parallel batch using the trainer_ids.

  Use Promise.all for INDEPENDENT queries only. Sequential queries for dependent data.

Step 4: Integrate calendar into Classes module.
  File: features/organization-owner/components/modules/ClassesModule.tsx

  Add a new tab to the existing tab bar:
  Tab: "Network Calendar" — NetworkClassCalendar
  Gated: only show if org has network_wide_class_calendar feature.
  Use: const hasFeature = useHasFeature("network_wide_class_calendar");

  Import NetworkClassCalendar.

---

PART B: Trainer Sharing Across Branches

Step 5: Read existing trainer data model.
  - features/organization-owner/actions/trainer-actions.ts (saveTrainerAction — single gym_id)
  - types/database.ts (trainers table — has gym_id column)
  - features/classes/actions/class-actions.ts (trainer conflict check — line 304-312, 
    hasScheduleConflict checks trainer_id against existing sessions in same gym)
  - features/classes/lib/business-rules.ts (hasScheduleConflict function)

Step 6: Understand current trainer-gym relationship.
  The trainers table has: id, gym_id, display_name, email, phone, employee_code, etc.
  Each trainer belongs to exactly ONE gym. The gym_id is a single FK.

  To enable trainer sharing: add a junction table trainer_gym_assignments that allows
  a trainer to be assigned to multiple gyms. The original gym_id on the trainers table
  becomes the "primary" gym. The junction table adds secondary gym assignments.

Step 7: Create trainer_gym_assignments migration.
  File: supabase/migrations/YYYYMMDD_trainer_sharing_across_branches.sql

  Table: trainer_gym_assignments
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    trainer_id uuid NOT NULL REFERENCES trainers(id) ON DELETE CASCADE
    gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    is_primary boolean DEFAULT false
    assigned_at timestamptz DEFAULT now()
    UNIQUE (trainer_id, gym_id)

  Indexes: on trainer_id, on gym_id, on organization_id.
  Enable RLS.

Step 8: Create trainer sharing server actions.
  File: features/organization-owner/actions/trainer-sharing-actions.ts
  Mark as "use server".

  Export:
  - getTrainerGymAssignments(organizationId, trainerId)
    Returns { gym_id, gym_name, is_primary }[]
    Gate: requireOrgFeatureAccess(organizationId, "trainer_sharing_across_branches")

  - assignTrainerToGym(organizationId, trainerId, gymId)
    Gate: requireOrgFeatureAccess(organizationId, "trainer_sharing_across_branches")
    Validation: gym belongs to org, trainer primary gym is set.

  - removeTrainerFromGym(organizationId, trainerId, gymId)
    Gate: requireOrgFeatureAccess(organizationId, "trainer_sharing_across_branches")
    Cannot remove the primary gym assignment.

  - getAllTrainersWithGyms(organizationId)
    Returns trainers[] with their gym_assignments array (for the calendar to resolve
    which gyms a trainer can teach at).
    Gate: no feature gate needed (general org query).

  Parallel DB pattern example:
    const [trainer, assignments, conflictCheck] = await Promise.all([
      supabase.from("trainers").select("*").eq("id", trainerId).single(),
      supabase.from("trainer_gym_assignments").select("*, gyms!inner(name)").eq("trainer_id", trainerId),
      supabase.from("class_sessions").select("id").eq("primary_trainer_id", trainerId)
        .gte("session_date", today).in("status", ["scheduled", "in_progress"]),
    ]);

Step 9: Update saveTrainerAction to support multi-gym assignment.
  File: features/organization-owner/actions/trainer-actions.ts

  In saveTrainerAction:
  - After creating/updating the trainer with gym_id as primary
  - If additional gym IDs are provided and org has trainer_sharing_across_branches:
    - Fetch existing assignments
    - Insert new assignments not already present
    - Optionally remove unchecked assignments
  - Accept param: additionalGymIds: string[] from formData
  - Gate the multi-gym logic: only if hasFeatureAccess(orgId, "trainer_sharing_across_branches")

Step 10: Update the trainer form to support multi-gym selection.
  File: features/organization-owner/components/modules/TrainersModule.tsx

  In the trainer create/edit drawer:
  - Below the existing "Gym" select (primary gym), add a multi-select for "Additional Gyms"
  - Only show if org has trainer_sharing_across_branches feature
  - Use checkboxes or a multi-select component
  - Exclude the primary gym from the additional gyms list
  - Pass selected additional gym IDs to saveTrainerAction as formData

Step 11: Update conflict prevention for cross-gym scheduling.
  File: features/classes/lib/business-rules.ts

  The hasScheduleConflict function currently checks:
    trainerId + sessionDate + time overlap for existing sessions.

  With trainer sharing, the trainer may be scheduled at ANY of their assigned gyms.
  The conflict check needs to query across all the trainer's gyms, not just one.

  Update hasScheduleConflict to:
  - Accept trainerAssignedGyms: string[] (all gym IDs the trainer is assigned to)
  - Query class_sessions WHERE primary_trainer_id = trainerId AND gym_id IN (trainerAssignedGyms)
    AND session_date = date AND time overlaps
  - This catches conflicts across all branches the trainer serves

  File: features/classes/actions/class-actions.ts
  In the schedule generation flow (around line 300-312), before creating sessions:
  - Fetch the trainer's assigned gyms via trainer-sharing-actions
  - Pass all gyms to hasScheduleConflict
  - If the trainer is assigned to the session's gym (primary or secondary), allow scheduling

Step 12: Add trainer sharing indicator in TrainersModule.
  File: features/organization-owner/components/modules/TrainersModule.tsx

  In the trainer list table:
  - Add a column or badge showing "X gyms" (number of assigned gyms)
  - Clicking shows the list of gyms the trainer is assigned to
  - Primary gym has a "Primary" badge

  In the trainer detail view (if it exists):
  - Show all assigned gyms with primary indicator
  - "Assign to Gym" button to add more

  Gated: only show if org has trainer_sharing_across_branches feature.

Step 13: Validation.
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Verification checklist — Calendar:
  - Classes module shows "Network Calendar" tab for Enterprise plan
  - Calendar tab hidden for Growth and Starter plans
  - Month view renders grid with class dots
  - Class dots color-coded by gym
  - Gym filter checkboxes show/hide gyms correctly
  - Clicking a day shows list of classes for that day
  - Previous/next month navigation works
  - "Today" button jumps to current date
  - Tooltip shows class details on hover
  - Empty days show no dots (clean grid)
  Verification checklist — Trainer Sharing:
  - Trainer create/edit form shows "Additional Gyms" multi-select
  - Multi-select hidden for plans without trainer_sharing_across_branches
  - Trainer assigned to Gym A and B appears in both gyms' trainer lists
  - Cannot remove primary gym assignment
  - Trainer list shows "X gyms" count per trainer
  - Schedule conflict check spans all assigned gyms
  - Trainer booked at Gym A is blocked from overlapping time at Gym B
  - Trainer assigned to Gym C can teach at Gym C without conflicts from Gym A bookings
  - Removing trainer from secondary gym doesn't affect primary gym
  Edge Cases:
  - Empty calendar month shows empty grid
  - Trainer with zero additional gyms: no badge shown
  - Deleting a trainer cascades to trainer_gym_assignments (ON DELETE CASCADE)
  - Gym filter: all gyms unchecked = empty calendar
  General:
  - All actions gated via requireOrgFeatureAccess (no hardcoded plan checks)
  - Existing single-gym trainer flow still works — no regression
  - typecheck/lint/build all pass

---

Files to Create:
  supabase/migrations/YYYYMMDD_trainer_sharing_across_branches.sql
  features/organization-owner/actions/class-calendar-actions.ts
  features/organization-owner/actions/trainer-sharing-actions.ts
  features/organization-owner/components/modules/NetworkClassCalendar.tsx

Files to Modify:
  features/organization-owner/components/modules/ClassesModule.tsx (add Network Calendar tab)
  features/organization-owner/actions/trainer-actions.ts (support additional gym IDs in save)
  features/organization-owner/components/modules/TrainersModule.tsx (multi-gym select in form, gym count column)
  features/classes/lib/business-rules.ts (hasScheduleConflict cross-gym awareness)
  features/classes/actions/class-actions.ts (pass trainer assigned gyms to conflict check)

Supabase parallel operation patterns (use throughout):
  // Fetch trainer + assignments + conflicts all at once
  const [trainerRes, assignmentRes, conflictRes] = await Promise.all([
    supabase.from("trainers").select("*").eq("id", trainerId).single(),
    supabase.from("trainer_gym_assignments").select("gym_id").eq("trainer_id", trainerId),
    supabase.from("class_sessions").select("id, session_date, starts_at, ends_at")
      .eq("primary_trainer_id", trainerId)
      .gte("session_date", today)
      .in("status", ["scheduled", "in_progress"]),
  ]);

  // Fetch calendar: gyms + sessions in parallel
  const [gymsRes, sessionsRes] = await Promise.all([
    supabase.from("gyms").select("id, name").eq("organization_id", orgId).order("name"),
    supabase.from("class_sessions").select("id, gym_id, session_date, starts_at, ends_at, capacity, booked_count, status, classes!inner(name)")
      .in("gym_id", gymIds)
      .gte("session_date", monthStart)
      .lt("session_date", nextMonthStart)
      .order("session_date").order("starts_at"),
  ]);
  // Then resolve trainer names in a second batch if needed.

Key design decisions:
  - Calendar: UI-only aggregation. No new DB tables. Pure client-side rendering from server data.
  - Trainer sharing: junction table approach (trainer_gym_assignments) rather than modifying
    the existing gym_id column. This preserves backward compatibility — gym_id remains "primary gym."
  - Conflict prevention: hasScheduleConflict now accepts an array of gym IDs to check across.
    This is the single most important logic change — prevents double-booking across branches.
  - Calendar color coding: derive colors from a fixed palette based on gym index. No color column needed.
  - All server actions gated with requireOrgFeatureAccess using the correct feature key.
