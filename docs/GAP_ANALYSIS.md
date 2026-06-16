# Gap Analysis: Gym → Branch/Location Migration

## CRITICAL (Fix Now — Will Cause Errors)

| # | Gap | Severity | File(s) | Impact |
|---|---|---|---|---|
| C1 | `/organization/gyms` navigation links cause 404 | CRITICAL | `enterprise-dashboard.tsx`, `use-keyboard-shortcuts.tsx`, `organization-owner-workspace.tsx` | Users clicking "Create Gym" get 404 |
| C2 | `maxGyms` still in plan context | CRITICAL | `plan-context.ts`, `feature-flags.ts`, `feature-resolver.ts` | Usage limits may use wrong field |
| C3 | Module resolver doesn't handle "branches" slug for member/trainer/attendance data | CRITICAL | `module-data-resolver.ts` | Branch-filtered data won't load |

## HIGH (Must Fix for Consistency)

| # | Gap | Severity | File(s) | Impact |
|---|---|---|---|---|
| H1 | Admin layout says "Gym Admin Panel" / "Gym Operations Dashboard" | HIGH | `app/(admin)/admin/layout.tsx` | Confusing branding |
| H2 | Admin settings page says "Gym Settings" / "Gym" | HIGH | `app/(admin)/admin/settings/page.tsx` | Confusing UI labels |
| H3 | Admin dashboard says "Gym Settings" button | HIGH | `app/(admin)/admin/page.tsx` | Wrong label |
| H4 | Reception pages say "assigned-gym" | HIGH | `app/(reception)/reception/*.tsx` (7+ files) | Wrong terminology |
| H5 | Org Owner dashboard has "Total Gyms" KPI | HIGH | `customizable-dashboard.tsx` | Wrong metric label |
| H6 | Module filter labels say "Gym" (in members, trainers, classes, memberships, attendance, staff, nutrition, communications) | HIGH | 15+ module files | Wrong filter labels |
| H7 | Staff module says "Gym Admin" / "Gym Admins" | HIGH | `StaffModule.tsx` | Wrong role label |
| H8 | Super Admin dashboard says "Gyms" | HIGH | `super-admin-dashboard.tsx`, `super-admin-module-workspace.tsx` | Wrong stat labels |
| H9 | Super Admin org detail shows "Gyms" | HIGH | `app/(super-admin)/super-admin/organizations/[organizationId]/page.tsx` | Wrong label |
| H10 | API route still at `/api/super-admin/gyms/export` | HIGH | `app/api/super-admin/gyms/export/route.ts` | Inconsistent path |

## MEDIUM (Should Fix)

| # | Gap | Severity | File(s) | Impact |
|---|---|---|---|---|
| M1 | `gymId` in TenantContext type | MEDIUM | `lib/tenant/context.ts`, `lib/tenant/header-protocol.ts` | Internal code consistency |
| M2 | `gym_access` feature key | MEDIUM | `features/memberships/lib/feature-catalog.ts` | Feature entitlement key |
| M3 | Domain routing "gym" option | MEDIUM | `domain-dashboard.tsx`, `types/enterprise.ts` | Domain UI |
| M4 | `dashboardScopes = ["private", "role", "gym"]` | MEDIUM | `types/analytics.ts` | Type consistency |

## LOW (Nice to Have)

| # | Gap | Severity | File(s) | Impact |
|---|---|---|---|---|
| L1 | Public site "Gym" in marketing copy | LOW | `data/site.ts`, public pages | Branding |
| L2 | PDF exports say "Apex Gym Management" | LOW | `lib/invoice-pdf.ts`, `lib/pdf-export.ts` | Invoices |
| L3 | Email templates say "gym" | LOW | `emails/*.ts` | Communications |
| L4 | Project name in package.json | LOW | `package.json` | Metadata |
