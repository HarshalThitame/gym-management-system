Continue from docs/Phase4.2.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 4.2 — E2E Test Suite for Organization Owner Panel.

Short overview:
  No new features. This phase writes Playwright end-to-end tests covering every module
  and feature built in Phases 1-3. Tests verify: feature locking/unlocking per plan,
  unlimited limits don't block creation, route guards redirect correctly, server actions
  and APIs return correct codes, UI renders without crashes, and cross-cutting concerns
  (entitlement gating, mobile responsiveness) work end-to-end.

  Supabase: https://bobqiyhljubfrzmhqnqq.supabase.co (see .env.local for keys)
  Test credentials from .env.local: E2E_SUPER_ADMIN_EMAIL, E2E_ORGANIZATION_OWNER_EMAIL,
  E2E_AUTH_PASSWORD, PLAYWRIGHT_BASE_URL=http://localhost:3000

Reference: docs/ENTERPRISE_PRODUCTION_PLAN.md Phase 4 Session 22.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.
The dev server must be running: `npm run dev` (on port 3000 from PLAYWRIGHT_BASE_URL).

---

Step 1: Read existing test infrastructure.
  - tests/e2e/ (40 existing spec files — read a few to understand patterns)
  - playwright.config.ts (baseURL, timeouts, projects)
  - tests/setup.ts (auth setup, test fixtures)
  - .env.local (E2E credentials)
  - tests/e2e/gym-admin-audit.spec.ts (audit pattern — read for structure)
  - tests/e2e/super-admin-subscriptions.spec.ts (plan-aware test pattern)

Step 2: Understand the test authentication pattern.
  Supabase auth is used. Tests need to log in as:
  - Organization Owner on Enterprise plan (all features unlocked, unlimited limits)
  - Organization Owner on Growth plan (selective features, limited limits)
  - Organization Owner on Starter plan (basic features, tight limits)
  - Super Admin (full access, no feature gates)

  Check how existing tests authenticate:
    const { authenticatedPage } = await authenticateTestUser(page, "organization_owner");
  Or similar pattern. Follow whatever the existing codebase uses.

  If no existing auth helper exists, create one in tests/setup.ts:
    async function loginAs(page: Page, email: string, password: string) {
      await page.goto("/login");
      await page.fill('[name="email"]', email);
      await page.fill('[name="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForURL("**/organization**");
      return page;
    }

Step 3: Create the test spec files.

---

TEST FILE 1: tests/e2e/organization-owner-entitlement-gating.spec.ts

  Tests entitlement gating across plans — the single most important test.

  Test: "Enterprise plan — sidebar shows all unlocked modules"
    Login as Enterprise org owner.
    Navigate to /organization.
    Verify sidebar entries: Dashboard, Plan, Branches, Staff, Members, Memberships,
      Revenue, Trainers, Attendance, Classes, Communications, Analytics, Branding,
      Domains, Billing, Nutrition, Support, Org Profile, Settings, Security, Leads,
      Custom Roles, Equipment (all rendered, no locked badge for Enterprise features).
    Each entry should NOT have a lock icon or "Not included" label.

  Test: "Growth plan — sidebar shows mixed locked/unlocked"
    Login as Growth org owner.
    Verify: Branches, Staff, Members, Revenue, Trainers, Attendance, Classes,
      Communications, Analytics, Billing — unlocked.
    Verify: Custom Roles, Equipment, Leads, Branding, Domains — locked (Enterprise-only).

  Test: "Starter plan — sidebar mostly locked"
    Login as Starter org owner.
    Verify: Dashboard, Plan, Staff, Members, Memberships, Attendance, Billing — unlocked.
    Verify: Analytics, Classes, Communications, Trainers, Revenue — locked or limited.
    Verify: Custom Roles, Equipment, Leads — completely absent or locked.

  Test: "Direct route access — locked features redirect for Starter plan"
    Login as Starter org owner.
    Navigate to /organization/equipment.
    Verify page redirects to /organization/locked-feature?feature=equipment_inventory_maintenance.
    Or shows "Feature not in your plan" message.

  Test: "Direct route access — unlocked features load for Enterprise plan"
    Login as Enterprise org owner.
    Navigate to /organization/equipment.
    Verify page loads successfully (no redirect, no error page).

---

TEST FILE 2: tests/e2e/organization-owner-unlimited-limits.spec.ts

  Tests that -1 (unlimited) limits never block resource creation.

  Test: "Enterprise unlimited members — can create 50+ members without limit error"
    Login as Enterprise org owner.
    Navigate to /organization/members.
    Click "Add Member".
    Fill form, submit.
    Verify: "Member created" success message, no "limit reached" error.
    Repeat 5 times quickly (simulate fast creation).
    All 5 should succeed without any LIMIT_REACHED error.

  Test: "Growth limited members — blocked at 1001"
    Login as Growth org owner (limit: 1000 members).
    Attempt to create member when count is near limit.
    Verify: appropriate error or warning about approaching limit.
    (This test requires knowing the current member count — use a setup step.)

  Test: "Unlimited branches — can create 10+ branches"
    Login as Enterprise org owner.
    Navigate to /organization/branches.
    Create 5 branches in rapid succession.
    Verify all succeed without limit errors.

  Test: "Unlimited staff — can invite multiple staff"
    Login as Enterprise org owner.
    Navigate to /organization/staff.
    Invite 3 staff members.
    Verify all succeed.

---

TEST FILE 3: tests/e2e/organization-owner-module-health.spec.ts

  Tests that each module page renders without crashes (smoke test).

  Test: "All Enterprise modules render without error"
    Login as Enterprise org owner.
    For each module route: /organization/members, /organization/staff,
      /organization/trainers, /organization/attendance, /organization/classes,
      /organization/communications, /organization/analytics, /organization/branding,
      /organization/domains, /organization/billing, /organization/nutrition,
      /organization/leads, /organization/revenue, /organization/custom-roles,
      /organization/equipment, /organization/security, /organization/settings,
      /organization/profile, /organization/support, /organization/plan.
    For each: navigate, wait for load, verify:
    - No "500" or "Error" text visible
    - Module title/heading is rendered
    - Data table or empty state is rendered (not a blank white page)
    - No console errors (page.on("pageerror"))
    This is a parameterized test — one test per route, not one mega-test.

  Test: "All modules are mobile responsive"
    Set viewport to iPhone 14 size (390x844).
    Navigate each module route.
    Verify: no horizontal overflow, hamburger menu visible, table scrolls,
      buttons still clickable.

---

TEST FILE 4: tests/e2e/organization-owner-crm-leads.spec.ts

  Tests the Leads module (Phase 1.2).

  Test: "Lead list renders with data"
    Login as Enterprise org owner, navigate to /organization/leads.
    Verify: data table visible, columns: Name, Phone, Email, Source, Status.
    Verify: new leads KPI visible on dashboard.

  Test: "Lead search filters results"
    Type in search bar, verify table updates with matching leads.
    Clear search, verify all leads shown.

  Test: "Lead status filter works"
    Select "New" from status dropdown.
    Verify only leads with status "new" shown.

  Test: "Lead detail drawer opens"
    Click a lead row.
    Verify: drawer opens with full lead details (name, phone, email, source, notes).
    Verify: status dropdown and "Convert to Member" button visible.

  Test: "Convert lead to member"
    In lead detail drawer, click "Convert to Member".
    Verify: success toast, lead status changes to "won".
    Navigate to /organization/members, verify new member exists.

  Test: "Pipeline view renders (Phase 3.3)"
    Navigate to Leads → Pipeline tab.
    Verify: Kanban columns visible (New, Contacted, Trial Scheduled, etc).
    Verify: lead cards shown in correct columns.

---

TEST FILE 5: tests/e2e/organization-owner-custom-fields-import.spec.ts

  Tests custom fields and import/export (Phase 1.3).

  Test: "Custom field CRUD"
    Navigate to /organization/members → Custom Fields tab.
    Click "Add Field", fill name, select type, save.
    Verify: new field appears in list.
    Edit field, verify changes persist.
    Delete field, verify removed from list.

  Test: "Custom fields appear in member form"
    After creating a custom field, open "Add Member" drawer.
    Verify: custom field input rendered in the form.

  Test: "CSV import upload works"
    Navigate to Members → Import tab.
    Upload a sample CSV (create one in test fixture).
    Verify: preview shows parsed rows.
    Map columns, execute import.
    Verify: success count shown, new members appear in list.

  Test: "CSV export downloads file"
    Navigate to /organization/revenue.
    Click export button.
    Verify: CSV file downloaded with correct headers.

---

TEST FILE 6: tests/e2e/organization-owner-reports.spec.ts

  Tests the 4 dedicated report pages (Phase 1.4).

  Test: "Analytics module shows report tabs"
    Navigate to /organization/analytics.
    Verify: sub-tabs visible (Overview, Trainer Performance, Class Occupancy,
      Lead Conversion, Branch Revenue).
    Click each tab, verify content renders with charts and data.

  Test: "Date range filter works on reports"
    On any report tab, change date range.
    Verify: chart and table data updates.

  Test: "CSV export per report works"
    On each report tab, click export.
    Verify: CSV file downloaded.

---

TEST FILE 7: tests/e2e/organization-owner-commissions-payroll.spec.ts

  Tests commissions and payroll (Phase 1.5).

  Test: "Commission dashboard loads"
    Navigate to /organization/trainers → Commissions tab.
    Verify: summary cards visible (Total Pending, Total Paid).
    Verify: commission table renders with data.

  Test: "Commission rates config works"
    Navigate to Rates tab.
    Set rate for a trainer.
    Verify: rate saved and displayed.

  Test: "Payroll module loads"
    Navigate to Payroll tab.
    Select month, verify payroll table renders.
    Click "Export CSV", verify file downloaded.
    Click "Export PDF", verify file downloaded.

---

TEST FILE 8: tests/e2e/organization-owner-staff-attendance-leave.spec.ts

  Tests staff attendance and leave (Phase 2.1).

  Test: "Staff attendance tab renders"
    Navigate to /organization/staff → Attendance tab.
    Verify: today's attendance list visible.
    Verify: clock-in/clock-out buttons visible.

  Test: "Clock-in creates attendance record"
    Click clock-in for a staff member.
    Verify: status changes to "Present" or "In Progress".

  Test: "Leave request flow"
    Navigate to Leave tab.
    Create leave request (select staff, type, dates, reason).
    Verify: request appears in pending table.
    Approve request, verify status changes to approved (green badge).
    Reject request, verify status changes to rejected (red badge).

---

TEST FILE 9: tests/e2e/organization-owner-multi-branch-hr.spec.ts

  Tests multi-branch assignment and HR documents (Phase 2.2).

  Test: "Multi-branch assignment visible"
    Navigate to /organization/staff → Branch Access tab.
    Verify: staff selector and branch assignment list visible.

  Test: "HR document upload"
    Navigate to Documents tab.
    Upload a test file.
    Verify: document appears in list with correct type badge.
    Click document, verify download works.
    Delete document, verify removed.

---

TEST FILE 10: tests/e2e/organization-owner-custom-roles.spec.ts

  Tests custom roles (Phase 2.3).

  Test: "Custom roles sidebar visible"
    Navigate to /organization/custom-roles.
    Verify: page loads with role list.

  Test: "Create custom role"
    Click "Create Role", fill name.
    Check permissions: members.read, payments.read.
    Save, verify: role appears in list with correct permission count.

  Test: "Assign custom role to staff"
    In Staff module → invite drawer, verify custom role selector visible.
    Assign a custom role, verify save succeeds.

---

TEST FILE 11: tests/e2e/organization-owner-corporate.spec.ts

  Tests corporate memberships (Phase 2.4).

  Test: "Corporate tab visible"
    Navigate to /organization/members → Corporate tab.
    Verify: company list renders.

  Test: "Create corporate account"
    Click "Add Company", fill details, save.
    Verify: company appears in list.

  Test: "Bulk add employees"
    Open company detail, click "Add Employees".
    Add employees via textarea, verify preview shows list.
    Execute import, verify employees created.

---

TEST FILE 12: tests/e2e/organization-owner-revenue-split.spec.ts

  Tests revenue split (Phase 2.5).

  Test: "Revenue split tab visible"
    Navigate to /organization/revenue → Revenue Split tab.
    Verify: rules list and reports tabs visible.

  Test: "Create split rule"
    Create rule: source branch → target branch, 30%.
    Verify: rule appears in list.

---

TEST FILE 13: tests/e2e/organization-owner-cross-branch.spec.ts

  Tests cross-branch access (Phase 2.6).

  Test: "Cross-branch access tab visible"
    Navigate to /organization/branches → Cross-Branch Access tab.
    Verify: rules list renders.

  Test: "Create access rule"
    Create rule allowing member from Gym A → Gym B.
    Verify: rule saved and displayed.

---

TEST FILE 14: tests/e2e/organization-owner-phase3-features.spec.ts

  Tests all Phase 3 features in one file (each is relatively small UI).

  Test: "Network class calendar renders" (Phase 3.2)
    Navigate to /organization/classes → Network Calendar tab.
    Verify: month grid calendar renders.

  Test: "Referral program tab renders" (Phase 3.4)
    Navigate to /organization/members → Referrals tab.
    Verify: dashboard stats visible, config tab works.

  Test: "Loyalty points tab renders" (Phase 3.5)
    Navigate to /organization/members → Loyalty tab.
    Verify: dashboard stats visible, transactions table renders.

  Test: "Network campaign builder renders" (Phase 3.6)
    Navigate to /organization/communications → Network Campaigns tab.
    Verify: builder form renders with gym selector, channel checkboxes.

  Test: "NPS surveys tab renders" (Phase 3.7)
    Navigate to /organization/communications → NPS Surveys tab.
    Verify: survey list renders, "Create Survey" button works.

  Test: "Custom dashboard layout saves" (Phase 3.8)
    Open dashboard, enter edit mode, rearrange widgets, save layout.
    Reload page, verify layout persisted.

  Test: "Equipment module renders" (Phase 3.8)
    Navigate to /organization/equipment.
    Verify: equipment list renders, "Add Equipment" button works.

  Test: "Google Calendar tab renders" (Phase 3.9)
    Navigate to /organization/settings → Google Calendar tab.
    Verify: connection UI renders.

  Test: "Webhooks tab renders" (Phase 3.9)
    Navigate to /organization/settings → Webhooks tab.
    Verify: webhook list renders, "Add Webhook" button works.

---

TEST FILE 15: tests/e2e/organization-owner-api-guards.spec.ts

  Tests API entitlement gating.

  Test: "Protected API returns 403 for locked feature"
    Login as Starter org owner.
    Call PUT /api/leads (requires lead_management — Starter doesn't have it).
    Verify: response status 403, body contains "FEATURE_LOCKED".

  Test: "Protected API returns 200 for unlocked feature"
    Login as Enterprise org owner.
    Call PUT /api/leads.
    Verify: response status 200 (or appropriate success code).

  Test: "Public API works without auth"
    Call POST /api/leads with lead data (no auth).
    Verify: response status 200 or 201.

  Test: "API validates organization ownership"
    Login as org owner of Org A.
    Call API with organization_id of Org B.
    Verify: response status 403, "Unauthorized org access".

---

Step 4: Create test fixtures and helpers.
  File: tests/e2e/fixtures/ (create if doesn't exist)
    - test-leads.csv: sample CSV with 5 leads for import testing
    - test-members.csv: sample CSV with 10 members for import testing
    - test-document.pdf: small PDF for HR document upload testing

  File: tests/e2e/helpers/organization-owner.ts (create if doesn't exist)
    - loginAsEnterpriseOwner(page)
    - loginAsGrowthOwner(page)
    - loginAsStarterOwner(page)
    - navigateToModule(page, moduleName: string)
    - verifyModuleLoaded(page, title: string)
    - verifySidebarLocked(page, label: string)
    - verifySidebarUnlocked(page, label: string)

Step 5: Run the test suite.
  Command: npx playwright test

  Run specific files to keep execution time manageable:
    npx playwright test organization-owner-entitlement-gating.spec.ts
    npx playwright test organization-owner-module-health.spec.ts
    npx playwright test organization-owner-unlimited-limits.spec.ts
    npx playwright test organization-owner-crm-leads.spec.ts
    # ... etc

  Target: 100% pass rate for new tests. Fix any failures before proceeding to Phase 4.3.

Step 6: Validation.
  Run: npx playwright test (all new specs)
  Verify:
  - All 15 test files pass
  - No flaky tests (retry if needed, but fix root cause)
  - Tests cover: feature gating, unlimited limits, route guards, API guards,
    module rendering, CRUD operations, mobile responsiveness
  - Test auth works for all three plan levels
  - Test data is cleaned up (or tests use isolated data)

  Also run: npm run typecheck && npm run lint && npm run build

---

Files to Create:
  tests/e2e/fixtures/test-leads.csv
  tests/e2e/fixtures/test-members.csv
  tests/e2e/fixtures/test-document.pdf (small placeholder)
  tests/e2e/helpers/organization-owner.ts
  tests/e2e/organization-owner-entitlement-gating.spec.ts
  tests/e2e/organization-owner-unlimited-limits.spec.ts
  tests/e2e/organization-owner-module-health.spec.ts
  tests/e2e/organization-owner-crm-leads.spec.ts
  tests/e2e/organization-owner-custom-fields-import.spec.ts
  tests/e2e/organization-owner-reports.spec.ts
  tests/e2e/organization-owner-commissions-payroll.spec.ts
  tests/e2e/organization-owner-staff-attendance-leave.spec.ts
  tests/e2e/organization-owner-multi-branch-hr.spec.ts
  tests/e2e/organization-owner-custom-roles.spec.ts
  tests/e2e/organization-owner-corporate.spec.ts
  tests/e2e/organization-owner-revenue-split.spec.ts
  tests/e2e/organization-owner-cross-branch.spec.ts
  tests/e2e/organization-owner-phase3-features.spec.ts
  tests/e2e/organization-owner-api-guards.spec.ts

Key design decisions:
  - Each test file maps to a Phase or feature group — independent and runnable in isolation.
  - Test auth helpers centralize login logic. Use credentials from .env.local.
  - Tests verify BEHAVIOR, not implementation details. Check what the user sees.
  - Unlimited limit tests verify creation succeeds, not that the limit value is -1.
  - API guard tests hit actual endpoints and check HTTP status codes.
  - No test depends on another test's data. Each test sets up its own state.
  - Mobile responsiveness uses viewport configuration, not separate test files.
  - Target: all tests pass consistently. Flaky tests = bugs, not acceptable.
