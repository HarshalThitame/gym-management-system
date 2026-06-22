Continue from docs/Phase1.3.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 1.3 — Custom Member Fields + Member Data Import/Export for Organization Owner panel.

Context: Member profiles currently have only fixed columns (name, phone, email, etc.).
Org Owners on Growth/Enterprise plans need to define custom fields and bulk import/export members.
Feature keys custom_member_fields and member_data_import_export are registered in the
entitlement system but have no UI, no sidebar entry, and no backend — these are sub-features
embedded within the existing Members module, not new sidebar modules.

Goal: Custom field CRUD manager inside Members module, CSV import wizard with field mapping,
and CSV export with all fields. Everything gated through the existing entitlement pipeline.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

PART A: Custom Member Fields

Step 1: Read existing files to understand patterns.
  - features/organization-owner/components/modules/MembersModule.tsx (how members are displayed/edited)
  - features/organization-owner/actions/member-actions.ts (existing member CRUD)
  - features/organization-owner/services/member-service.ts (how member data is fetched)
  - supabase/migrations/ (look at recent migrations for table creation patterns)
  - features/entitlement/feature-registry.ts (FEATURE_KEYS, MODULE_FEATURE_MAP)
  - types/database.ts (member type definition)

Step 2: Create the custom_member_fields table migration.
  File: supabase/migrations/YYYYMMDD_create_custom_member_fields.sql
  (Use current date as YYYYMMDD prefix)

  Table: custom_member_fields
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    field_name text NOT NULL
    field_type text NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select'))
    options jsonb DEFAULT '[]'::jsonb  (for select type: ["Option A", "Option B"])
    required boolean DEFAULT false
    sort_order integer DEFAULT 0
    is_active boolean DEFAULT true
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()

  Create a junction table for storing custom field values per member:
  Table: member_custom_field_values
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE
    field_id uuid NOT NULL REFERENCES custom_member_fields(id) ON DELETE CASCADE
    value text
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()
    UNIQUE (member_id, field_id)

  Enable RLS, add policies, add indexes.

Step 3: Create server actions for custom fields.
  File: features/organization-owner/actions/member-field-actions.ts
  Mark as "use server".

  Export:
  - getCustomFields(organizationId: string) → CustomField[]
    Gate: requireOrgFeatureAccess(organizationId, "custom_member_fields")
  - createCustomField(organizationId, data: { field_name, field_type, options?, required? }) → CustomField
    Gate: requireOrgFeatureAccess(organizationId, "custom_member_fields")
  - updateCustomField(organizationId, fieldId, data) → CustomField
    Gate: requireOrgFeatureAccess(organizationId, "custom_member_fields")
  - deleteCustomField(organizationId, fieldId) → void
    Gate: requireOrgFeatureAccess(organizationId, "custom_member_fields")
  - getMemberCustomFieldValues(memberId: string) → { field: CustomField; value: string }[]
    No gate (reading member data, not managing fields)
  - saveMemberCustomFieldValue(memberId, fieldId, value) → void
    No feature gate (part of member editing)

  Import requireOrgFeatureAccess from @/features/entitlement.
  Use createSupabaseServerClient from @/lib/supabase/server.

Step 4: Create custom fields UI panel.
  File: features/organization-owner/components/modules/CustomMemberFieldsPanel.tsx

  This is a "use client" component. It will be embedded inside MembersModule as a tab or section.

  Shows a table of custom fields with columns: Field Name, Type, Required, Sort Order, Actions (edit, delete).
  "Add Field" button opens a modal/drawer with:
    - Field Name input
    - Field Type select (text, number, date, select)
    - Options textarea (only for select type, one option per line)
    - Required toggle
  Edit works in same modal pre-filled.
  Delete shows confirmation dialog.

  Only render if the organization has custom_member_fields feature.
  Accept a prop: organizationId and a boolean hasFeature for gating.

Step 5: Update member actions to handle custom fields.
  File: features/organization-owner/actions/member-actions.ts
  In create and update member functions:
  - After saving the member, if custom field values are provided, save them to member_custom_field_values
  - Accept optional customFields: { fieldId: string; value: string }[] param

Step 6: Update MembersModule to show custom fields.
  File: features/organization-owner/components/modules/MembersModule.tsx

  Add a "Custom Fields" tab or section (only if org has feature).
  Add the CustomMemberFieldsPanel component.
  In the member detail view (if any), show custom field values.
  In the member edit/create form, render dynamic custom fields based on getCustomFields.

---

PART B: Member Data Import

Step 7: Create import server action.
  File: features/organization-owner/actions/member-import-actions.ts
  Mark as "use server".

  Export:
  - previewMemberImport(organizationId, csvContent: string) → { headers: string[], rows: string[][], errors: { row: number; message: string }[] }
    Gate: requireOrgFeatureAccess(organizationId, "member_data_import_export")
    Parses CSV, validates headers, returns preview with error rows.
  - executeMemberImport(organizationId, rows: Record<string, string>[], fieldMapping: Record<string, string>) → { imported: number; failed: number; errors: { row: number; message: string }[] }
    Gate: requireOrgFeatureAccess(organizationId, "member_data_import_export")
    Inserts members with mapped fields. fieldMapping maps CSV column → member field or custom field.

Step 8: Create import UI.
  File: features/organization-owner/components/modules/MemberImportPanel.tsx
  "use client" component, embedded in MembersModule as a section/tab.

  Flow:
  1. Upload step: drag-and-drop CSV file area, file picker button
  2. Preview step: parse CSV, show first 5 rows preview, list of detected headers
  3. Mapping step: for each CSV header, show a dropdown to map to: system fields (name, phone, email, etc.) 
     or custom fields (fetched from getCustomFields) or "Skip"
  4. Validation preview: show rows with errors highlighted (missing required fields, invalid formats)
  5. Import execution: progress bar, then results (X imported, Y failed)

Step 9: Create import API endpoint.
  File: app/api/members/import/route.ts
  POST handler that receives the CSV content + mapping, validates, and imports.
  Gate: requireApiFeatureAccess(orgId, "member_data_import_export")
  Keep the parsing/validation logic in the server action, call it from this route.

---

PART C: Member Data Export

Step 10: Create export server action.
  In the same features/organization-owner/actions/member-import-actions.ts, add:

  - exportMembers(organizationId, filters?: { status?: string; branchId?: string }) → CSV string
    Gate: requireOrgFeatureAccess(organizationId, "member_data_import_export")
    Queries members with all system fields + custom field values.
    Generates CSV with headers for all fields.
    Returns CSV content as string.

Step 11: Create export UI.
  File: features/organization-owner/components/modules/MemberExportPanel.tsx
  "use client" component, embedded in MembersModule.

  Shows:
  - Filter options before export (status, branch) — mirrors current member list filters
  - "Export All" button (downloads CSV of all members matching current filters)
  - "Export Selected" button (if selection is implemented)
  - Download triggers browser file download using Blob/URL.createObjectURL

Step 12: Add import/export entry points to MembersModule.
  File: features/organization-owner/components/modules/MembersModule.tsx
  Add "Import" and "Export" buttons in the module header or toolbar.
  Import opens MemberImportPanel, Export opens MemberExportPanel or downloads directly.
  Gate both buttons: only show if org has member_data_import_export feature.
  Pass activeFeatureKeys or a hasFeature boolean to control visibility.

---

Step 13: Validation.
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Verification checklist:
  Custom Fields:
  - Custom field CRUD works (create, edit, delete)
  - "Add Field" modal validates inputs
  - Select type shows options textarea
  - Deletion shows confirm dialog
  - Custom fields appear in member create/edit form
  - Custom field values save and display correctly
  - Custom fields hidden for plans without custom_member_fields
  Import:
  - CSV file upload works (drag-drop + picker)
  - CSV preview shows first 5 rows
  - Field mapping dropdown shows system fields + custom fields
  - Validation errors shown for bad rows
  - Import creates member records with correct field values
  - Import result shows X imported, Y failed
  - Import hidden for plans without member_data_import_export
  Export:
  - Export button visible for Growth/Enterprise
  - CSV downloads with correct headers (system + custom fields)
  - Active filters respected in export
  - Export hidden for plans without member_data_import_export
  General:
  - typecheck/ lint/ build all pass
  - No hardcoded plan checks — all gated via requireOrgFeatureAccess

---

Files to Create:
  supabase/migrations/YYYYMMDD_create_custom_member_fields.sql
  features/organization-owner/actions/member-field-actions.ts
  features/organization-owner/actions/member-import-actions.ts
  features/organization-owner/components/modules/CustomMemberFieldsPanel.tsx
  features/organization-owner/components/modules/MemberImportPanel.tsx
  features/organization-owner/components/modules/MemberExportPanel.tsx
  app/api/members/import/route.ts

Files to Modify:
  features/organization-owner/components/modules/MembersModule.tsx (add tabs/buttons)
  features/organization-owner/actions/member-actions.ts (support custom fields in create/update)
