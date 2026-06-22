Continue from docs/Phase2.1.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 2.1 — Staff Attendance & Leave Tracking for Organization Owner panel.

What this phase is about:
  Staff currently appear in the Staff module as user accounts with roles and status,
  but there is no way to track when they clock in/out or manage leave requests.
  The feature key staff_attendance_leave is registered but has zero implementation.
  This phase builds a staff attendance log (clock-in/out) and a leave request system
  (submit, approve, reject) as sub-tabs inside the existing Staff module. All gated
  through the entitlement pipeline — only orgs with staff_attendance_leave get these tabs.

Reference: docs/ENTERPRISE_PRODUCTION_PLAN.md Phase 2 Session 6.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

Step 1: Read existing files to understand the Staff module patterns.
  - features/organization-owner/components/modules/StaffModule.tsx (props, DataList, FilterBar, drawer patterns, toast usage)
  - features/organization-owner/actions/staff-actions.ts (entitlement guard pattern, getOrgOwnerContext, limit checks)
  - features/organization-owner/components/modules/TrainersModule.tsx (if it has sub-tabs, copy that pattern)
  - features/organization-owner/components/org-owner-data-list.tsx (DataList component API)
  - features/organization-owner/components/org-owner-filter-bar.tsx (FilterBar component API)
  - features/organization-owner/components/org-owner-drawer.tsx (Drawer component API for forms)
  - features/entitlement/feature-registry.ts (FEATURE_KEYS - verify staff_attendance_leave exists)
  - supabase/migrations/ (recent migration for create table patterns, RLS patterns)

Step 2: Understand the existing Staff module props and data flow.
  StaffModule receives: { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; moduleFilters?: Record<string, unknown> }
  It uses: DataList for tables, FilterBar for search/filters, OrgOwnerDrawer for create/edit forms.
  It imports server actions directly and uses useActionState for form submissions.
  The module-data-resolver fetches staff data from branch_users joined with profiles.

Step 3: Create the staff_attendance table migration.
  File: supabase/migrations/YYYYMMDD_create_staff_attendance_leave.sql

  Table: staff_attendance
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    staff_id uuid NOT NULL (references branch_users.id or profiles.id)
    branch_id uuid REFERENCES branches(id) ON DELETE SET NULL
    clock_in timestamptz NOT NULL DEFAULT now()
    clock_out timestamptz
    date date GENERATED ALWAYS AS (clock_in::date) STORED
    notes text
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()

  Indexes: on (organization_id, date), on (staff_id, date), on (organization_id, staff_id).
  Enable RLS. Add policy: organization members can read/write their org's attendance.

  Table: staff_leave_requests
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    staff_id uuid NOT NULL
    leave_type text NOT NULL CHECK (leave_type IN ('sick', 'casual', 'annual', 'other'))
    start_date date NOT NULL
    end_date date NOT NULL CHECK (end_date >= start_date)
    reason text
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))
    approver_id uuid
    approved_at timestamptz
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()

  Indexes: on (organization_id, status), on (staff_id).
  Enable RLS. Add policy.

Step 4: Create staff attendance server actions.
  File: features/organization-owner/actions/staff-attendance-actions.ts
  Mark as "use server".

  Export:
  - getStaffAttendance(organizationId, filters: { staffId?, dateFrom?, dateTo?, page?, pageSize? })
    Returns { records: AttendanceRecord[]; total: number }
    Gate: requireOrgFeatureAccess(organizationId, "staff_attendance_leave")
    Joins with profiles for staff name.

  - clockIn(organizationId, staffId, branchId?, notes?)
    Creates attendance record with clock_in = now().
    Returns the record.
    Gate: requireOrgFeatureAccess(organizationId, "staff_attendance_leave")
    Validation: cannot clock in if already clocked in today without clock_out.

  - clockOut(organizationId, attendanceId)
    Updates record with clock_out = now().
    Returns updated record.
    Gate: requireOrgFeatureAccess(organizationId, "staff_attendance_leave")
    Validation: cannot clock out if already clocked out.

  - getMonthlyAttendanceSummary(organizationId, month, year)
    Returns per-staff summary: present days, absent days, late count, avg hours.
    Gate: requireOrgFeatureAccess(organizationId, "staff_attendance_leave")

  Import: requireOrgFeatureAccess from @/features/entitlement.
  Import: createSupabaseServerClient from @/lib/supabase/server.
  Import: getOrgOwnerContext from ./action-utils for org context.

Step 5: Create staff leave server actions.
  File: features/organization-owner/actions/staff-leave-actions.ts
  Mark as "use server".

  Export:
  - getLeaveRequests(organizationId, filters: { staffId?, status?, page?, pageSize? })
    Returns { requests: LeaveRequest[]; total: number }
    Gate: requireOrgFeatureAccess(organizationId, "staff_attendance_leave")

  - createLeaveRequest(organizationId, data: { staffId, leaveType, startDate, endDate, reason? })
    Returns the created leave request.
    Gate: requireOrgFeatureAccess(organizationId, "staff_attendance_leave")
    Validation: no overlapping approved leave for same staff in date range.

  - approveLeaveRequest(organizationId, requestId)
    Updates status to 'approved', sets approver_id and approved_at.
    Returns updated request.
    Gate: requireOrgFeatureAccess(organizationId, "staff_attendance_leave")

  - rejectLeaveRequest(organizationId, requestId, reason?)
    Updates status to 'rejected', sets approver_id.
    Returns updated request.
    Gate: requireOrgFeatureAccess(organizationId, "staff_attendance_leave")

  Import: requireOrgFeatureAccess from @/features/entitlement.

Step 6: Create staff attendance UI component.
  File: features/organization-owner/components/modules/StaffAttendancePanel.tsx
  "use client" component.

  Follow the exact props pattern from StaffModule.tsx:
    type StaffAttendancePanelProps = {
      dashboard: OrganizationOwnerDashboard;
    };

  Layout:
  - Top section: "Today" quick view — list of staff with clock-in status (green dot = in, gray = out)
  - "Clock In" and "Clock Out" buttons for each staff member
  - Filter bar: staff selector dropdown, date range
  - Data table: Staff Name, Date, Clock In time, Clock Out time, Duration (hours), Status
  - Status: "Present" (clocked in+out), "In Progress" (clocked in only), "Missing" (no record)
  - Monthly summary section (collapsible): per-staff present days, absent days, avg hours
  - CSV export of attendance log

  Use the existing UI components: FilterBar, DataList, StatCard, Button.
  Format dates using hydration-safe-date.tsx or toLocaleDateString.

Step 7: Create staff leave UI component.
  File: features/organization-owner/components/modules/StaffLeavePanel.tsx
  "use client" component.

  Props: { dashboard: OrganizationOwnerDashboard }

  Layout:
  - Top: summary stat cards — Pending Requests, Approved This Month, Rejected This Month
  - "New Leave Request" button → opens drawer form:
    - Staff selector dropdown
    - Leave type dropdown (sick, casual, annual, other)
    - Start date picker
    - End date picker
    - Reason textarea
  - Filter bar: status filter (All, Pending, Approved, Rejected), staff filter
  - Data table: Staff Name, Leave Type, Start Date, End Date, Duration (days), Status badge, Reason
  - Status badges: pending=orange, approved=green, rejected=red
  - For pending requests: "Approve" and "Reject" action buttons
  - Approve/reject uses the server actions

Step 8: Integrate sub-tabs into StaffModule.
  File: features/organization-owner/components/modules/StaffModule.tsx

  The StaffModule currently shows the staff list directly. Add a tab bar at the top:
  Tab 1: "Staff" — existing staff list (always visible)
  Tab 2: "Attendance" — StaffAttendancePanel (gated: only if staff_attendance_leave in activeFeatureKeys)
  Tab 3: "Leave" — StaffLeavePanel (gated: only if staff_attendance_leave in activeFeatureKeys)

  But the StaffModule currently doesn't receive activeFeatureKeys as a prop.
  You have two options:
    Option A: Pass activeFeatureKeys from the layout (OrgOwnerLayoutClient provides context).
    Option B: Accept a hasAttendanceFeature boolean prop.
  
  Use Option A — add an activeFeatureKeys prop to StaffModule and pass it from the workspace.
  In organization-owner-workspace.tsx, when rendering StaffModule, pass activeFeatureKeys.

  Tab implementation:
    const [activeTab, setActiveTab] = useState("staff");
    const hasAttendance = activeFeatureKeys?.includes("staff_attendance_leave");
    // Render tab bar, conditionally show Attendance/Leave tabs.

Step 9: Pass activeFeatureKeys to StaffModule via workspace.
  File: features/organization-owner/components/organization-owner-workspace.tsx
  Find the case for "staff" in the ModuleContent switch.
  It currently renders <StaffModule dashboard={dashboard} moduleData={moduleData} moduleFilters={moduleFilters} />.
  But activeFeatureKeys is not available in ModuleContent. You need to get it from context or props.

  Check how OrgOwnerLayoutClient passes data. It likely uses React context.
  File: features/organization-owner/components/org-owner-layout-client.tsx
  Read this file to find the context for activeFeatureKeys.

  If there's a context hook like useOrgOwnerContext or useEntitlements, use it in StaffModule.
  Alternatively, pass activeFeatureKeys as a prop through the workspace chain:
    ModuleContent receives it → passes to StaffModule → StaffModule uses for tab gating.

  Simplest approach: StaffModule imports a hook that reads activeFeatureKeys from the
  entitlement provider set up in org-owner-layout-client.tsx.

Step 10: Add staff attendance data to module-data-resolver (optional).
  File: features/organization-owner/services/module-data-resolver.ts
  The resolver already fetches staff data for the "staff" slug. If the attendance and leave
  components fetch their own data client-side via server actions, no changes needed here.
  If you want server-side pre-fetching, add attendance/leave counts to the staff resolver case.
  Recommended: keep it simple — let the components fetch client-side.

Step 11: Validation.
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Verification checklist:
  Attendance:
  - Staff module shows "Attendance" sub-tab for Growth/Enterprise plans
  - "Attendance" tab hidden for Starter plan
  - Clock In creates attendance record with current timestamp
  - Clock Out updates record with end time
  - Cannot clock in twice without clocking out
  - Attendance log table shows correct data
  - Staff filter works
  - Date range filter works
  - Duration calculated correctly (clock_out - clock_in)
  - Monthly summary shows present/absent counts
  - CSV export of attendance downloads correctly
  Leave:
  - Staff module shows "Leave" sub-tab for Growth/Enterprise plans
  - "Leave" tab hidden for Starter plan
  - Create leave request with all fields
  - Pending requests appear in table with orange badge
  - Approve button changes status to approved (green)
  - Reject button changes status to rejected (red)
  - Cannot submit overlapping leave dates for same staff
  - Leave type filter works
  - Status filter works
  General:
  - Both features gated via requireOrgFeatureAccess (no hardcoded plan checks)
  - typecheck/lint/build all pass
  - Existing staff list and invite/deactivate still work
  - No regression in Staff module

---

Files to Create:
  supabase/migrations/YYYYMMDD_create_staff_attendance_leave.sql
  features/organization-owner/actions/staff-attendance-actions.ts
  features/organization-owner/actions/staff-leave-actions.ts
  features/organization-owner/components/modules/StaffAttendancePanel.tsx
  features/organization-owner/components/modules/StaffLeavePanel.tsx

Files to Modify:
  features/organization-owner/components/modules/StaffModule.tsx (add sub-tabs + activeFeatureKeys prop)
  features/organization-owner/components/organization-owner-workspace.tsx (pass activeFeatureKeys to StaffModule)

Key patterns:
  Follow StaffModule.tsx for component structure (props, DataList, FilterBar, Drawer, useActionState).
  Follow staff-actions.ts for server action patterns (getOrgOwnerContext, entitlement guards, limit checks).
  Use the existing UI kit: StatCard, DataList, FilterBar, OrgOwnerDrawer, Button, Badge.
  All server actions gated with requireOrgFeatureAccess(orgId, "staff_attendance_leave").
