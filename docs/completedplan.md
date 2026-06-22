# Phase 2.1 — Staff Attendance & Leave Tracking

**Completed:** 2026-06-22  
**Feature key:** `staff_attendance_leave`  
**Database migration:** Applied to hosted Supabase (`bobqiyhljubfrzmhqnqq.supabase.co`)  

---

## What was built

Staff attendance (clock-in/out log) and leave request management (submit/approve/reject) as sub-tabs inside the existing Staff module in the Organization Owner panel. Gated through the entitlement pipeline — only orgs with `staff_attendance_leave` in their active feature keys see the Attendance and Leave tabs.

### Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/20260710120000_create_staff_attendance_leave.sql` | Creates `staff_attendance` and `staff_leave_requests` tables with RLS, indexes, triggers, grants |
| `features/organization-owner/actions/staff-attendance-actions.ts` | 5 server actions: `getStaffAttendance`, `getTodayAttendanceStatus`, `clockIn`, `clockOut`, `getMonthlyAttendanceSummary` |
| `features/organization-owner/actions/staff-leave-actions.ts` | 6 server actions: `getLeaveRequests`, `createLeaveRequest`, `approveLeaveRequest`, `rejectLeaveRequest`, `getLeaveStats` |
| `features/organization-owner/components/modules/StaffAttendancePanel.tsx` | Today's status grid, clock in/out, filtered log (DataList), collapsible monthly summary table, CSV export |
| `features/organization-owner/components/modules/StaffLeavePanel.tsx` | Stat cards, filters, leave request list (DataList), create form drawer, approve/reject actions |

### Files Modified

| File | Changes |
|------|---------|
| `features/organization-owner/components/modules/StaffModule.tsx` | Added 3 sub-tabs (Staff/Attendance/Leave) with tab bar. Attendance + Leave tabs gated via `useHasFeature("staff_attendance_leave")`. Existing staff list is default tab. |
| `types/database.ts` | Added 5 missing table type definitions (`trainer_commissions`, `trainer_commission_rates`, `trainer_ratings`, `staff_attendance`, `staff_leave_requests`) + added `base_salary` and `branch_id` to `trainers` Row/Insert |

---

## Database

### `staff_attendance`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| organization_id | uuid FK → organizations | ON DELETE CASCADE |
| staff_id | uuid FK → profiles | ON DELETE CASCADE |
| branch_id | uuid FK → branches | ON DELETE SET NULL |
| clock_in | timestamptz | NOT NULL, DEFAULT now() |
| clock_out | timestamptz | nullable |
| date | date | GENERATED ALWAYS AS ((clock_in AT TIME ZONE 'UTC')::date) STORED |
| notes | text | nullable |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

### `staff_leave_requests`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| organization_id | uuid FK → organizations | ON DELETE CASCADE |
| staff_id | uuid FK → profiles | ON DELETE CASCADE |
| leave_type | text | CHECK IN ('sick','casual','annual','other') |
| start_date | date | NOT NULL |
| end_date | date | NOT NULL, CHECK (end_date >= start_date) |
| reason | text | nullable |
| status | text | DEFAULT 'pending', CHECK IN ('pending','approved','rejected') |
| approver_id | uuid FK → profiles | ON DELETE SET NULL |
| approved_at | timestamptz | nullable |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

### RLS Policies

Both tables have RLS enabled with:
- Organization owners: full CRUD (checks `owner_user_id = auth.uid()`)
- Staff: SELECT own records only (`staff_id = auth.uid()`)
- Service role: full access

---

## Server Action Patterns

### Security (IMPORTANT)

Every server action follows the two-step security pattern from `staff-actions.ts`:

```ts
const ctx = await getOrgOwnerContext("/organization/staff");
await requireOrganizationFeatureAccess({
  organizationId: ctx.organizationId,
  featureKey: "staff_attendance_leave",
  actionName: "staff.attendance.read",
});
```

- `getOrgOwnerContext` → calls `requireOrganizationOwner()` → checks the user has the `organization_owner` role
- `requireOrganizationFeatureAccess` → checks the org has the required feature key in their active entitlements

Do NOT use `requireOrgFeatureAccess` alone — it only checks org membership, not the org owner role.

### Mutations

All write operations call `revalidateOrgModules(["/organization/staff"])` after the mutation to invalidate Next.js caches, following the `staff-actions.ts:70` pattern.

### Audit Logging

All mutations write audit logs via `writeAuditLog()` with the actor set to `ctx.userId` (from `getOrgOwnerContext`).

### Type-safe DB access

For tables not yet in the generated TypeScript Database type:
```ts
const { data } = await (supabase as any).from("staff_attendance").select("*")...
```
This is the project convention (see `monitoring-service.ts:160`, `lead-actions.ts:217`).

Once `npx supabase gen types` is run (requires Docker), the `any` casts can be removed.

---

## UI Patterns

### Sub-tabs

Copied from `TrainersModule.tsx:104-141`. Uses `useMemo` for tab array with conditional entries based on feature access:

```tsx
const tabs = useMemo(() => {
  const t = [{ key: "staff", label: "Staff", icon: <UsersRound /> }];
  if (hasAttendanceLeave) {
    t.push({ key: "attendance", label: "Attendance", icon: <Clock /> });
    t.push({ key: "leave", label: "Leave", icon: <Mail /> });
  }
  return t;
}, [hasAttendanceLeave]);
```

### Feature gating in UI

Use `useHasFeature("staff_attendance_leave")` from the `EntitlementProvider` context. This reads from the provider set up in `org-owner-layout-client.tsx:37`. No need to thread activeFeatureKeys through workspace props.

### No workspace changes needed

Unlike the spec's Option A (pass `activeFeatureKeys` as a prop through the workspace chain), Step 9's "Simplest approach" was used: StaffModule uses the `useHasFeature` hook directly from the entitlement provider context. Workspace remains unchanged.

### Date rendering

- JSX dates: Use `<HydrationSafeDate>` from `@/components/ui/hydration-safe-date` to avoid hydration mismatches
- DataList string props: `toLocaleDateString("en-IN", {...})` with explicit locale is acceptable since DataCard accepts strings, not ReactNodes

---

## Issues Encountered & Fixed

### 1. `GENERATED ALWAYS AS (clock_in::date) STORED` — not immutable
PostgreSQL rejects timezone-dependent expressions in generated columns. Fixed by using `(clock_in AT TIME ZONE 'UTC')::date`.

### 2. Missing `getOrgOwnerContext` — security gap
Initial implementation used `requireOrgFeatureAccess` directly, which only checks org membership. Fixed by adding the two-step pattern: `getOrgOwnerContext` (`requireOrganizationOwner` role check) + `requireOrganizationFeatureAccess` (entitlement check).

### 3. `rejectLeaveRequest` missing `reason` parameter
Spec defined `rejectLeaveRequest(organizationId, requestId, reason?)`. Initial implementation omitted the optional third parameter. Added.

### 4. Stale `types/database.ts` — missing table definitions
The committed types file was stale — missing 5 tables added by recent migrations. `npx supabase gen types` requires Docker (not available). Fixed by manually adding type definitions and running migration directly against hosted DB via `pg`.

### 5. `exactOptionalPropertyTypes` — filter objects with undefined
Building filter objects with `|| undefined` fails with strict optional property types. Fixed by conditionally constructing objects:

```ts
const filterParams: { staffId?: string; ... } = { page, pageSize };
if (filters.staffId) filterParams.staffId = filters.staffId;
```

---

## Validation

| Check | Result |
|-------|--------|
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors (377 pre-existing warnings) |
| `npm run build` | Succeeded |
| `npm test` | 24/25 pass (7 pre-existing failures in `feature-resolver.test.ts`) |

---

## Feature verification checklist

- [x] Staff module shows "Attendance" sub-tab when `staff_attendance_leave` is in activeFeatureKeys
- [x] "Attendance" and "Leave" tabs hidden when feature not active
- [x] Clock In creates attendance record with current timestamp
- [x] Clock Out updates record with end time
- [x] Cannot clock in twice without clocking out (server-side validation)
- [x] Cannot clock out if already clocked out (server-side validation)
- [x] Attendance log DataList shows correct data with staff filter and date range filter
- [x] Duration calculated correctly from clock_in/clock_out
- [x] Monthly summary shows present/absent days with collapsible UI
- [x] CSV export of attendance downloads correctly
- [x] Leave request submission with all fields (staff, type, dates, reason)
- [x] Pending requests show with orange/warning badge, approved=green, rejected=red
- [x] Approve/reject buttons on pending requests update status
- [x] Cannot submit overlapping approved leave dates (server-side validation)
- [x] Leave type filter and status filter work
- [x] Both features gated via `requireOrgFeatureAccess` (no hardcoded plan checks)
- [x] Existing staff list and invite/deactivate still work (no regression)
 - [x] typecheck/lint/build all pass

---

# Phase 2.2 — Multi-Branch Staff Assignment + HR Document Storage

**Completed:** 2026-06-23  
**Feature keys:** `multi_branch_staff_assignment`, `hr_document_storage`  
**Database migration:** Applied to hosted Supabase (`bobqiyhljubfrzmhqnqq.supabase.co`)  
**Storage bucket:** `hr-documents` (public, 10MB limit)

---

## What was built

Two Growth/Enterprise features inside the Staff module:

1. **Multi-Branch Staff Assignment** — Assign a single staff member to multiple branches (creates multiple `branch_users` rows). Includes branch assignment viewer/editor panel and conflict detection for overlapping class schedules.

2. **HR Document Storage** — Upload contracts, certificates, ID proofs, and other staff documents to Supabase Storage. Includes expiry alerts, drag-and-drop file upload, and document management with type/staff filters.

All gated through the entitlement pipeline — tabs appear only when the corresponding feature key is active.

---

## Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/20260712000000_create_hr_documents.sql` | Creates `hr_documents` table with RLS, indexes, triggers, grants |
| `features/organization-owner/actions/staff-branch-actions.ts` | 3 server actions: `getStaffBranchAssignments`, `assignStaffToBranch`, `removeStaffFromBranch` |
| `features/organization-owner/actions/hr-actions.ts` | 4 server actions: `getHRDocuments`, `getExpiringDocuments`, `uploadHRDocument`, `deleteHRDocument` |
| `features/organization-owner/components/modules/StaffBranchAssignmentPanel.tsx` | Staff selector, branch assignment DataList, add/remove branch drawer, conflict detection banner |
| `features/organization-owner/components/modules/HRDocumentsPanel.tsx` | Document upload with drag-and-drop, expiring alerts, filter bar, document DataList, delete confirmation |
| `app/api/hr/documents/route.ts` | POST handler for server-side file upload to Supabase Storage (gated on `hr_document_storage`) |

---

## Files Modified

| File | Changes |
|------|---------|
| `features/organization-owner/actions/staff-actions.ts` | `inviteStaffAction` now accepts `branchIds[]` via `formData.getAll()`. Creates multiple `branch_users` rows for multi-branch invites. Gated: multi-branch only if org has `multi_branch_staff_assignment`. |
| `features/organization-owner/components/modules/StaffModule.tsx` | Added "Branch Access" and "Documents" sub-tabs (total 5 tabs). Multi-branch checkbox UI in invite drawer. Each tab gated via `useHasFeature()`. |

---

## Database

### `hr_documents`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| organization_id | uuid FK → organizations | ON DELETE CASCADE |
| staff_id | uuid | NOT NULL (no FK — references profiles) |
| doc_type | text | NOT NULL, CHECK IN ('contract','certificate','id_proof','joining_letter','other') |
| file_name | text | NOT NULL |
| file_url | text | NOT NULL (Supabase Storage public URL) |
| file_size | integer | nullable (bytes) |
| content_type | text | nullable (MIME type) |
| expiry_date | date | nullable |
| notes | text | nullable |
| uploaded_by | uuid FK → profiles | ON DELETE SET NULL |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

### Multi-branch (no migration needed)

The existing `branch_users` table already supports multiple rows per `user_id`. Multi-branch assignment is purely UI + server action logic — creating multiple `branch_users` rows for the same `user_id` across different `branch_id` values. No schema changes required.

### RLS Policies (hr_documents)

- Organization owners: full CRUD (checks `owner_user_id = auth.uid()`)
- Service role: full access

---

## Storage Bucket

Bucket `hr-documents` was created via Supabase Management API:

```bash
curl -X POST "https://<ref>.supabase.co/storage/v1/bucket" \
  -H "Authorization: Bearer <service_role_key>" \
  -d '{"id":"hr-documents","name":"hr-documents","public":true,"file_size_limit":10485760}'
```

- **Public:** true (files accessible via public URL)
- **File size limit:** 10MB
- **Upload flow:** Client sends file via `POST /api/hr/documents` → server uploads to Supabase Storage using `createSupabaseServerClient()` → returns `fileUrl` → client calls `uploadHRDocument` action to save DB record
- **Delete flow:** `deleteHRDocument` action removes both DB record and storage file (via admin client for storage access)

---

## Server Action Patterns

### Security (consistent with Phase 2.1)

Every server action uses the two-step pattern:

```ts
const ctx = await getOrgOwnerContext("/organization/staff");
await requireOrganizationFeatureAccess({
  organizationId: ctx.organizationId,
  featureKey: "multi_branch_staff_assignment",  // or "hr_document_storage"
  actionName: "staff_branch.assign",
});
```

### Multi-branch invite validation

In `inviteStaffAction`:
- Parses branch IDs from both `formData.get("branchId")` (single select, backward compat) and `formData.getAll("branchIds")` (multi-select checkboxes)
- When `branchIds.length > 1`, verifies org has `multi_branch_staff_assignment` entitlement
- For each branch, validates it belongs to the org before creating a `branch_users` row
- Single branch assignment continues working for Starter plan (no entitlement check)

### HR document upload flow

Two-step process:
1. **Client → API route** (`/api/hr/documents`): Sends file as FormData, gets back `{ fileUrl, fileName, fileSize, contentType }`
2. **Client → Server action** (`uploadHRDocument`): Saves DB record with the file URL

This avoids exposing Supabase Storage keys to the client.

### Delete confirmation pattern

The HRDocumentsPanel uses a two-click delete:
1. First click: "Delete" sets `deleteConfirmId` state
2. Second click: "Confirm delete?" or "Cancel"
Both actions rendered conditionally within the DataList actions array.

---

## UI Patterns

### Sub-tabs (extended from Phase 2.1)

Now 5 tabs, conditionally added based on feature access:

```tsx
const tabs = useMemo(() => {
  const t = [{ key: "staff", label: "Staff", icon: <UsersRound /> }];
  if (hasAttendanceLeave) {
    t.push({ key: "attendance", label: "Attendance", icon: <Clock /> });
    t.push({ key: "leave", label: "Leave", icon: <Mail /> });
  }
  if (hasMultiBranch) {
    t.push({ key: "branchAccess", label: "Branch Access", icon: <ArrowLeftRight /> });
  }
  if (hasHRDocs) {
    t.push({ key: "documents", label: "Documents", icon: <FileText /> });
  }
  return t;
}, [hasAttendanceLeave, hasMultiBranch, hasHRDocs]);
```

### Multi-branch checkboxes in invite drawer

When `!editingStaff && hasMultiBranch`:
- Renders a scrollable checkbox list instead of a single `<select>`
- Each checkbox has `name="branchIds"` value=`{branch.id}` for `formData.getAll()` on submit
- Controlled via `selectedBranchIds` state with `useEffect` onChange handlers
- Shows "Select at least one branch" when none selected
- For single-branch plans (Starter): falls back to the original `<select name="branchId">`

### Conflict detection

`StaffBranchAssignmentPanel` includes a `useMemo` that scans `dashboard.classSessions` for the selected staff member:
- Filters to sessions where `primary_trainer_id` or `substitute_trainer_id` matches the staff's `user_id`
- Checks for time overlaps (`aStart < bEnd && bStart < aEnd`) across different branches
- Renders an amber alert banner with details of each conflict
- Gated: only runs when staff has 2+ assignments

### Expiry badges

| State | Color | Badge | Icon BG |
|-------|-------|-------|---------|
| Valid (future or no expiry) | Green | "Valid" (success variant) | `bg-green-100 text-green-600` |
| Expiring within 30 days | Orange | "Expiring" (warning variant) | `bg-amber-100 text-amber-600` |
| Expired | Red | "Expired" (neutral variant) | `bg-red-100 text-red-600` |

---

## Issues Encountered & Fixed

### 1. Duplicate migration timestamp — `20260702000000`
Two migration files shared the same timestamp (`20260702000000_dunning_setup.sql` and `20260702000000_payment_system_hardening.sql`). The dunning_setup was applied to remote, blocking payment_hardening. Fixed by renaming to `20260712150000_payment_system_hardening.sql`.

### 2. Trainer commissions migration already on remote
`20260709150000_create_trainer_commissions.sql` failed because tables already existed on the hosted DB (created manually or via earlier push). Fixed by adding `IF NOT EXISTS` to all `CREATE TABLE` statements and `DROP POLICY IF EXISTS` before all `CREATE POLICY` statements.

### 3. Staff attendance migration already on remote
Same issue as trainer commissions — tables existed before push. Fixed with `IF NOT EXISTS` + `DROP POLICY IF EXISTS` idempotency.

### 4. `exactOptionalPropertyTypes` — filter objects with undefined
Same pattern as Phase 2.1 issue #5. HR documents panel builds filter objects conditionally:
```ts
const filterArgs: { staffId?: string; docType?: string } = {};
if (filterStaffId) filterArgs.staffId = filterStaffId;
if (filterDocType) filterArgs.docType = filterDocType;
```
Do NOT build filters with `|| undefined` — TypeScript's strict optional property types reject it.

### 5. `new Date().toISOString().split("T")[0]` returns `string | undefined`
The indexed array access `.split("T")[0]` has type `string | undefined`. Fixed by using `new Date()` directly (without the `.split` workaround) for date comparisons, since `new Date(string)` accepts full ISO strings.

### 6. Unused state variable `selectedGymId`
Initially added for gym-filtering the multi-branch checkboxes but never used. Removed to avoid lint warning.

### 7. Delete button had no confirmation
Spec required "Delete button with confirmation". Added two-click delete pattern: first click shows "Confirm delete?" + "Cancel", second click executes the delete.

### 8. Conflict indicator was missing
Spec required overlap detection for staff scheduled at multiple branches simultaneously. Added `useMemo` conflict scanner using `dashboard.classSessions` data with time-overlap logic.

---

## Validation

| Check | Result |
|-------|--------|
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors (382 pre-existing warnings) |
| `npm run build` | Succeeded |
| `npm test` | 24/25 pass (7 pre-existing failures in `feature-resolver.test.ts`) |
| Migration list | All 73 migrations synced (0 unpushed) |

---

## Feature verification checklist

### Multi-Branch
- [x] Invite staff drawer shows checkboxes when `multi_branch_staff_assignment` is active
- [x] Single select dropdown shown for Starter plan (feature not active)
- [x] Multiple branches selected creates multiple `branch_users` rows via `formData.getAll("branchIds")`
- [x] `StaffBranchAssignmentPanel` shows per-staff branch list with role, status, remove button
- [x] "Add Branch" drawer assigns staff to additional branch (only unassigned branches shown)
- [x] "Remove" revokes branch assignment (last assignment cannot be removed)
- [x] Staff with multi-branch assignments appears in each branch's staff list
- [x] Conflict warning banner when staff has overlapping class sessions across branches

### HR Documents
- [x] "Documents" tab visible when `hr_document_storage` is active
- [x] "Documents" tab hidden for Starter plan (feature not active)
- [x] Drag-and-drop file upload + file picker click-to-browse
- [x] File uploaded to Supabase Storage bucket `hr-documents` via `/api/hr/documents`
- [x] Document record saved to `hr_documents` table after storage upload
- [x] "View" button opens `file_url` in new tab
- [x] "Delete" shows confirmation before deleting DB record + storage file
- [x] Document type filter (Contract, Certificate, ID Proof, Joining Letter, Other)
- [x] Staff filter (dropdown)
- [x] Expiry badges: green (valid), orange (expiring within 30 days), red (expired)
- [x] Expiring soon alert banner when documents expire within 30 days

### General
- [x] All features gated via `requireOrganizationFeatureAccess` (no hardcoded plan checks)
- [x] Existing staff invite/deactivate still work correctly
- [x] No regression in Staff module core functionality
- [x] typecheck/lint/build all pass

---

## Important Notes

### Migration idempotency (CRITICAL for future)

All new migration files MUST use `CREATE TABLE IF NOT EXISTS` and `DROP POLICY IF EXISTS ... CREATE POLICY` patterns. The hosted database may already have tables created by prior manual pushes or earlier migration attempts. Non-idempotent migrations will fail with `relation already exists` errors.

### Ordering constraint

Supabase CLI requires migrations to be applied in chronological order. If a migration's timestamp is BEFORE the latest migration already on remote, it will be skipped unless `--include-all` is used. Always use timestamps AFTER the last remote migration when creating new files.

### Storage bucket creation

The `hr-documents` bucket was created via the Supabase Management API (not SQL). For future phases, document this pattern:
```bash
curl -X POST "https://<ref>.supabase.co/storage/v1/bucket" \
  -H "Authorization: Bearer <service_role_key>" \
  -d '{"id":"bucket-name","name":"bucket-name","public":true,"file_size_limit":10485760}'
```

### `requireOrganizationFeatureAccess` vs `requireOrgFeatureAccess`

Use the two-step pattern with `getOrgOwnerContext`:
```ts
const ctx = await getOrgOwnerContext("/organization/staff");  // checks org owner role
await requireOrganizationFeatureAccess({ ... });                 // checks entitlement
```
Do NOT use `requireOrgFeatureAccess` alone — it only checks org membership, not the org owner role.

### `as any` for non-generated database types

For tables not yet in the generated TypeScript `Database` type (like `hr_documents`), use:
```ts
const { data } = await (supabase as any).from("hr_documents").select("*")...
```
This is the established project convention. Once `npx supabase gen types` is run (requires Docker), the `any` casts can be removed.

