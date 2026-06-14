# Organization Owner Portal — Module & Architecture Analysis

## Overview

The Organization Owner is the **tenant-level executive** who manages one organization (single gym, multi-branch, or franchise). They sit between Super Admin (platform) and Gym Admin (operations).

```
Super Admin
  -> Organization Owner  ← YOU ARE HERE
    -> Gym Admin
      -> Reception Staff / Trainer / Member
```

- Route prefix: `/organization`
- Role: `organization_owner`
- Primary access helper: `requireOrganizationOwner()` → resolves `organizationId`
- Document reference: `docs/45-organization-owner-role-design.md`

---

## Existing Code Structure (already built)

### Routes (app/(organization-owner)/organization/)

| Route | File | Status |
|-------|------|--------|
| `/organization` | `page.tsx` | **Done** — Dashboard with KPI cards, branch performance, recent activity, security alerts |
| `/organization/plan` | `plan/page.tsx` | **Done** — Subscription plan management, usage bars, add-ons, plan comparison |
| `/organization/billing` | `billing/page.tsx` | **Done** — Billing overview with tabs (overview/invoices/payment-methods) |
| `/organization/billing/history` | (empty dir) | Stub only |
| `/organization/billing/invoices` | (empty dir) | Stub only |
| `/organization/billing/payment-methods` | (empty dir) | Stub only |
| `/organization/[module]` | not found | **Not yet created** — catch-all module page similar to super-admin |

### Feature Module (features/organization-owner/)

| File | Purpose |
|------|---------|
| `lib/access.ts` | `requireOrganizationOwner()` — auth guard that resolves org scope |
| `lib/organization-owner-modules.tsx` | 15 module definitions + nav items (Dashboard, Plan, Gyms, Staff, Members, Memberships, Revenue, Trainers, Attendance, Classes, Communications, Analytics, Branding, Domains, Billing, Settings, Security) |
| `services/organization-owner-service.ts` | `getOrganizationOwnerDashboard()` — fetches ALL dashboard data in parallel (28 queries) |
| `components/organization-owner-workspace.tsx` | Main dashboard view + 15 module sub-components (read-only KPI views) |
| `components/OrgSubscriptionManagement.tsx` | Full subscription/plan management client component |

---

## Module Inventory (19 total)

### A. Dashboard / Executive

| # | Module | Route | Already Built? | Notes |
|---|--------|-------|----------------|-------|
| 1 | **Dashboard** | `/organization` | ✅ Yes | KPIs (gyms, branches, staff, trainers, members, revenue, attendance, security alerts), top branches, recent activity |
| 2 | **Organization Profile** | `/organization/profile` | ❌ Not built | Edit org name, logo, contact, GST, address, business/legal info |

### B. Operations

| # | Module | Route | Already Built? | Notes |
|---|--------|-------|----------------|-------|
| 3 | **Gym Management** | `/organization/gyms` | ✅ Read-only view | KPI cards + branch list; CRUD + activate/deactivate actions missing |
| 4 | **Branch Management** | `/organization/branches` | ❌ Not built | Separate branch-focused view (currently lumped under Gyms) |
| 5 | **Staff Management** | `/organization/staff` | ✅ Read-only view | Stats + recent staff list; invite/edit/deactivate/assign actions missing |
| 6 | **Member Management** | `/organization/members` | ✅ Read-only view | Member stats + recent list; CRUD, suspend, transfer, export actions missing |
| 7 | **Membership Plans** | `/organization/memberships` | ✅ Read-only view | Plan stats + list; create/edit/archive plans, pricing, coupons actions missing |
| 8 | **Trainer Management** | `/organization/trainers` | ✅ Read-only view | Trainer stats + roster; CRUD, assign, performance tracking actions missing |
| 9 | **Attendance** | `/organization/attendance` | ✅ Read-only view | Attendance logs; trends, peak-hour analysis, export missing |
| 10 | **Classes** | `/organization/classes` | ✅ Read-only (FeatureLocked on Lite) | Sessions list; CRUD, capacity, waitlist, booking actions missing |
| 11 | **Nutrition** | `/organization/nutrition` | ❌ Not built | Templates, meal plans, compliance reports |

### C. Revenue

| # | Module | Route | Already Built? | Notes |
|---|--------|-------|----------------|-------|
| 12 | **Revenue Overview** | `/organization/revenue` | ✅ Read-only view | Payments list + metrics; reports, outstanding, export missing |
| 13 | **Payments** | `/organization/payments` | ❌ Not built | Detailed payment management, corrections, refunds |
| 14 | **Invoices** | `/organization/invoices` | ❌ Not built | Invoice management, download |
| 15 | **Financial Reports** | `/organization/financial-reports` | ❌ Not built | Exportable financial reports |

### D. Engagement

| # | Module | Route | Already Built? | Notes |
|---|--------|-------|----------------|-------|
| 16 | **Communication Center** | `/organization/communications` | ✅ Read-only (FeatureLocked on Lite) | Notifications + campaigns view; send, segment, campaign management missing |

### E. Intelligence

| # | Module | Route | Already Built? | Notes |
|---|--------|-------|----------------|-------|
| 17 | **Analytics** | `/organization/analytics` | ✅ Read-only view | Branch metrics, storage, utilization; charts, forecasts, saved reports missing |

### F. Brand & Access

| # | Module | Route | Already Built? | Notes |
|---|--------|-------|----------------|-------|
| 18 | **Branding / White Label** | `/organization/branding` | ✅ Read-only view | Tenant configs, domains, feature flags; upload logo, colors, theme actions missing |
| 19 | **Domains** | `/organization/domains` | ✅ Read-only (FeatureLocked on Lite) | Domain registry; add/verify/remove actions missing |

### G. Administration

| # | Module | Route | Already Built? | Notes |
|---|--------|-------|----------------|-------|
| 20 | **Billing & Subscription** | `/organization/billing`, `/organization/plan` | ✅ Detailed (plan page) + overview | Subscription management, usage, plan comparison, add-ons, timeline |
| 21 | **Audit & Compliance** | `/organization/security` | ✅ Read-only view | Security events + activity logs; export missing |
| 22 | **Support Center** | `/organization/support` | ❌ Not built | Tickets, escalations, documentation |
| 23 | **Settings** | `/organization/settings` | ✅ Read-only view | Branch settings, feature flags, compliance requests, tenant configs |

---

## Key Architecture Patterns

### Data Access Pattern
```
Server Component / Page
  -> Server Action (mutations) or direct Supabase query (reads)
    -> requireOrganizationOwner() guard
      -> Service function with organization_id filter
        -> Supabase query with .eq("organization_id", orgId)
```

### Auth Guards
- `requireOrganizationOwner(nextPath?)` → wraps `requireRole(["organization_owner"])` + validates `organizationId` exists
- Returns `ScopedOrganizationOwnerContext` (AuthContext + organizationId)

### Module Workspace Pattern
- Super Admin uses `[module]/page.tsx` catch-all → `getSuperAdminModule(slug)` → `SuperAdminModuleWorkspace`
- Org Owner does NOT have this catch-all yet; each module needs its own page OR a `[module]/page.tsx` catch-all

### Dashboard Service
- `getOrganizationOwnerDashboard()` runs 25+ parallel Supabase queries
- Returns `OrganizationOwnerDashboard` with organization, gyms, branches, members, payments, etc.
- Metrics computed from `branch_metrics` aggregation table

### Plan / Feature Gating
- `getOrgPlanContext(organizationId)` → resolves plan features
- `PlanStatusBanner` + `FeatureLocked` components for upselling
- Modules like Classes, Communications, Domains are FeatureLocked on Lite plan

---

## Comparison: Super Admin vs Organization Owner

| Aspect | Super Admin | Organization Owner |
|--------|-------------|-------------------|
| Scope | All tenants | Single organization |
| Route | `/super-admin` | `/organization` |
| Modules | 20+ modules (organizations, gyms, domains, subscriptions, billing, users, roles, security, analytics, monitoring, backups, etc.) | 19 modules (org-profile, gyms, branches, staff, members, memberships, trainers, attendance, classes, nutrition, revenue, communications, analytics, branding, domains, billing, audit, support, settings) |
| Nav Items | Dashboard + Approvals + 15 modules | Dashboard + Plan + 15 modules |
| Mutations | Full CRUD on everything | R/U on own scope, no hard delete, no global access |
| Workspace Pattern | `[module]/page.tsx` catch-all | No catch-all yet |
| Approvals | Maker-checker for destructive ops | N/A (or simpler) |
| RBAC | All actions on all resources | Read + limited Create/Update, no global permissions |

---

## Implementation Status Summary

### Fully Built
- Portal layout + shell + nav sidebar
- Dashboard (executive KPIs, top branches, activity, security alerts)
- Plan subscription management (usage, upgrade/downgrade, add-ons, timeline)
- Billing overview (with invoices + payment method tabs)
- 15 module read-only views (accessible via module workspace)

### Partially Built (read-only views exist, actions missing)
- All 15 module views need **CRUD actions** (Server Actions + forms + schemas + services)
- `[module]/page.tsx` catch-all missing (needs to mirror super-admin pattern)
- Branch Management is mixed into Gyms — needs separate page

### Not Built
- Organization Profile (edit org details, logo, GST)
- Nutrition Management
- Payments detail page
- Invoices detail page
- Financial Reports
- Support Center
- Catch-all `[module]/page.tsx` route
- Server Actions for ALL mutations (gym, branch, staff, member, membership, trainer, attendance, class, nutrition, communication, branding, domain, settings)
- Zod schemas for ALL modules
- Feature-specific service files
- Audit logging integration on mutations
- Export functionality (PDF/CSV)

---

## Recommended Build Order

1. Create `[module]/page.tsx` catch-all → `OrganizationOwnerWorkspace` (already done for read-only, needs actions)
2. Add **Server Actions** folder: `features/organization-owner/actions/`
3. Add **Zod Schemas** folder: `features/organization-owner/schemas/`
4. Add **Services** for each module (read/write)
5. Build mutation UIs: gym/branch CRUD, staff invite/assign, member management, membership plans
6. Build Organization Profile page
7. Build Support Center
8. Build Revenue detail pages (payments, invoices, reports)
9. Build Nutrition Management
10. Add exports + audit logging
