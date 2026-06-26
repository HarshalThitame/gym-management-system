# Super Admin Phase 2.2 — Search, Pagination, Filter & Export (SAR-006)

> **Master plan:** `docs/SUPER_ADMIN_PRODUCTION_PLAN.md`
> **QA report:** `docs/52-super-admin-qa-report.md` (SAR-006, Medium risk)
> **Duration:** ~1 day
> **Type:** Build (shared DataTable primitive + per-module wiring)

---

## Context

Search, pagination, filtering, and export are implemented **inconsistently** across super admin modules. Shared UI primitives exist (`components/ui/pagination.tsx`, `components/ui/search-input.tsx`, `components/ui/empty-state.tsx`) but are **not actually used** — every module re-implements these patterns inline with varying approaches. Modules without list views (Security, Analytics, Monitoring, Backups, Domains, White Label, Feature Audit, Production Safety) are dashboard-only and don't need search/filter.

### Current State Matrix

| Module | Search | Filters | Sort | Pagination | Export | Notes |
|--------|--------|---------|------|------------|--------|-------|
| Organizations | YES (query) | YES (status) | YES (5 options) | YES (page/pageSize) | CSV+PDF | Inline form, URL params |
| Branches/Gyms | YES (query) | YES (org, status) | No | YES (page/pageSize) | CSV+PDF | Inline form, URL params |
| Users | YES (query) | YES (role, status, org) | YES (5 options) | YES (page/pageSize) | CSV+PDF | Form submit, URL params |
| Roles | YES (query) | YES (type) | YES (sort) | YES (page) | No | URL params |
| Support Inbox | YES (client) | YES (client) | No | YES (client) | No | Client-side only, no URL sync |
| Approvals | YES (query) | YES (status, action) | No | YES (page/pageSize) | CSV | URL params |
| Subscriptions | YES (client) | YES (status, plan) | No | YES (client) | No | Client-side state, no URL sync |
| Billing | YES (client) | YES (status) | No | YES (client) | No | Client-side state |
| Security | Dashboard only | — | — | — | — | Not applicable |
| Analytics | Dashboard only | — | — | — | — | Not applicable |
| Monitoring | Dashboard only | — | — | — | — | Not applicable |
| Backups | Dashboard only | — | — | — | — | Not applicable |
| Domains | Dashboard only | — | — | — | — | Not applicable |
| White Label | Dashboard only | — | — | — | — | Not applicable |
| Feature Audit | Report only | — | — | — | CSV | Filtered by plan/status |

### Gaps

1. **No shared DataTable component** — every module builds table markup from scratch using plain `<table>` elements, despite TanStack React Table being available in `package.json`
2. **Shared Pagination component** (`components/ui/pagination.tsx`) exists but is not used by ANY super admin module
3. **Shared SearchInput component** (`components/ui/search-input.tsx`) exists but is not used by ANY super admin module
4. **Inconsistent filter state management** — some modules use URL params + server-side filtering (Orgs, Users), others use client-side state (Subscriptions, Billing, Support)
5. **No export** on Roles, Subscriptions, Billing, Security, Support lists
6. **No URL sync** on Support, Subscriptions, Billing — filters lost on page refresh
7. **No advanced filters** (date ranges, multi-select, saved filters) on any module

---

## Tasks

### Task 1: Build Shared DataTable Component

**Current:** No shared DataTable exists. Each module writes manual `<table>` markup.

**Required:** Create `components/ui/data-table.tsx` using TanStack React Table (already in deps):

The component should support:
- **Columns definition**: `{ id, header, accessorKey?, cell?, sortable?, filterable?, width? }`
- **Server-side pagination**: `pageCount`, `pageIndex`, `pageSize`, `onPageChange`, `onPageSizeChange`
- **Server-side sorting**: `sortBy`, `sortDir`, `onSortChange`
- **Client-side filtering**: `globalFilter`, `onGlobalFilterChange` (debounced)
- **Selection**: row checkboxes, `selectedRows`, `onSelectionChange`, optional `getRowId`
- **Loading state**: skeleton rows (pulsing rectangles matching column count)
- **Empty state**: renders shared `EmptyState` component with contextual message
- **Error state**: error banner with retry button
- **Styling**: glass-matching (rounded-md borders, hover highlight, sticky header)
- **Responsive**: horizontal scroll on mobile, stack on very small screens

**File to create:**
- `components/ui/data-table.tsx` — shared DataTable component

**File to modify:**
- `components/ui/index.ts` — export DataTable if barrel export exists

---

### Task 2: Add Consistent Pagination Across All Modules

**Current:** Every module re-implements pagination inline.

**Required:** Wire the shared `Pagination` component into all list-view modules:

1. **Subscriptions** — replace client-side `.slice()` with server-side page/pageSize params
2. **Billing** — replace client-side `.slice()` with server-side pagination (pass page/pageSize to service)
3. **Support Inbox** — replace client-side pagination with URL-synced server-side pagination
4. **Security events** — add pagination to security incident list and audit log views
5. **Domains** — if table view, add pagination (currently card view, may not need it)

**Files to modify:**
- `app/(super-admin)/super-admin/subscriptions/subscriptions-client.tsx` — wire to Pagination component
- `app/(super-admin)/super-admin/billing/billing-dashboard.tsx` — wire to Pagination component
- `features/support/components/support-inbox.tsx` — wire to Pagination component
- `features/security/components/security-incident-queue.tsx` — add Pagination
- `features/security/components/security-audit-log.tsx` — add Pagination

---

### Task 3: Add URL-Synced Filters to Client-Only Modules

**Current:** Subscriptions, Billing, and Support Inbox use client-side state for filters — lost on page refresh.

**Required:** Replace `useState` with `useSearchParams` + `useRouter.push`:
- Search query → `?q=...`
- Status filter → `?status=...`
- Page → `?page=...`
- Page size → `?pageSize=...`
- On mount, read initial values from URL params
- On filter change, push new URL + re-fetch from server

**Files to modify:**
- `app/(super-admin)/super-admin/subscriptions/subscriptions-client.tsx`
- `app/(super-admin)/super-admin/billing/billing-dashboard.tsx`
- `features/support/components/support-inbox.tsx`

---

### Task 4: Add CSV/PDF Export to Modules Missing It

**Current:** Roles, Subscriptions, Billing, Security events, Support lists have no export.

**Required:**
1. **Roles** — add CSV export button in header that exports all roles (or current filtered view)
2. **Subscriptions** — add CSV export of subscription table + status/package data
3. **Billing** — add per-tab export (invoices CSV, payments CSV, refunds CSV)
4. **Security events** — add CSV export of incident and audit log views
5. **Support** — add CSV export of ticket list (current view)

Each export button follows the existing pattern (link to `/api/super-admin/.../export?format=csv`):
```tsx
<a href={`/api/super-admin/roles/export?format=csv${filters}`}
   className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-black hover:bg-surface-muted transition-all"
   target="_blank">
  <Download className="size-3.5" />
  CSV
</a>
```

**Files to modify:**
- `features/super-admin/components/roles/RoleManagementWorkspace.tsx` — add export buttons
- `app/(super-admin)/super-admin/subscriptions/subscriptions-client.tsx` — add export buttons
- `app/(super-admin)/super-admin/billing/billing-dashboard.tsx` — add per-tab export
- `features/security/components/security-incident-queue.tsx` — add export
- `features/security/components/security-audit-log.tsx` — add export
- `features/support/components/support-inbox.tsx` — add export

---

### Task 5: Add Advanced Filters to High-Volume Modules

**Current:** Filters are basic (single dropdown or text search). No date range, multi-select, or saved filters.

**Required:** Add to Organizations, Users, Subscriptions (highest volume modules):

1. **Organizations** — add:
   - Date range filter (created from/to)
   - Package filter (multi-select dropdown of package names)
   - Owner filter (search/select owner)
   - Active/trial filter toggle

2. **Users** — add:
   - Date range filter (created from/to, last login from/to)
   - Multi-role filter (select multiple roles)
   - Multi-org filter
   - Login status (has logged in / never logged in)

3. **Subscriptions** — add:
   - Date range (created from/to, expiry from/to)
   - Package multi-select
   - Billing period filter
   - Trial vs paid filter
   - Over-limit filter (show only orgs over their member/branch limit)

**Implementation pattern:**
```
sticky top-[73px] z-[9] bg-background/80 backdrop-blur-sm border-b border-border py-3
```
Filters expandable via "Show Advanced Filters" toggle. URL-synced for shareability.

**Files to modify:**
- `features/super-admin/components/organizations/OrganizationManagementWorkspace.tsx` — add advanced filters
- `features/super-admin/components/users/UserManagementWorkspace.tsx` — add advanced filters
- `app/(super-admin)/super-admin/subscriptions/subscriptions-client.tsx` — add advanced filters

---

### Task 6: UI Polish — Shared Components Glass Styling

**Required:**
1. Wire the shared `SearchInput` component (`components/ui/search-input.tsx`) into all modules that currently use raw `<input>`:
   - Organizations
   - Branches/Gyms
   - Users
   - Roles
   - Approvals
2. Wire the shared `EmptyState` component into all modules that use local empty state implementations
3. Ensure shared `Pagination` component has consistent glass styling matching the design system
4. Add `reveal-up` animation to table rows

---

## Files Summary

### Files to CREATE:
| File | Purpose |
|------|---------|
| `components/ui/data-table.tsx` | Shared TanStack Table component with pagination, sorting, selection, loading, empty, error states |

### Files to MODIFY:
| File | Changes |
|------|---------|
| All modules listed in Tasks 2-6 | Wire shared components, add URL sync, add export, add advanced filters |

---

## Verification Checklist

- [ ] New DataTable component renders with data, loading skeletons, empty state, error state
- [ ] All modules consistently use shared Pagination, SearchInput, EmptyState components
- [ ] Subscriptions, Billing, Support Inbox filters survive page refresh (URL-synced)
- [ ] CSV export works on Roles, Subscriptions, Billing (per-tab), Security, Support
- [ ] Organizations has date range + package + owner advanced filters
- [ ] Users has last-login filter + multi-role filter
- [ ] Subscriptions has over-limit filter + trial/paid toggle
- [ ] Table rows have reveal-up animation
- [ ] `npm run typecheck` passes
