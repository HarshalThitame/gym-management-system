Continue from docs/Phase2.2.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 2.2 — Multi-Branch Staff Assignment + HR Document Storage for Organization Owner panel.

What this phase is about:
  Currently staff accounts are assigned to a single branch via branch_users. The Growth/Enterprise
  plans promise multi_branch_staff_assignment (assign staff to multiple branches) and
  hr_document_storage (upload contracts, certificates, ID proofs for staff). Neither feature
  has any implementation — the feature keys are registered but no UI or backend exists.
  This phase enables multi-branch assignment with conflict prevention, and builds an HR
  document upload/viewer inside the Staff module. Both gated through the entitlement pipeline.

Reference: docs/ENTERPRISE_PRODUCTION_PLAN.md Phase 2 Session 7.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

PART A: Multi-Branch Staff Assignment

Step 1: Read existing files to understand current staff assignment.
  - features/organization-owner/components/modules/StaffModule.tsx (how staff list + invite works)
  - features/organization-owner/actions/staff-actions.ts (inviteStaffAction assigns to one branch)
  - features/organization-owner/components/modules/StaffAttendancePanel.tsx (if built in Phase 2.1)
  - types/database.ts (branch_users table type)
  - supabase/migrations/ (any existing branch_users table constraints)
  - features/entitlement/feature-registry.ts (multi_branch_staff_assignment is in FEATURE_KEYS)

Step 2: Understand the current staff-to-branch relationship.
  The branch_users table currently has: id, user_id, branch_id, organization_id, role_name, status.
  Each row assigns one user to one branch with one role. Multi-branch assignment means creating
  multiple branch_users rows for the same user_id across different branch_ids.

  Current state: inviteStaffAction only creates ONE branch_users row per invitation.
  The branch_id is a single value, not an array.

Step 3: No migration needed for multi-branch assignment.
  The existing branch_users table already supports multiple rows per user (no unique constraint
  on user_id). The work is purely in the UI and server actions — allowing selection of multiple
  branches when inviting staff, and showing per-staff branch assignments.

Step 4: Update invite staff to support multiple branches.
  File: features/organization-owner/actions/staff-actions.ts

  In inviteStaffAction:
  - Change the branchId parameter to accept branchIds: string[] (or parse from formData.getAll)
  - For each branchId, create a separate branch_users row
  - Add validation: check that all branchIds belong to the org
  - Gate: only allow multiple branches if org has multi_branch_staff_assignment feature
    const hasMultiBranch = await hasFeatureAccess(orgId, "multi_branch_staff_assignment");
    if (branchIds.length > 1 && !hasMultiBranch) throw error;
  - Single branch assignment still works for Starter plan

Step 5: Update the invite drawer to support multi-branch selection.
  File: features/organization-owner/components/modules/StaffModule.tsx

  In the existing invite staff drawer:
  - Change the branch select dropdown to a multi-select (checkboxes or multi-select component)
  - If the org has multi_branch_staff_assignment, allow selecting multiple branches
  - If not, keep it as single select
  - Pass activeFeatureKeys or a hasMultiBranch prop to the drawer
  - Use a simple group of checkboxes if no multi-select component exists in the UI kit

Step 6: Create a staff branch assignment viewer/editor.
  File: features/organization-owner/components/modules/StaffBranchAssignmentPanel.tsx
  "use client" component, rendered as a sub-tab in Staff module.

  Props: { dashboard: OrganizationOwnerDashboard; hasFeature: boolean }

  Layout:
  - Staff selector dropdown at top (pick a staff member)
  - Current Assignments section: list of branches the staff is assigned to
    - Each row: Branch Name, Role, Status, "Remove" button
  - "Add Branch Assignment" button → modal/drawer:
    - Branch dropdown (only unassigned branches)
    - Role dropdown (same roles as invite)
    - Confirm button
  - Conflict indicator: if staff is scheduled at two branches at overlapping class times
    show a warning icon (basic check — can be refined later)

  Create server actions for this panel:
  File: features/organization-owner/actions/staff-branch-actions.ts
  "use server"
  - assignStaffToBranch(organizationId, userId, branchId, roleName) → void
    Gate: requireOrgFeatureAccess(organizationId, "multi_branch_staff_assignment")
  - removeStaffFromBranch(organizationId, assignmentId) → void
    Gate: requireOrgFeatureAccess(organizationId, "multi_branch_staff_assignment")
  - getStaffBranchAssignments(organizationId, userId) → BranchAssignment[]
    Gate: requireOrgFeatureAccess(organizationId, "multi_branch_staff_assignment")

---

PART B: HR Document Storage

Step 7: Create migration for hr_documents table.
  File: supabase/migrations/YYYYMMDD_create_hr_documents.sql

  Table: hr_documents
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    staff_id uuid NOT NULL
    doc_type text NOT NULL CHECK (doc_type IN ('contract', 'certificate', 'id_proof', 'joining_letter', 'other'))
    file_name text NOT NULL
    file_url text NOT NULL  -- Supabase Storage URL
    file_size integer  -- in bytes
    content_type text
    expiry_date date
    notes text
    uploaded_by uuid REFERENCES profiles(id)
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()

  Indexes: on (organization_id, staff_id), on (expiry_date) for alerts.
  Enable RLS.

  Also add a Supabase Storage bucket policy comment in the migration:
  -- Bucket: hr-documents (create manually in Supabase dashboard or via SQL)
  -- RLS policies should be added through Supabase dashboard for the bucket.

Step 8: Create HR document server actions.
  File: features/organization-owner/actions/hr-actions.ts
  Mark as "use server".

  Export:
  - getHRDocuments(organizationId, filters: { staffId?, docType? }) → HRDocument[]
    Gate: requireOrgFeatureAccess(organizationId, "hr_document_storage")

  - uploadHRDocument(organizationId, data: { staffId, docType, fileName, fileUrl, fileSize?, contentType?, expiryDate?, notes? })
    Returns HRDocument
    Gate: requireOrgFeatureAccess(organizationId, "hr_document_storage")

  - deleteHRDocument(organizationId, documentId) → void
    Gate: requireOrgFeatureAccess(organizationId, "hr_document_storage")
    Also deletes the file from Supabase Storage.

  - getExpiringDocuments(organizationId, daysThreshold: number = 30) → HRDocument[]
    Gate: requireOrgFeatureAccess(organizationId, "hr_document_storage")
    Returns documents with expiry_date within N days.

  Import: requireOrgFeatureAccess from @/features/entitlement.
  Import: createSupabaseServerClient from @/lib/supabase/server.

  For file upload: use Supabase Storage. The upload flow:
    1. Client generates a signed URL or uploads directly to Supabase Storage
    2. Client receives the file_url from Storage
    3. Client calls uploadHRDocument action with the file_url
  Or: create an API route for direct server-side upload.

Step 9: Create HR documents UI component.
  File: features/organization-owner/components/modules/HRDocumentsPanel.tsx
  "use client" component, sub-tab in Staff module.

  Props: { dashboard: OrganizationOwnerDashboard; hasFeature: boolean }

  Layout:
  - Top: "Upload Document" button → opens drawer/modal:
    - Staff selector dropdown
    - Document type dropdown (Contract, Certificate, ID Proof, Joining Letter, Other)
    - File picker (drag-and-drop or file input)
    - Expiry date picker (optional)
    - Notes textarea
  - Expiring Soon alert banner (if any documents expiring within 30 days)
  - Filter bar: staff selector, doc type filter
  - Document cards/table:
    - Staff Name, Document Type (with icon), File Name, Upload Date, Expiry Date
    - Click to download/view (opens file_url)
    - Delete button with confirmation
    - Expiry badge: green (valid), orange (expiring within 30 days), red (expired)
  - Empty state when no documents
  - Mobile: cards stack vertically, file picker works on touch

Step 10: Integrate sub-tabs into StaffModule.
  File: features/organization-owner/components/modules/StaffModule.tsx

  Add to the existing tab bar (if built in Phase 2.1) or create tab bar:
  Tab 1: "Staff" — existing staff list (always visible)
  Tab 2: "Attendance" — StaffAttendancePanel (from Phase 2.1, gated on staff_attendance_leave)
  Tab 3: "Leave" — StaffLeavePanel (from Phase 2.1, gated on staff_attendance_leave)
  Tab 4: "Branch Access" — StaffBranchAssignmentPanel (gated on multi_branch_staff_assignment)
  Tab 5: "Documents" — HRDocumentsPanel (gated on hr_document_storage)

  Each tab conditionally rendered based on activeFeatureKeys.
  Import StaffBranchAssignmentPanel and HRDocumentsPanel.

Step 11: Create API route for HR document file upload (optional).
  File: app/api/hr/documents/route.ts
  POST handler that accepts multipart form data with the file.
  Uploads to Supabase Storage bucket "hr-documents".
  Returns the file_url.
  Gate: requireApiFeatureAccess(orgId, "hr_document_storage")

  This avoids exposing Supabase Storage keys to the client.
  If you prefer client-side upload using Supabase JS SDK, skip this and document
  the client-side upload pattern instead.

Step 12: Validation.
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Verification checklist:
  Multi-Branch:
  - Invite staff drawer allows multi-branch selection for Growth/Enterprise
  - Multi-branch selection hidden for Starter plan (single select only)
  - Staff assigned to multiple branches creates multiple branch_users rows
  - StaffBranchAssignmentPanel shows per-staff branch list
  - "Add Branch" assigns staff to additional branch
  - "Remove" removes staff from a branch (not the last one)
  - Staff appears in each branch's staff list
  HR Documents:
  - HR Documents tab visible for Growth/Enterprise plans
  - HR Documents tab hidden for Starter plan
  - File upload works (drag-and-drop + file picker)
  - File stored in Supabase Storage
  - Document appears in list after upload
  - Click to download/view opens the file
  - Delete removes file from storage + DB record
  - Document type filter works
  - Staff filter works
  - Expiry badge shows correct colors
  - Expiring soon alert shows when documents expiring within 30 days
  General:
  - All features gated via requireOrgFeatureAccess (no hardcoded plan checks)
  - typecheck/lint/build all pass
  - Existing staff invite/deactivate still work correctly
  - No regression in Staff module core functionality

---

Files to Create:
  supabase/migrations/YYYYMMDD_create_hr_documents.sql
  features/organization-owner/actions/staff-branch-actions.ts
  features/organization-owner/actions/hr-actions.ts
  features/organization-owner/components/modules/StaffBranchAssignmentPanel.tsx
  features/organization-owner/components/modules/HRDocumentsPanel.tsx

Files to Modify:
  features/organization-owner/actions/staff-actions.ts (multi-branch support in inviteStaffAction)
  features/organization-owner/components/modules/StaffModule.tsx (add Branch Access + Documents tabs)

Key patterns:
  Follow StaffModule.tsx and staff-actions.ts for component/action patterns.
  Multi-branch = multiple branch_users rows per user_id (table already supports this).
  File upload: use Supabase Storage JS SDK or server-side API route.
  Expiry badge colors: green (valid), orange (expiring in 30 days), red (expired).
  All server actions gated with requireOrgFeatureAccess using the correct feature key.
