# QA Phase 2 RBAC Audit Report

Date: 2026-06-11  
Application: Multi-Tenant Gym Management SaaS  
Production URL: https://apexgymmanagementsystem.vercel.app  
Status: Passed for RBAC scope tested

## Executive Summary

The RBAC audit covered page access, route access, menu access, API access, Supabase RLS visibility, multi-tenant isolation, and privilege-escalation attempts for:

- Super Admin
- Organization Owner
- Gym Admin
- Reception Staff
- Trainer
- Member

Final production verification passed:

```text
PLAYWRIGHT_BASE_URL=https://apexgymmanagementsystem.vercel.app npx playwright test rbac-audit.spec.ts --project=chromium

9 passed (5.6m)
```

Production deployment completed successfully:

```text
Deployment: dpl_7imdJouRcF1RjmTWKCFJqJteRXgX
Alias: https://apexgymmanagementsystem.vercel.app
```

## RBAC Inventory

### Protected Portals

| Portal | Route Prefix | Primary Role |
| --- | --- | --- |
| Super Admin Console | `/super-admin` | `super_admin` |
| Organization Owner Portal | `/organization` | `organization_owner` |
| Gym Admin Panel | `/admin` | `gym_admin` |
| Reception Portal | `/reception` | `reception_staff` |
| Trainer Portal | `/trainer` | `trainer` |
| Member Portal | `/member` | `member` |

### API Surfaces Audited

| Endpoint | RBAC Behavior |
| --- | --- |
| `/api/ai/chat` | Member primary role only |
| `/api/ai/recommendations` | Member primary role only |
| `/api/analytics/reports` | Requires report export permission |
| `/api/attendance/reports` | Requires report export permission |
| `/api/billing/razorpay/refunds` | Admin roles only |
| `/api/enterprise/domains/check` | Super Admin, Organization Owner, Gym Admin only |

## Permission Matrix

| Role | Allowed Scope | Explicitly Blocked |
| --- | --- | --- |
| Super Admin | Platform-level SaaS administration, all organizations, all gyms, all branches, users, billing, domains, settings, audit, monitoring | Direct lower-portal workflow access is redirected to `/super-admin` unless a scoped override exists |
| Organization Owner | Own organization, all gyms/branches/staff/trainers/members/revenue/settings in own organization | Other organizations, platform settings, global billing, global analytics, system monitoring |
| Gym Admin | Own gym/branch operations: members, staff, trainers, attendance, memberships, payments, reports, gym settings | Other gyms, organization portal, super-admin pages, reception/trainer/member portals |
| Reception Staff | Assigned-gym front desk workflows: registration, attendance, payments, classes, messages, member support | Analytics, staff management, trainer management, settings, reports, other gyms |
| Trainer | Assigned trainer workflows: assigned members, attendance view, classes, sessions, programs, progress, AI, communications | Member portal, payments, memberships, revenue, staff management, gym settings |
| Member | Own dashboard/profile/membership/payments/attendance/classes/workouts/fitness/notifications/settings | Admin, organization, reception, trainer, super-admin portals, other member data |

## Route Access Matrix

| Role | Allowed Routes Tested | Blocked Routes Tested |
| --- | --- | --- |
| Super Admin | `/super-admin`, `/super-admin/organizations`, `/super-admin/gyms`, `/super-admin/users`, `/super-admin/subscriptions`, `/super-admin/billing`, `/super-admin/domains`, `/super-admin/white-label`, `/super-admin/analytics`, `/super-admin/audit-logs`, `/super-admin/support`, `/super-admin/settings` | `/organization`, `/admin`, `/reception`, `/trainer`, `/member` |
| Organization Owner | `/organization`, `/organization/gyms`, `/organization/staff`, `/organization/members`, `/organization/memberships`, `/organization/revenue`, `/organization/trainers`, `/organization/attendance`, `/organization/classes`, `/organization/communications`, `/organization/analytics`, `/organization/branding`, `/organization/domains`, `/organization/billing`, `/organization/settings`, `/organization/security` | `/super-admin`, `/admin`, `/reception`, `/trainer`, `/member` |
| Gym Admin | `/admin`, `/admin/members`, `/admin/members/new`, `/admin/attendance`, `/admin/classes`, `/admin/fitness`, `/admin/trainers`, `/admin/membership-plans`, `/admin/payments`, `/admin/communications`, `/admin/ai`, `/admin/reports`, `/admin/staff`, `/admin/settings` | `/super-admin`, `/organization`, `/reception`, `/trainer`, `/member` |
| Reception Staff | `/reception`, `/reception/members`, `/reception/register`, `/reception/attendance`, `/reception/payments`, `/reception/classes`, `/reception/messages` | `/super-admin`, `/organization`, `/admin`, `/admin/settings`, `/trainer`, `/member` |
| Trainer | `/trainer`, `/trainer/members`, `/trainer/attendance`, `/trainer/classes`, `/trainer/sessions`, `/trainer/programs`, `/trainer/progress`, `/trainer/ai`, `/trainer/communications` | `/super-admin`, `/organization`, `/admin`, `/reception`, `/member` |
| Member | `/member`, `/member/membership`, `/member/payments`, `/member/attendance`, `/member/classes`, `/member/workouts`, `/member/fitness`, `/member/ai-coach`, `/member/notifications`, `/member/profile`, `/member/settings` | `/super-admin`, `/organization`, `/admin`, `/reception`, `/trainer` |

## RLS Verification Report

Direct Supabase Auth + PostgREST checks confirmed:

| Role | RLS Result |
| --- | --- |
| Super Admin | Sees all seeded organizations, gyms, branches, and branch-user assignments |
| Organization Owner | Sees only `apex-performance-club` organization and owned gyms/branches |
| Gym Admin | Sees only assigned gym/branch and non-privileged branch roster rows |
| Reception Staff | Sees only own branch-user row |
| Trainer | Sees only own branch-user row |
| Member | Sees only own branch-user row |

Seeded isolation tenants used by the test:

- `rbac-qa-organization-b`
- `rbac-qa-organization-c`
- `rbac-qa-apex-second-gym`
- `rbac-qa-gym-b1`
- `rbac-qa-gym-c1`

## Multi-Tenant Isolation Report

Validated protections:

- Organization Owner cannot read other organizations.
- Gym Admin cannot read another gym in the same organization.
- Gym Admin cannot see Super Admin or Organization Owner branch-user assignments.
- Reception, Trainer, and Member cannot enumerate branch rosters.
- Tenant configs are hidden from Gym Admin, Reception, Trainer, and Member.
- Super Admin retains global platform visibility.

## API Security Report

Automated API abuse checks passed:

- Member denied report export.
- Member denied domain verification, including role-spoof payload.
- Member denied refund creation.
- Trainer denied refund creation.
- Trainer denied member AI chat, including role-spoof payload.
- Reception denied attendance report export.
- Reception denied domain verification.
- Gym Admin denied member AI chat.
- Gym Admin reached refund validation and received `400`, proving role gate allowed only admin class access before schema validation.

## Privilege Escalation Report

Attempted route escalation paths:

- Member -> Trainer/Admin/Organization/Super Admin: blocked
- Trainer -> Member/Admin/Reception/Organization/Super Admin: blocked
- Reception -> Trainer/Member/Admin/Organization/Super Admin: blocked
- Gym Admin -> Organization/Super Admin/Reception/Trainer/Member portals: blocked
- Organization Owner -> Super Admin/lower operational portals: blocked
- Super Admin -> lower operational portals: redirected to Super Admin portal

Result: No successful privilege escalation in tested browser/API/RLS paths.

## Export Security Report

Export endpoints tested:

- `/api/analytics/reports?key=executive_kpi_snapshot&format=csv`
- `/api/attendance/reports?type=daily&format=csv`

Lower-privilege roles without export permission were denied with `403`.

## Auto Fixes Applied

### Authorization and Role Guard Fixes

- Added primary-role guards in `lib/auth/guards.ts`.
- Added API primary-role guard in `lib/auth/api-guards.ts`.
- Converted Member portal pages to `requirePrimaryRole(["member"])`.
- Converted member AI APIs to `requireApiPrimaryRole(["member"])`.
- Hardened member AI and feedback server actions against elevated accounts with baseline `member` role.
- Restricted Trainer portal pages to primary trainer access.

### RLS and Tenant Isolation Fixes

Applied Supabase migrations:

- `supabase/migrations/20260611070000_rbac_scope_hardening.sql`
- `supabase/migrations/20260611071000_rbac_gym_policy_alignment.sql`
- `supabase/migrations/20260611072000_rbac_branch_user_visibility.sql`
- `supabase/migrations/20260611073000_rbac_privileged_assignment_visibility.sql`

Key RLS changes:

- Organization-wide access is limited to Organization Owner and Super Admin.
- Gym Admin scope is limited to assigned gym/branch.
- Reception, Trainer, and Member see only their own branch-user assignment.
- Gym Admin cannot see privileged Super Admin or Organization Owner assignment rows.

### Route and Menu Fixes

- Added protected Reception module route shells:
  - `/reception/members`
  - `/reception/register`
  - `/reception/attendance`
  - `/reception/payments`
  - `/reception/classes`
  - `/reception/messages`
- Added shared reception route UI in `features/reception/components/reception-module-page.tsx`.

### UI/Test Stability Fixes

- Blocked service workers in RBAC Playwright tests to prevent PWA offline fallback from masking route guards.
- Added hydration suppression for shared form controls in `components/ui/input.tsx` where Chromium mutates form-control attributes before hydration.
- Fixed duplicate key warning in `features/super-admin/components/super-admin-module-workspace.tsx`.

### Deployment Fixes

- Added `.vercelignore` to prevent uploading `.next`, `node_modules`, and Playwright artifacts to Vercel.

## Playwright Artifacts

Artifacts were generated under:

- `test-results/rbac-audit-production-full-final`
- `test-results/rbac-audit-production-smoke`
- `test-results/rbac-audit-final-rerun`

Artifacts include traces, videos, screenshots, and attached RLS visibility matrix JSON.

## Verification Summary

```text
npm run typecheck
Passed

npm test -- tests/unit/rbac.test.ts tests/unit/tenant-access.test.ts
2 files passed, 14 tests passed

npm run build
Passed, 124 app routes generated

PLAYWRIGHT_BASE_URL=https://apexgymmanagementsystem.vercel.app npx playwright test rbac-audit.spec.ts --project=chromium
9 passed
```

## Security Findings

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| RBAC-001 | High | Elevated accounts with baseline `member` role could potentially satisfy member-only checks unless primary role was enforced | Fixed |
| RBAC-002 | High | Trainer portal allowed broader roles in route guards | Fixed |
| RBAC-003 | High | RLS branch-user visibility allowed lower roles to enumerate branch roster rows | Fixed |
| RBAC-004 | High | Gym Admin could see privileged branch-user assignment rows | Fixed |
| RBAC-005 | Medium | Reception sidebar linked to module routes that did not exist | Fixed |
| RBAC-006 | Low | RBAC suite could be masked by PWA offline fallback when the dev server restarted | Fixed in tests |
| RBAC-007 | Low | Super Admin role matrix rendered duplicate React keys under dev/test data | Fixed |

## Remaining Risks

| Risk | Severity | Notes |
| --- | --- | --- |
| Direct Next Server Action fuzzing was not exhaustively performed by action ID | Medium | Browser/API/RLS checks passed. A future security phase should fuzz serialized Server Action calls directly. |
| Trainer AI page can be slower than other trainer routes under cold production conditions | Low | Final production suite passed with a 90s route timeout. This belongs in performance tuning, not RBAC. |
| Business-module button-level permissions are sampled through menus/routes/API only | Medium | Full workflow button-by-button testing should occur in business module QA phases. |

## Final Recommendation

RBAC Phase 2 status: GO for QA Phase 3 Super Admin business testing.

The tested RBAC, route, API, RLS, and multi-tenant isolation controls are stable in production for the six-role hierarchy.
