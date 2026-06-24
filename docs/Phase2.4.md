Continue from docs/Phase2.4.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 2.4 — Corporate / Bulk Memberships for Organization Owner panel.

What this phase is about:
  The Enterprise plan includes corporate_bulk_memberships — the ability to create company
  accounts (corporates), add employees as members in bulk, and manage company-level invoicing.
  Currently zero implementation exists: no corporate_accounts table, no bulk member creation
  flow, no corporate member linkage. The Members module handles individual members only.
  This phase adds corporate account management as a sub-tab inside the Members module,
  enabling Org Owners to create company profiles, bulk-add employee members with a single
  action, and view corporate membership reports. Gated through the entitlement pipeline.

Reference: docs/ENTERPRISE_PRODUCTION_PLAN.md Phase 2 Session 9.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

Step 1: Read existing files to understand patterns.
  - features/organization-owner/components/modules/MembersModule.tsx (props, DataList, FilterBar, drawer patterns, sub-tabs)
  - features/organization-owner/actions/member-actions.ts (saveMemberAction, entitlement guards, limit checks)
  - features/organization-owner/services/member-service.ts (member data fetching)
  - features/organization-owner/services/module-data-resolver.ts (how members pre-fetch works)
  - supabase/migrations/ (look for members table creation to understand columns)
  - types/database.ts (members table type, look for existing corporate-related columns)
  - features/entitlement/feature-registry.ts (corporate_bulk_memberships in FEATURE_KEYS)

Step 2: Understand the current members module structure.
  MembersModule uses sub-tabs: "Members" (existing), "Custom Fields", "Import", "Export"
  (from Phase 1.3 if built). It receives { dashboard, moduleData } as props.
  It uses DataList for the member table, FilterBar for search/filters, OrgOwnerDrawer
  for create/edit forms. Members are scoped to the organization's gyms.

Step 3: Create corporate_accounts table migration.
  File: supabase/migrations/YYYYMMDD_create_corporate_accounts.sql

  Table: corporate_accounts
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    company_name text NOT NULL
    contact_person text
    contact_email text
    contact_phone text
    billing_email text
    discount_percentage numeric(5,2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100)
    address text
    notes text
    is_active boolean DEFAULT true
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()

  Indexes: on organization_id.
  Enable RLS.

  Also ALTER TABLE members to add:
    ALTER TABLE members ADD COLUMN IF NOT EXISTS corporate_account_id uuid
    REFERENCES corporate_accounts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_members_corporate_account ON members(corporate_account_id);

  This links members to their corporate company.

Step 4: Create corporate server actions.
  File: features/organization-owner/actions/corporate-actions.ts
  Mark as "use server".

  Export:
  - getCorporateAccounts(organizationId, filters?: { q?, page?, pageSize? })
    Returns { accounts: CorporateAccount[]; total: number; summary: { totalCompanies, totalEmployees, totalRevenue } }
    Gate: requireOrgFeatureAccess(organizationId, "corporate_bulk_memberships")

  - getCorporateAccount(organizationId, accountId) → CorporateAccount with employee list
    Includes member count and employee member details.
    Gate: requireOrgFeatureAccess(organizationId, "corporate_bulk_memberships")

  - createCorporateAccount(organizationId, data: { companyName, contactPerson?, contactEmail?, contactPhone?, billingEmail?, discountPercentage?, address?, notes? })
    Returns CorporateAccount
    Gate: requireOrgFeatureAccess(organizationId, "corporate_bulk_memberships")
    Validation: company_name required, discount_percentage 0-100.

  - updateCorporateAccount(organizationId, accountId, data)
    Returns CorporateAccount
    Gate: requireOrgFeatureAccess(organizationId, "corporate_bulk_memberships")

  - deleteCorporateAccount(organizationId, accountId) → void
    Gate: requireOrgFeatureAccess(organizationId, "corporate_bulk_memberships")
    Sets members.corporate_account_id to NULL for linked employees (don't delete members).

  - getCorporateEmployees(organizationId, accountId) → Member[]
    Gate: no separate gate (part of corporate account access)
    Returns members linked to this corporate account.

  Import: requireOrgFeatureAccess from @/features/entitlement.
  Import: createSupabaseServerClient from @/lib/supabase/server.

Step 5: Create bulk member creation server action.
  File: features/organization-owner/actions/corporate-actions.ts (same file)

  Export:
  - bulkAddCorporateEmployees(organizationId, accountId, employees: EmployeeInput[])
    Where EmployeeInput = { fullName, phone, email?, gymId, membershipPlanId? }
    Returns { created: number; failed: number; errors: { index: number; message: string }[] }

    Gate: requireOrgFeatureAccess(organizationId, "corporate_bulk_memberships")

    Logic:
    1. Validate corporate account exists and belongs to org
    2. For each employee: validate required fields, check phone uniqueness within org
    3. Upsert member record with corporate_account_id set
    4. If membershipPlanId provided, also create a membership record
    5. Apply corporate discount to membership pricing
    6. Return summary with per-row errors for failed entries
    7. All inserts in a single transaction if possible, or collect errors per row

  This is the core "bulk memberships" feature — one action creates N members.

Step 6: Create corporate module UI.
  File: features/organization-owner/components/modules/CorporateMembershipsPanel.tsx
  "use client" component.

  Props: { dashboard: OrganizationOwnerDashboard; hasFeature: boolean }
  This is a sub-tab inside the Members module, alongside "Members", "Custom Fields", etc.

  Layout — Company List View:
  - Summary stat cards: Total Companies, Total Corporate Employees, Total Corporate Revenue
  - "Add Company" button → opens drawer/modal:
    - Company Name (required)
    - Contact Person, Contact Email, Contact Phone
    - Billing Email
    - Discount Percentage (0-100)
    - Address, Notes (optional)
  - Search bar to find companies by name
  - Data table: Company Name, Contact Person, Employees Count, Discount, Status, Actions
  - Row click → Company Detail View

  Layout — Company Detail View:
  - Back button to company list
  - Company info card: name, contact, discount, billing email, address
  - Edit button → opens drawer pre-filled
  - Employee list section:
    - Data table: Employee Name, Phone, Email, Membership Status, Join Date, Gym
    - "Add Employees" button → opens bulk-add drawer:
      - Gym selector (which gym to add employees to)
      - Membership plan selector (optional, apply to all)
      - Bulk input: textarea with one employee per line, format: "Full Name, Phone, Email"
        OR a simple form to add employees one at a time with "Add Another" button
      - Preview: list of employees to be added with validation status (green check / red error)
      - "Add All" button → calls bulkAddCorporateEmployees
      - Result: X created, Y failed, show errors inline
  - Corporate revenue summary: total payments from corporate employees
  - Corporate membership report: plan breakdown for this company

Step 7: Add corporate tab to Members module.
  File: features/organization-owner/components/modules/MembersModule.tsx

  Add a new tab in the existing tab bar:
  Tab: "Corporate" — CorporateMembershipsPanel
  Gated: only show if org has corporate_bulk_memberships feature.

  The MembersModule currently uses useHasFeature from the entitlement provider.
  Add: const hasCorporate = useHasFeature("corporate_bulk_memberships");

  Import CorporateMembershipsPanel.
  Add tab button and conditional rendering.

Step 8: Update member actions to support corporate account.
  File: features/organization-owner/actions/member-actions.ts

  In saveMemberAction:
  - Accept optional corporateAccountId from formData
  - If provided and org has corporate_bulk_memberships, set corporate_account_id
  - Verify corporate account belongs to org

  This allows manually adding corporate members through the existing member form,
  not just through bulk import.

Step 9: Add corporate revenue aggregation to dashboard (optional).
  File: features/organization-owner/components/enterprise-dashboard.tsx
  Add a "Corporate Members" KPI card showing total corporate employees and companies.
  Gate: only show if corporate_bulk_memberships in activeFeatureKeys.

Step 10: Add corporate data to module resolver.
  File: features/organization-owner/services/module-data-resolver.ts
  The corporate tab fetches its own data client-side (via server actions), so no
  resolver changes are strictly needed. But if you want pre-fetching for the
  initial load, add corporate summary counts to the members resolver case.

Step 11: Validation.
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Verification checklist:
  Corporate Accounts:
  - Members module shows "Corporate" sub-tab for Enterprise plan
  - "Corporate" tab hidden for Growth and Starter plans
  - Create company with all fields
  - Company appears in list with correct employee count
  - Edit company updates details
  - Delete company unlinks employees (members remain)
  - Discount percentage enforced (0-100)
  Bulk Add:
  - "Add Employees" opens bulk-add drawer
  - Gym and membership plan selectors work
  - Bulk input textarea accepts one employee per line
  - Preview shows employees with validation status
  - Invalid entries (missing name, duplicate phone) show errors
  - "Add All" creates member records linked to corporate account
  - Result summary shows X created, Y failed
  - Failed entries show inline error messages
  Member Linking:
  - Existing member form shows corporate account selector (if feature enabled)
  - Manually added corporate member links correctly
  - Employee list shows all linked members
  - Removing employee from corporate (unlink) preserves member record
  Edge Cases:
  - Empty company (no employees) shows "No employees yet" state
  - Bulk add with 50+ employees works without timeout
  - Company name unique within org (enforced)
  - Deleted company doesn't cascade-delete members
  General:
  - All actions gated via requireOrgFeatureAccess (no hardcoded plan checks)
  - typecheck/lint/build all pass
  - Existing member CRUD still works (no regression)

---

Files to Create:
  supabase/migrations/YYYYMMDD_create_corporate_accounts.sql
  features/organization-owner/actions/corporate-actions.ts
  features/organization-owner/components/modules/CorporateMembershipsPanel.tsx

Files to Modify:
  features/organization-owner/components/modules/MembersModule.tsx (add "Corporate" tab)
  features/organization-owner/actions/member-actions.ts (accept corporateAccountId in saveMember)
  features/organization-owner/components/enterprise-dashboard.tsx (optional: add corporate KPI)

Key design decisions:
  - Corporate accounts are a sub-tab of Members, not a separate sidebar module.
    Reason: corporate membership is a way to manage members, not a standalone feature.
  - Deleting a corporate account unlinks members (SET NULL), doesn't delete them.
  - Bulk add uses textarea input (one employee per line: Name, Phone, Email) for speed.
    A more complex multi-row form could be added later.
  - Corporate discount is stored on the account, applied during membership creation.
    The discount application logic goes in bulkAddCorporateEmployees.
  - All amounts in paise, displayed via formatCurrency.
  - All server actions gated with requireOrgFeatureAccess(orgId, "corporate_bulk_memberships").
