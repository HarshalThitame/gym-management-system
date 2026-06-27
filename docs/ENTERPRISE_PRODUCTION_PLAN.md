# Enterprise Production-Ready Buildout Plan

> **Last updated:** 2026-06-27
> **Target:** All paid features in Growth/Enterprise packages have real modules/pages/APIs
> **Scope:** Organization Owner panel only
> **Status:** Sessions 1-20 **COMPLETE** · Sessions 21-23 remaining (polish, testing, hardening)

## Completion Summary

| Phase | Sessions | Status |
|-------|----------|--------|
| Phase 1.1 — Remove Phantom Features | Session 1 | ✅ Complete |
| Phase 1.2 — Leads Dashboard | Session 2 | ✅ Complete |
| Phase 1.3 — Custom Member Fields + Import/Export | Session 3 | ✅ Complete |
| Phase 1.4 — Dedicated Report Pages | Session 4 | ✅ Complete |
| Phase 1.5 — Trainer Commissions + Payroll | Session 5 | ✅ Complete (service files extracted) |
| Phase 2.1 — Staff Attendance & Leave | Session 6 | ✅ Complete (service files extracted) |
| Phase 2.2 — Multi-Branch Staff + HR Docs | Session 7 | ✅ Complete |
| Phase 2.3 — Custom Roles & Permissions | Session 8 | ✅ Complete |
| Phase 2.4 — Corporate / Bulk Memberships | Session 9 | ✅ Complete |
| Phase 2.5 — Revenue Split | Session 10 | ✅ Complete |
| Phase 2.6 — Cross-Branch Member Access | Session 11 | ✅ Complete |
| Phase 3.1 — Cross-Branch Class Booking | Session 12 | ✅ Complete |
| Phase 3.2 — Network Calendar + Trainer Sharing | Session 13 | ✅ Complete |
| Phase 3.3 — Lead Pipeline & Re-engagement | Session 14 | ✅ Complete |
| Phase 3.4 — Referral Program | Session 15 | ✅ Complete |
| Phase 3.5 — Loyalty Points System | Session 16 | ✅ Complete |
| Phase 3.6 — Campaign Manager | Session 17 | ✅ Complete |
| Phase 3.7 — NPS Surveys | Session 18 | ✅ Complete |
| Phase 3.8 — Custom Dashboards + Reports + Equipment | Session 19 | ✅ Complete (CustomizableDashboard wired in workspace) |
| Phase 3.9 — Google Calendar Sync + Webhooks | Session 20 | ✅ Complete |
| Phase 4.1 — Package Sync & Entitlement Cleanup | Session 21 | ⏳ Pending |
| Phase 4.2 — E2E Testing | Session 22 | ⏳ Pending |
| Phase 4.3 — Final Validation & Hardening | Session 23 | ⏳ Pending |

---

## Core Principles

1. **Only build what we sell.** Every `package_features` entry must have a real module/page/API.
2. **Remove or roadmap features we won't build.** Honest packaging — no phantom features.
3. **All gating through the entitlement pipeline.** `package_features` → `activeFeatureKeys` → sidebar/route/API guards. No hardcoded bypasses.
4. **Every module gets:** sidebar entry, route, server action(s), API guard, UI component, test.
5. **Unlimited limits must never block creation.** Already verified — no fixes needed.
6. **Build stays green.** typecheck/lint/build pass after every session.

---

## Features to REMOVE from Packages (17 total)

These are removed because they are: infrastructure/service/contractual features (not software), impractical scope, or franchise (business model not built).

| # | Feature Key | Package | Reason |
|---|-------------|---------|--------|
| 1 | `multi_currency_billing` | Enterprise | Entire codebase hardcoded INR. Impractical scope for gym SaaS. |
| 2 | `white_label_mobile_app` | Enterprise | Requires iOS/Android app build pipeline — separate product. |
| 3 | `sso_saml_login` | Enterprise | Requires identity provider integrations. Massive auth refactor. |
| 4 | `dedicated_cloud_infrastructure` | Enterprise | Operational/infrastructure concern. Not a software module. |
| 5 | `dedicated_onboarding_manager` | Enterprise | Human service, not software. |
| 6 | `named_account_manager` | Enterprise | Human service, not software. |
| 7 | `response_sla` | Enterprise | Contractual metric, not a software module. |
| 8 | `uptime_sla_99_9` | Enterprise | Contractual metric, not a software module. |
| 9 | `staff_training_sessions` | Enterprise | Human service, not software. |
| 10 | `custom_feature_requests` | Enterprise | Process/roadmap, not software. |
| 11 | `automated_backups_90_day_retention` | Enterprise | Supabase-managed infrastructure. |
| 12 | `face_recognition_attendance` | Enterprise | Requires ML/CV pipeline. Impractical for web-based gym management. |
| 13 | `pos_merchandise_supplements` | Enterprise | Full POS system scope. Separate module not planned. |
| 14 | `franchise_management` | Enterprise | No franchise business model built. Entirely different product scope. |
| 15 | `franchise_fee_management` | Enterprise | Depends on franchise management. |
| 16 | `franchise_rollup_reports` | Enterprise (+Growth) | Served by Analytics/branch_revenue_comparison. |
| 17 | `franchise_rollup_dashboard` | Enterprise | Served by Analytics. |

---

## Features to ROADMAP (Keep in package, build later)

| # | Feature Key | Target |
|---|-------------|--------|
| 1 | `tally_zoho_books_integration` | Q1 next year |
| 2 | `biometric_attendance` (recording logic) | Q4 this year (hardware-dependent) |
| 3 | `digital_membership_card` | Q4 this year |
| 4 | `in_app_push_notifications` (native) | Q4 this year (PWA push exists) |
| 5 | `loyalty_rewards_in_app` | Q1 next year (needs mobile app) |

---

## Detailed Session Plan

Each session is a self-contained unit of work. Start each new session with:

```
Continue from ENTERPRISE_PRODUCTION_PLAN.md Phase X.Y
Last completed: Phase X.Y-1
Files changed in previous session: [list]
Current state: typecheck/lint/build clean
```

---

## Phase 1: Foundation & Critical Gaps — Sessions 1-5

### Session 1: Phase 1.1 — Remove Phantom Features from Packages

**Goal:** Remove 17 features from package seed migrations and feature-definitions. Zero code is built — this is purely cleanup of marketing promises that have no implementation.

**Files to change:**
- `supabase/migrations/20260627000000_enterprise_package_update.sql` — remove 17 entries from the INSERT
- `supabase/migrations/20260626000000_growth_package_update.sql` — remove applicable entries (franchise_rollup_reports = false)
- `features/subscription/feature-definitions.ts` — remove 17 entries from FEATURE_CATEGORIES
- `features/entitlement/feature-registry.ts` — assess if any of the 17 keys need removal from FEATURE_KEYS (probably keep for backward compat)

**Verification:**
- [ ] All 17 feature keys removed from Enterprise package INSERT
- [ ] All 17 features removed from feature-definitions.ts FEATURE_CATEGORIES
- [ ] No references to removed keys remain in feature-definitions
- [ ] typecheck passes
- [ ] lint passes
- [ ] build passes
- [ ] tests pass (no new failures)

**Duration:** ~30 min

---

### Session 2: Phase 1.2 — CRM / Leads Dashboard (P0)

**Goal:** Build a full CRM module for Organization Owners. Public lead capture API exists but no management UI.

**Current state:**
- Public lead capture API at `app/api/leads/route.ts` (POST only)
- `leads` table exists in DB
- No Org panel UI for managing leads
- No sidebar entry for leads
- Feature key `lead_management` registered but unlocks no module

**Deliverables:**
1. New sidebar module: **Leads** at `/organization/leads`
2. Add module to `organization-owner-modules.tsx`:
   ```ts
   {
     slug: "leads",
     href: "/organization/leads",
     label: "Leads",
     featureKey: "lead_management" as FeatureKey,
   }
   ```
3. Add to `MODULE_FEATURE_MAP`: `"leads": "lead_management"`
4. `LeadsModule.tsx` — lead list with search, status filter, source filter, date range, pagination
5. Lead detail panel — full info, notes, status change, convert-to-member action
6. `lead-actions.ts` — GET leads, UPDATE lead status, DELETE lead, CONVERT to member
7. `features/organization-owner/services/lead-service.ts` — Supabase queries
8. Extend `app/api/leads/route.ts` with GET (list), PUT (update), DELETE
9. Dashboard card update — "New Leads This Month" KPI in enterprise dashboard
10. All server actions gated with `requireOrgFeatureAccess("lead_management")`

**DB changes:** None (leads table exists)

**Files to create:**
- `features/organization-owner/components/modules/LeadsModule.tsx`
- `features/organization-owner/actions/lead-actions.ts`
- `features/organization-owner/services/lead-service.ts`

**Files to modify:**
- `features/organization-owner/lib/organization-owner-modules.tsx` — add leads module
- `features/entitlement/feature-registry.ts` — add `"leads": "lead_management"` to MODULE_FEATURE_MAP
- `features/organization-owner/components/organization-owner-workspace.tsx` — add LeadsModule import
- `features/organization-owner/services/module-data-resolver.ts` — add leads resolver
- `app/api/leads/route.ts` — extend with GET/PUT/DELETE
- `features/organization-owner/components/enterprise-dashboard.tsx` — add leads KPI

**Verification:**
- [ ] Leads visible in sidebar when `lead_management` is in activeFeatureKeys
- [ ] Lead list renders with data
- [ ] Lead detail panel opens
- [ ] Status change works
- [ ] Convert-to-member creates member record
- [ ] Leads module NOT visible in sidebar for Starter plan
- [ ] Direct URL `/organization/leads` redirects to locked page for Starter
- [ ] API returns 403 for Starter plan on PUT/DELETE
- [ ] typecheck, lint, build pass
- [ ] 2-3 Playwright E2E specs

**Duration:** ~2-3 hours

---

### Session 3: Phase 1.3 — Custom Member Fields + Import/Export (P0)

**Goal:** Enable Org Owners to define custom profile fields and bulk import/export members.

**Deliverables:**

**Part A: Custom Member Fields**
1. New DB table: `custom_member_fields`
   - `id` (uuid PK), `organization_id` (uuid FK), `field_name` (text), `field_type` (text: text/number/date/select), `options` (jsonb, for select type), `required` (bool), `sort_order` (int), `is_active` (bool), timestamps
2. `CustomMemberFieldsPanel.tsx` — field CRUD (inline table in Members module)
3. Server action: `saveCustomField`, `deleteCustomField`
4. Member form updated to render dynamic fields
5. Member detail shows custom field values

**Part B: Member Import**
1. CSV upload with drag-and-drop
2. Column mapping wizard — map CSV columns to system fields + custom fields
3. Validation preview — show rows with errors before import
4. Bulk insert with error handling per row
5. Import history log

**Part C: Member Export**
1. Export current filtered view as CSV
2. Include custom fields in export
3. Include all system fields

**Files to create:**
- `supabase/migrations/YYYYMMDD_create_custom_member_fields.sql`
- `features/organization-owner/components/modules/MemberImportExport.tsx`
- `features/organization-owner/components/modules/CustomMemberFieldsPanel.tsx`
- `features/organization-owner/actions/member-field-actions.ts`
- `features/organization-owner/actions/member-import-actions.ts`

**Files to modify:**
- `features/organization-owner/components/modules/MembersModule.tsx` — add import/export buttons, custom fields panel
- `features/organization-owner/actions/member-actions.ts` — support custom fields in create/update
- `app/api/members/import/route.ts` — POST import endpoint

**Verification:**
- [ ] Custom fields CRUD works
- [ ] Custom fields appear in member form
- [ ] CSV import with mapping works
- [ ] CSV export includes all fields
- [ ] typecheck, lint, build pass

**Duration:** ~3-4 hours

---

### Session 4: Phase 1.4 — Dedicated Report Pages (P0)

**Goal:** Build standalone report pages for 4 reports that have feature keys but no dedicated UI.

**Deliverables:**

1. **Trainer Performance Report** (`/organization/analytics?tab=trainer-performance`)
   - Sessions taught per trainer, PT bookings, member ratings
   - Date range filter, trainer filter
   - Chart: bar chart per trainer, trend line
   - Export as CSV

2. **Class Occupancy Report** (`/organization/analytics?tab=class-occupancy`)
   - Fill rate per class type/slot/time
   - Under-performing slots highlighted
   - Chart: occupancy % by class type
   - Export as CSV

3. **Lead Conversion Report** (`/organization/analytics?tab=lead-conversion`)
   - Enquiry → Trial → Paid conversion funnel
   - Conversion rate per source/channel
   - Chart: funnel visualization
   - Export as CSV

4. **Branch Revenue Comparison** (`/organization/analytics?tab=branch-revenue`)
   - Side-by-side revenue by branch
   - Member count, attendance per branch
   - Chart: grouped bar chart, sparklines
   - Export as CSV

**Files to create:**
- `features/organization-owner/components/modules/reports/TrainerPerformanceReport.tsx`
- `features/organization-owner/components/modules/reports/ClassOccupancyReport.tsx`
- `features/organization-owner/components/modules/reports/LeadConversionReport.tsx`
- `features/organization-owner/components/modules/reports/BranchRevenueReport.tsx`
- `features/organization-owner/services/report-service.ts`

**Files to modify:**
- `features/organization-owner/components/modules/AnalyticsModule.tsx` — add tabs
- `app/api/analytics/reports/route.ts` — extend with new report types
- `app/api/classes/reports/route.ts` — extend
- `app/api/training/reports/route.ts` — extend

**Verification:**
- [ ] All 4 reports render with data
- [ ] Date filters work
- [ ] Charts render correctly
- [ ] CSV export works for each
- [ ] typecheck, lint, build pass

**Duration:** ~3 hours

---

### Session 5: Phase 1.5 — Trainer Commissions + Payroll (P0)

**Goal:** Build commission tracking and payroll export for trainers.

**Deliverables:**

**Part A: Trainer Commission Tracking**
1. New DB table: `trainer_commissions`
   - `id` (uuid PK), `trainer_id` (uuid FK), `organization_id` (uuid FK), `source_type` (pt_session/class/membership_sale), `source_id` (uuid), `amount` (int, paise), `rate` (decimal), `calculated_at` (timestamptz), `paid_at` (timestamptz nullable), status enum
2. Commission calculation engine — auto-calculate on PT session completion, class teaching
3. `TrainerCommissionPanel.tsx` — commission dashboard, per-trainer breakdown, period filter, status filter (calculated/pending/paid)
4. Commission rate configuration — set per-trainer percentage
5. Mark commissions as paid

**Part B: Payroll Export**
1. `PayrollModule.tsx` — monthly payroll summary
   - Base salary (from trainer profile)
   - Commissions (from trainer_commissions)
   - Deductions (configurable)
   - Net payable
2. Export as CSV and PDF (using existing pdf-lib)
3. New sidebar tab in Trainers module or separate Payroll module

**Files to create:**
- `supabase/migrations/YYYYMMDD_create_trainer_commissions.sql`
- `features/organization-owner/components/modules/TrainerCommissionPanel.tsx`
- `features/organization-owner/components/modules/PayrollModule.tsx`
- `features/organization-owner/actions/commission-actions.ts`
- `features/organization-owner/actions/payroll-actions.ts`
- `features/organization-owner/services/commission-service.ts`
- `features/organization-owner/services/payroll-service.ts`

**Files to modify:**
- `features/training/actions/training-actions.ts` — trigger commission calc on PT session complete
- `features/classes/actions/class-actions.ts` — trigger commission calc on class attendance
- `features/organization-owner/components/modules/TrainersModule.tsx` — add commission/payroll tabs

**Verification:**
- [ ] Commission auto-calculated on PT session completion
- [ ] Commission auto-calculated on class teaching
- [ ] Commission dashboard shows per-trainer breakdown
- [ ] Payroll summary calculates correctly
- [ ] PDF export generates valid payroll report
- [ ] typecheck, lint, build pass

**Duration:** ~4 hours

---

## Phase 2: Core Feature Buildout — Sessions 6-11

### Session 6: Phase 2.1 — Staff Attendance & Leave Tracking (P1)

**Goal:** Enable clock-in/out tracking and leave management for staff.

**Deliverables:**
1. New DB table: `staff_attendance`
   - `id`, `staff_id`, `branch_id`, `organization_id`, `clock_in` (timestamptz), `clock_out` (timestamptz nullable), `duration_minutes` (generated), `date` (date), timestamps
2. New DB table: `staff_leave_requests`
   - `id`, `staff_id`, `organization_id`, `leave_type` (sick/casual/annual/other), `start_date`, `end_date`, `reason`, `status` (pending/approved/rejected), `approver_id`, timestamps
3. `StaffAttendancePanel.tsx` — daily log, clock-in/out buttons, monthly summary
4. Leave request form and approval workflow
5. Monthly attendance report (present days, absent days, late counts)
6. Sub-tab in Staff module

**Feature keys used:** `staff_attendance_leave`

**Files to create:**
- `supabase/migrations/YYYYMMDD_create_staff_attendance_leave.sql`
- `features/organization-owner/components/modules/StaffAttendancePanel.tsx`
- `features/organization-owner/components/modules/StaffLeavePanel.tsx`
- `features/organization-owner/actions/staff-attendance-actions.ts`
- `features/organization-owner/services/staff-attendance-service.ts`

**Files to modify:**
- `features/organization-owner/components/modules/StaffModule.tsx` — add tabs

**Verification:**
- [ ] Clock-in/out works
- [ ] Leave request flow works (submit → approve/reject)
- [ ] Monthly report accurate
- [ ] typecheck, lint, build pass

**Duration:** ~3 hours

---

### Session 7: Phase 2.2 — Multi-Branch Staff Assignment + HR Docs (P1)

**Goal:** Assign staff to multiple branches and store HR documents.

**Deliverables:**

**Part A: Multi-Branch Assignment**
1. Update `branch_users` to support many-to-many (or use a junction table)
2. `StaffAssignmentPanel.tsx` — assign staff to branches, view per-branch hours, conflict indicator
3. Conflict prevention — cannot assign same person to two branches at overlapping times

**Part B: HR Document Storage**
1. New DB table: `hr_documents`
   - `id`, `staff_id`, `organization_id`, `doc_type`, `file_url`, `file_name`, `expiry_date`, timestamps
2. Supabase Storage bucket: `hr-documents`
3. `HRDocumentsPanel.tsx` — upload, preview, expiry alerts
4. Sub-tab in Staff module

**Feature keys used:** `multi_branch_staff_assignment`, `hr_document_storage`

**Files to create:**
- `supabase/migrations/YYYYMMDD_create_hr_documents.sql` (branch_users may not need migration)
- `features/organization-owner/components/modules/StaffAssignmentPanel.tsx`
- `features/organization-owner/components/modules/HRDocumentsPanel.tsx`
- `features/organization-owner/actions/hr-actions.ts`

**Files to modify:**
- `features/organization-owner/components/modules/StaffModule.tsx` — add tabs
- `features/organization-owner/actions/staff-actions.ts` — multi-branch support

**Verification:**
- [ ] Staff assigned to multiple branches
- [ ] HR documents uploadable
- [ ] Expiry alerts show
- [ ] typecheck, lint, build pass

**Duration:** ~2-3 hours

---

### Session 8: Phase 2.3 — Custom Roles & Granular Permissions (P1)

**Goal:** Build a role builder UI for creating custom roles with per-resource permissions.

**Deliverables:**
1. New DB table: `custom_roles` (role_name, organization_id, permissions jsonb)
2. `CustomRolesModule.tsx` — list, create, edit, delete custom roles
   - Permission matrix UI — checkboxes for each resource:action
   - Clone from existing role
3. Extend `rbac.ts` to check custom roles (merge with built-in ROLE_PERMISSIONS)
4. Assign custom roles to staff (extend branch_users or profiles)
5. Feature gated behind `custom_roles_granular_permissions`

**Feature keys used:** `custom_roles_granular_permissions`

**Files to create:**
- `supabase/migrations/YYYYMMDD_create_custom_roles.sql`
- `features/organization-owner/components/modules/CustomRolesModule.tsx`
- `features/organization-owner/actions/custom-roles-actions.ts`

**Files to modify:**
- `lib/rbac.ts` — add `getCustomRolePermissions()`
- `features/organization-owner/lib/organization-owner-modules.tsx` — maybe new module or sub-tab
- `features/entitlement/feature-registry.ts` — ensure MODULE_FEATURE_MAP includes mapping

**Verification:**
- [ ] Custom role CRUD works
- [ ] Permissions enforced correctly
- [ ] Custom roles assignable to staff
- [ ] typecheck, lint, build pass

**Duration:** ~3 hours

---

### Session 9: Phase 2.4 — Corporate / Bulk Memberships (P1)

**Goal:** Enable company tie-ups for employee memberships.

**Deliverables:**
1. New DB table: `corporate_accounts`
   - `id`, `organization_id`, `company_name`, `contact_person`, `contact_email`, `contact_phone`, `discount_percentage`, `billing_email`, timestamps
2. Link members to corporate_account_id
3. `CorporateMembershipsModule.tsx` — company profile, employee member list, bulk add employees, company-level invoicing
4. New sidebar entry or tab in Members module

**Feature keys used:** `corporate_bulk_memberships`

**Files to create:**
- `supabase/migrations/YYYYMMDD_create_corporate_accounts.sql`
- `features/organization-owner/components/modules/CorporateMembershipsModule.tsx`
- `features/organization-owner/actions/corporate-actions.ts`

**Files to modify:**
- Members table — add corporate_account_id FK
- `features/organization-owner/lib/organization-owner-modules.tsx` — maybe new module

**Verification:**
- [ ] Corporate account CRUD works
- [ ] Bulk member creation works
- [ ] Company-level invoicing shows
- [ ] typecheck, lint, build pass

**Duration:** ~2-3 hours

---

### Session 10: Phase 2.5 — Franchise Fee Management + Revenue Split (P1)

**Goal:** **FRANCHISE keys already REMOVED in Phase 1.1.** This session builds revenue split only.

**Note:** `franchise_fee_management` was removed. This session builds `branch_revenue_split`.

**Deliverables:**
1. Revenue attribution — track which branch earned which payment
2. `RevenueSplitConfig.tsx` — configure split rules (by percentage, by fixed amount)
3. `RevenueSplitReport.tsx` — view revenue split by branch
4. Integration with Revenue module

**Feature keys used:** `branch_revenue_split`

**Files to create/change:**
- `features/organization-owner/components/modules/RevenueSplitPanel.tsx`
- Extend RevenueModule.tsx

**Verification:**
- [ ] Revenue split configured
- [ ] Reports show correct split
- [ ] typecheck, lint, build pass

**Duration:** ~2 hours

---

### Session 11: Phase 2.6 — Cross-Branch Member Access (P1)

**Goal:** Configure which branches members can access and enforce at check-in.

**Deliverables:**
1. New DB table: `cross_branch_access_rules`
   - `id`, `organization_id`, `member_id` (nullable — if null, applies to all), `from_branch_id`, `to_branch_id`, `is_allowed` (bool)
2. Default rule: members can access all branches within org if feature enabled
3. `CrossBranchAccessPanel.tsx` — per-member rules, bulk rules, access log
4. Member check-in validates access (extend attendance-actions)

**Feature keys used:** `cross_branch_member_access`

**Files to create:**
- `supabase/migrations/YYYYMMDD_create_cross_branch_access.sql`
- `features/organization-owner/components/modules/CrossBranchAccessModule.tsx`
- `features/organization-owner/actions/cross-branch-actions.ts`

**Files to modify:**
- `features/attendance/actions/attendance-actions.ts` — validate access on check-in
- `features/organization-owner/components/modules/BranchesModule.tsx` — sub-tab or separate

**Verification:**
- [ ] Access rules CRUD works
- [ ] Check-in blocked for unauthorized branches
- [ ] Access log shows entries
- [ ] typecheck, lint, build pass

**Duration:** ~2 hours

---

## Phase 3: Advanced Enterprise — Sessions 12-20

### Session 12: Phase 3.1 — Class Scheduling: Cross-Branch Booking (P1)

**Deliverables:**
- Extend class booking to allow member booking at any branch
- Update `class_booking` to include branch_id
- Conflict check across branches
- Feature gated behind `cross_branch_class_booking`

**Duration:** ~2 hours

---

### Session 13: Phase 3.2 — Network-Wide Class Calendar + Trainer Sharing (P1)

**Deliverables:**
- Unified calendar view showing all classes across all branches
- Trainer assignment to multiple branches with conflict prevention
- Feature gated behind `network_wide_class_calendar`, `trainer_sharing_across_branches`

**Duration:** ~2-3 hours

---

### Session 14: Phase 3.3 — CRM: Lead Follow-up + Re-engagement + Pipeline (P1)

**Deliverables:**
- Lead pipeline stages (New → Contacted → Trial → Won/Lost)
- Follow-up task creation with reminders
- Re-engagement automation (auto-message inactive leads after N days)
- Lead scoring
- Extends LeadsModule from Phase 1.2

**Duration:** ~3 hours

---

### Session 15: Phase 3.4 — Referral Program (P1)

**Deliverables:**
- Referral code generation per member
- Referral tracking (who referred whom)
- Reward configuration (discount on renewal)
- Feature gated behind `referral_program`

**Duration:** ~2-3 hours

---

### Session 16: Phase 3.5 — Loyalty Points System (P1)

**Deliverables:**
- Points earning rules (per check-in, renewal, referral)
- Points redemption (discount on renewal)
- Configuration UI
- Feature gated behind `loyalty_points_system`

**Duration:** ~2-3 hours

---

### Session 17: Phase 3.6 — Network-Wide Campaign Manager (P1)

**Deliverables:**
- Campaign targeting across branches and member segments
- Multi-channel orchestration (email + WhatsApp + SMS)
- Campaign analytics
- Extends Communications module
- Feature gated behind `network_wide_campaign_manager`

**Duration:** ~2-3 hours

---

### Session 18: Phase 3.7 — Member NPS Surveys (P1)

**Deliverables:**
- Standalone survey builder (not just post-ticket)
- Auto-trigger rules (after joining, after class, etc.)
- NPS dashboard with trend analysis
- Feature gated behind `member_nps_surveys`

**Duration:** ~2 hours

---

### Session 19: Phase 3.8 — Custom Dashboards + Scheduled Reports + Equipment (P1)

**Deliverables:**

**Part A: Custom Dashboards & KPIs**
- Widget-based dashboard builder (drag-and-drop)
- Save and share custom layouts
- KPI picker
- Feature gated behind `custom_dashboards_kpis`

**Part B: Scheduled Report Delivery**
- Report schedule config (weekly/monthly, day, time, recipients)
- Auto-generate and email PDF reports
- Feature gated behind `scheduled_report_delivery`

**Part C: Equipment Inventory**
- Equipment CRUD (name, type, purchase date, warranty, service dates, branch)
- Service schedule and AMC expiry alerts
- Feature gated behind `equipment_inventory_maintenance`

**Duration:** ~3-4 hours

---

### Session 20: Phase 3.9 — Google Calendar Sync + Webhook Management (P1)

**Deliverables:**

**Part A: Google Calendar Sync**
- OAuth2 integration with Google Calendar API
- Class schedule → Google Calendar sync
- Per-trainer calendar sync
- Feature gated behind `google_calendar_sync`

**Part B: Webhook Management**
- Webhook config UI (URL, events, secret)
- Webhook event log viewer
- Test webhook button
- Feature gated behind `webhooks`

**Duration:** ~3 hours

---

## Phase 4: Polish, Testing & Hardening — Sessions 21-23

### Session 21: Phase 4.1 — Package Sync & Entitlement Cleanup

**Deliverables:**
- Run `syncOrganizationEntitlements` to ensure org_entitlements matches package_features
- Add Super Admin "Feature Audit" report page comparing package features vs app implementation
- Add compile-time or runtime check that all package_features have a registered FeatureKey
- Clean up any stale references to removed franchise keys

**Duration:** ~2 hours

---

### Session 22: Phase 4.2 — E2E Testing

**Deliverables:**
- Playwright specs for every new module (15+ new spec files)
- Test scenarios: feature locked for Starter, unlocked for Growth/Enterprise
- Unlimited limit tests (can create resources without LIMIT_REACHED)
- Route guard tests (direct URL access for locked features redirects)
- Mobile responsive test pass

**Duration:** ~3-4 hours

---

### Session 23: Phase 4.3 — Final Validation & Hardening

**Deliverables:**
- Run full test suite (Vitest + Playwright)
- Performance audit (lighthouse, bundle size)
- Security audit (all server actions gated, all APIs guarded)
- Accessibility pass
- Production build verification
- Write final audit report

**Duration:** ~2-3 hours

---

## Quick Reference: Module → Feature Key Mapping

| Module | Feature Key | Sidebar Label | Phase Built |
|--------|-------------|---------------|-------------|
| branches | `multi_branch_management` | Branches | Existing |
| staff | `staff_management` | Staff | Existing |
| members | `member_management` | Members | Existing |
| memberships | `member_management` | Memberships | Existing |
| revenue | `billing_invoices` | Revenue | Existing |
| trainers | `trainer_management` | Trainers | Existing |
| attendance | `attendance_reports` | Attendance | Existing |
| classes | `class_booking` | Classes | Existing |
| communications | `whatsapp_integration` | Communications | Existing |
| analytics | `advanced_reports` | Analytics | Existing |
| branding | `custom_branding` | Branding | Existing |
| domains | `custom_domain` | Domains | Existing |
| nutrition | `nutrition_plans` | Nutrition | Existing |
| security | `audit_logs` | Security | Existing |
| **leads** | **`lead_management`** | **Leads** | **Session 2** |
| **equipment** | **`equipment_inventory_maintenance`** | **Equipment** | **Session 19** |

---

## Commands Reference

After every session, run:

```bash
npm run typecheck    # Must pass with 0 errors
npm run lint         # 0 new errors (pre-existing warnings OK)
npm run build        # Must complete successfully
npm test             # No new test failures
```

---

## How to Resume a Session

Start each session with this template:

```
Continue from ENTERPRISE_PRODUCTION_PLAN.md
Phase: X.Y — [Phase Name]
Last completed session: Phase X.Y-1 — [Previous Phase Name]
Files changed in previous session: [list file paths]
Current project state: typecheck/lint/build all pass, N test files pass
Now begin Phase X.Y.
```

I will re-read the relevant files to re-establish context and continue from where the plan left off.
