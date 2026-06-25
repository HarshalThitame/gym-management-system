# Super Admin Phase 1.2 — Organization & Gym Destructive Workflows (SAR-002)

> **Master plan:** `docs/SUPER_ADMIN_PRODUCTION_PLAN.md`
> **QA report:** `docs/52-super-admin-qa-report.md` (SAR-002, High risk)
> **Duration:** ~1.5 days
> **Type:** Build (UI + wire server actions + test)

---

## Context

The super admin organization and gym management implementation has a **strong server-action foundation but incomplete UI wiring** across three areas:

### What Already Exists (Solid Foundation)

**Server Actions** (both files are comprehensive):

`features/super-admin/actions/organization-actions.ts` (1582 lines):
- `saveSuperAdminOrganizationAction` — create/edit org with settings merge
- `transferOrganizationOwnerAction` — transfer ownership with approval flow
- `organizationLifecycleAction` — suspend/activate/delete/restore/purge with conditional approval flow
- `organizationLegalHoldAction` — apply/release legal hold (immediate)
- `bulkOrganizationAction` — suspend/activate/assign_package/tag (NO delete)
- `reviewOrganizationApprovalAction` — approve/reject/cancel approval requests

`features/super-admin/actions/gym-branch-actions.ts` (1533 lines):
- `saveSuperAdminGymAction` — create/edit gym
- `saveSuperAdminBranchAction` — create/edit branch
- `transferGymAdminAction` — transfer gym admin
- `updateLocationLifecycleAction` — gym/branch lifecycle (activate/deactivate/archive)
- `updateBranchCapacityHoursAction` — update capacity + operating hours
- `moveGymToOrganizationAction` — move gym between orgs
- `moveBranchToGymAction` — move branch between gyms
- `reviewGymBranchApprovalAction` — review gym/branch approval requests
- `remediateBranchScopeAction` — reassign orphaned records to a branch

**UI Components:**

`OrganizationManagementWorkspace.tsx` (871 lines) — list view with:
- `OrganizationCard` — per-org card with Edit, Transfer, Suspend/Activate, Delete/Restore/Purge buttons
- `OrganizationDrawer` — routes to `OrganizationEditDrawer`, `TransferOwnerDrawer`, `BulkActionDrawer`, `LifecycleConfirmDrawer`
- Summary KPIs (4 cards), filters (search, status, sort, page size), bulk checkbox, CSV/PDF export
- All lifecycle actions require type-to-confirm + MFA step-up

`GymBranchManagementWorkspace.tsx` (879 lines) — list view with:
- `GymHierarchyCard` — gym card with Admin, +Branch, Edit, Move, Lifecycle buttons
- `BranchRowCard` — branch card with Edit, Hours, Remediate, Move, Lifecycle buttons
- 10 drawer types (GymForm, BranchForm, TransferAdminForm, LifecycleForm, CapacityHoursForm, MoveGymForm, MoveBranchForm, RemediateBranchForm, ApprovalReviewPanel, AuditTimeline)
- Summary KPIs (6 cards), filters, CSV/PDF export

`OrganizationApprovalReviewPanel.tsx` (316 lines) — approval inbox with:
- `ApprovalCard` — per-request card with action type, status, timestamps, diff table, decision form
- Supports: delete, suspend, transfer_owner, bulk_suspend, bulk_assign_package, permanent_purge

`OrganizationGovernanceControlPanel.tsx` (194 lines) — governance controls:
- Legal hold apply/release
- Permanent purge request (with eligibility display)

### What's MISSING (Critical Gaps)

**Gap 1 (CRITICAL): Branches page uses client-only simulated data.**
The `/super-admin/branches` page renders `BranchesClient.tsx` (943 lines) which is a **completely separate, client-only implementation** with `setTimeout` mock actions and `showToast` instead of real server actions. All CRUD operations are simulated. This page must be replaced with the real `GymBranchManagementWorkspace.tsx`.

**Gap 2 (HIGH): Org detail page is entirely read-only.**
`app/(super-admin)/super-admin/organizations/[orgId]/page.tsx` (682 lines) has 8 tabs but ZERO action buttons. No edit profile, no suspend/activate, no delete, no transfer. To take any action on an org, the super admin must go back to the organizations list view. The detail page should have an action bar with all lifecycle operations.

**Gap 3 (HIGH): Revenue & usage drilldown missing from org detail page.**
The billing tab shows static subscription info + recent payments table. No revenue charts, trends, MRR breakdown, or payment timeline. The usage tab doesn't exist — there's no way to see member count vs limit, branch count vs limit, storage vs limit, etc.

**Gap 4 (MEDIUM): No immediate/forced org delete path.**
All destructive org actions go through the approval flow (maker-checker). For emergency/trusted scenarios, there should be a "Force Delete" path that bypasses approval but requires dual confirmation + MFA.

**Gap 5 (MEDIUM): Bulk org delete is not available.**
`bulkOrganizationAction` supports suspend/activate/assign_package/tag but NOT delete. QA report flagged this as a gap.

**Gap 6 (MEDIUM): No deep gym/branch statistics.**
The org detail page gyms tab shows a paginated list of gyms and branches but no per-gym metrics (member count, revenue, attendance rate, capacity utilization).

**Gap 7 (MEDIUM): Gym ownership validation UI missing.**
Workspaces generate warnings for missing gym admins but there's no dedicated "ownership validation" panel to review and fix misconfigured admin assignments.

---

## Tasks

### Task 1: Replace Branches Page with Real Server-Action Implementation (PRIORITY)

**Current:** `/super-admin/branches` renders `BranchesClient.tsx` which uses `setTimeout` mock actions. The `BranchesClient.tsx` is 943 lines of pure client-side code with simulated CRUD. Data comes from `getGymBranchManagementData` service but ALL mutations are fake.

**Required:** Replace `/super-admin/branches` to use the real `GymBranchManagementWorkspace` component (or reconcile the two).

**Approach A (Recommended — full replacement):**
- Modify `app/(super-admin)/super-admin/branches/page.tsx` to pass full `GymBranchManagementData` to `GymBranchManagementWorkspace` (same as `branches-client.tsx` does but wired to real actions)
- The `GymBranchManagementWorkspace` already takes the same data shape and has all server actions wired
- Keep `branches-client.tsx` for reference but it's no longer the active page

**Approach B (Reconciliation — harder):**
- Update `branches-client.tsx` to replace all simulated actions with real server action calls
- Replace `BranchFormDrawer` (client-only) with the real `GymForm`/`BranchForm` from `GymBranchManagementWorkspace`
- Wire status changes, capacity updates, moves, admin transfers to real server actions

**Files to modify:**
- `app/(super-admin)/super-admin/branches/page.tsx` — pass full data to `GymBranchManagementWorkspace`
- `features/super-admin/components/gyms/GymBranchManagementWorkspace.tsx` — verify it handles the branches-only route context correctly
- Keep `app/(super-admin)/super-admin/branches/branches-client.tsx` as is (not deleted, just not the active render)

---

### Task 2: Add Action Bar to Org Detail Page

**Current:** The 8-tab org detail page has no action buttons. Super admins must navigate back to the list view to edit, suspend, delete, or transfer an org.

**Required:** Add a sticky glass action bar to the org detail page header with:

| Action | Icon | Behavior |
|--------|------|----------|
| Edit Profile | Pencil | Opens edit profile drawer (reuse `OrganizationEditDrawer` from workspace) |
| Transfer Owner | UserRoundCog | Opens transfer owner drawer (reuse `TransferOwnerDrawer`) |
| Suspend / Activate | PauseCircle / PlayCircle | Opens lifecycle drawer with corresponding action |
| Delete Org | Trash2 | Opens lifecycle drawer with delete action (soft-delete by default, with "Force Delete" button for bypass) |
| Purge | XCircle | Opens lifecycle drawer with purge action (only shown if archived + eligible) |

**Implementation approach:**
- Wrap the detail page content in a `ClientOrgDetail` component that manages drawer state
- Each drawer reuses the EXISTING form components from `OrganizationManagementWorkspace.tsx` (extract them to shared files if needed)
- Add a `DrawerModal` to the detail page header that dispatches to the same forms
- All destructive actions require type-to-confirm + MFA (same as workspace)

**Glass action bar styling:**
```tsx
<div className="sticky top-0 z-10 -mx-6 mb-6 rounded-lg border border-border bg-surface/80 backdrop-blur-md px-5 py-3 shadow-[0_18px_60px_rgb(17_18_20/0.06)]">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <span className="text-sm font-black text-muted-foreground">Actions:</span>
      {actionButtons.map(btn => (
        <button key={btn.key} onClick={btn.onClick}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted hover:border-border-strong transition-all"
        >
          {btn.icon}{btn.label}
        </button>
      ))}
    </div>
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="size-1.5 rounded-full bg-green-500" />
      All actions require MFA
    </div>
  </div>
</div>
```

**Files to create:**
- `features/super-admin/components/organizations/OrgDetailActions.tsx` — client component with action bar + drawer routing

**Files to modify:**
- `app/(super-admin)/super-admin/organizations/[orgId]/page.tsx` — wrap content with `OrgDetailActions`, make the page a client component wrapper

---

### Task 3: Add Revenue Drilldown to Org Detail Billing Tab

**Current:** The billing tab shows:
- Subscription info card (package, status, dates, limits)
- Recent Payments list (25 latest payments)

Missing: revenue trends, MRR/ARR breakdown, payment timeline chart, revenue by gym/branch.

**Required:** Enhance the billing tab with:

1. **Revenue KPI row** (4 small stat cards inline with existing layout):
   - Total Revenue (all time, formatted INR)
   - Current Month Revenue
   - Average Payment Value
   - Revenue This Year

2. **Revenue Trend Chart** — last 12 months bar chart using Recharts:
   - X-axis: month labels
   - Y-axis: revenue amount (INR)
   - Bars: monthly totals
   - Tooltip: exact amount + payment count

3. **Revenue by Gym** — mini table (if org has multiple gyms):
   - Gym name | Revenue | Payment count | % of total
   - Compact list with inline progress bar

Use existing data sources:
- `getOrganizationDetailData` already fetches `recentPayments` (top 25)
- Extend the service to also fetch `monthly_revenue` via a query on `payments` table grouped by `date_trunc('month', created_at)`
- Or use the existing `revenue_recognition` table

**Recharts imports (already in package.json):**
```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
```

**Files to modify:**
- `features/super-admin/services/organization-management-service.ts` — add `getOrgRevenueData(orgId)` function
- `app/(super-admin)/super-admin/organizations/[orgId]/page.tsx` — enhance billing tab with revenue KPIs + chart

---

### Task 4: Add Usage Drilldown to Org Detail

**Current:** No usage visualization on any tab. The workspace card shows compact usage (branches active/total, members, revenue) but the detail page doesn't have a dedicated usage section.

**Required:** Add a new **"Usage" tab** (between "Users" and "Billing") with:

1. **Usage vs Limits card grid** (one card per limit type):
   - Members: `{current} / {limit}` with progress bar (green < 70%, amber 70-90%, red > 90%)
   - Branches: same
   - Gyms: same
   - Trainers: same
   - Staff: same
   - Storage: `{currentGB} / {limitGB}` with progress bar
   - API Calls: `{current} / {limit}`
   - SMS: `{current} / {limit}`

2. **Usage Trend** — last 6 months member count + branch count line chart

3. **Recent usage snapshots** table (from `subscription_usage_snapshots`):
   - Date | Members | Branches | Storage | API Calls
   - Paginated, sortable by date desc

Data sources:
- `organization_subscriptions` → `organization_entitlements.limits` (or `getOrganizationEffectiveLimits()`)
- `subscription_usage_snapshots` table
- Current counts: `SELECT count(*) FROM members WHERE organization_id = $1 AND status = 'active'`

**Files to create:**
- `features/super-admin/components/organizations/OrgUsageTab.tsx` — usage vs limits visualization

**Files to modify:**
- `features/super-admin/services/organization-management-service.ts` — add `getOrgUsageData(orgId)` function
- `app/(super-admin)/super-admin/organizations/[orgId]/page.tsx` — add "Usage" tab, embed `OrgUsageTab`

---

### Task 5: Add Immediate/Force Delete Path

**Current:** All org delete actions go through the approval flow. The lifecycle drawer shows "Delete" which creates an approval request. There's no way to directly delete without approval.

**Required:** Add a "Force Delete" option that bypasses approval for trusted super admin scenarios:

1. **In the lifecycle drawer**, add a toggle/checkbox: "This is an emergency. Bypass approval and delete immediately."
2. When toggled:
   - Show warning banner: "⚠️ Deleting this organization immediately will permanently remove all associated data."
   - Require DOUBLE type-to-confirm: Type org slug first, then type "I UNDERSTAND THE CONSEQUENCES"
   - Require MFA step-up verification
   - If the org has active subscriptions/warnings, show blocker list
3. The server action bypasses `createOrganizationApprovalRequest` and directly:
   - Soft-deletes the org (sets status to archived)
   - Deletes all auth users associated with this org
   - Writes CRITICAL severity audit log
   - Sends notification to all org owners
4. Add rate limit: 3/60s for force delete

**Note:** Force delete still does soft-delete (status = archived). True permanent purge still requires the existing approval workflow.

**Files to modify:**
- `features/super-admin/actions/organization-actions.ts` — add `forceDeleteOrganizationAction` or extend `organizationLifecycleAction` with bypass flag
- `features/super-admin/schemas/organization-schemas.ts` — add force delete schema with dual confirmation fields
- `features/super-admin/components/organizations/OrganizationManagementWorkspace.tsx` — enhance `LifecycleConfirmDrawer` with bypass option
- `features/super-admin/components/organizations/OrgDetailActions.tsx` — include force delete in detail action bar

---

### Task 6: Add Bulk Org Delete

**Current:** `bulkOrganizationAction` supports suspend/activate/assign_package/tag but NOT delete. The bulk action drawer explicitly states "Bulk delete is intentionally unavailable."

**Required:** Add bulk org delete with strong safety measures:

1. Extend `bulkOrganizationActionSchema` to support `action: "delete"`
2. Add confirmation text: `"BULK_DELETE:{count}"` where count is the number of selected orgs
3. Require MFA step-up
4. Additionally require: select a reason from dropdown (GDPR Request, Duplicate Account, Fraud, Abandoned, Other)
5. Each org is soft-deleted (status = archived) individually
6. Rate limit: 1/120s (very restrictive)

**Files to modify:**
- `features/super-admin/schemas/organization-schemas.ts` — extend `bulkOrganizationActionSchema`
- `features/super-admin/actions/organization-actions.ts` — extend `bulkOrganizationAction` with delete handling
- `features/super-admin/components/organizations/OrganizationManagementWorkspace.tsx` — update `BulkActionDrawer` with delete option
- `features/super-admin/components/organizations/OrgDetailActions.tsx` — bulk delete from detail page if multiple selected

---

### Task 7: Add Gym/Branch Deep Statistics to Org Detail

**Current:** The gyms tab shows a paginated list of gyms and branches but no per-gym metrics.

**Required:** Enhance the gyms tab:

1. **Gym stat cards** (shown above the gym list):
   - Total Gyms / Active
   - Total Branches / Active
   - Total Members across all gyms
   - Total Revenue across all gyms

2. **Per-gym expandable row** (click to expand):
   - Collapsed: name, status, branch count, member count
   - Expanded: branches list with per-branch: name, status, capacity (used/total), member count, revenue, admin assignment
   - Warning badges for: no admin assigned, capacity > 80%, no active branches

3. **Gym admin status indicators**:
   - Green: admin assigned
   - Amber: no admin assigned (with "Assign Admin" button)
   - Red: admin assigned but inactive/suspended

**Files to modify:**
- `features/super-admin/services/organization-management-service.ts` — add gym metrics to `OrganizationDetailData.gyms[]`
- `app/(super-admin)/super-admin/organizations/[orgId]/page.tsx` — enhance gyms tab with expandable rows and stat cards

---

### Task 8: UI Polish — Glass Effects & Cinematic Styling

Apply the design standards from `SUPER_ADMIN_PRODUCTION_PLAN.md` to ALL org/gym management UI:

**Required style changes:**

1. **Organization Management workspace header** — sticky glass header:
   ```
   bg-background/90 backdrop-blur sticky top-0 z-10 border-b border-border
   ```

2. **Org cards** — add `transition-all hover:shadow-md hover:border-border-strong`, already has:
   ```
   rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-5
   ```

3. **Filter bar (both org + gym pages)** — sticky glass:
   ```
   sticky top-[73px] z-[9] bg-background/80 backdrop-blur-sm border-b border-border py-3 px-5 -mx-5
   ```

4. **Drawer modals** — use backdrop-blur + slide-in animation:
   ```
   <!-- Backdrop -->
   <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm" />
   <!-- Dialog -->
   <div className="fixed inset-y-0 right-0 z-50 flex animate-slide-in-right">
     <div className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden rounded-l-lg border border-border bg-surface shadow-2xl">
   ```

5. **Add `animate-slide-in-right` to globals.css** if not already present (was added in Phase 1.1)

6. **Action buttons on detail page** — use glass action bar (specified in Task 2)

7. **Approval cards** — add reveal-up staggered animation:
   ```
   <div className="reveal-up" style={{"--reveal-delay": `${i * 0.05}s`}}>
   ```

8. **Gym hierarchy cards** — add expand animation:
   ```
   <div className="grid grid-rows-[0fr] transition-all duration-300 overflow-hidden data-[expanded]:grid-rows-[1fr]">
   ```

9. **Empty states** — use centered dashed-border container with illustration + CTA buttons:
   ```
   rounded-lg border border-dashed border-border bg-background p-12 text-center
   ```

10. **KPI/Metric cards** — consistent:
    ```
    rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-4
    reveal-up with staggered delay
    ```

11. **Bulk action bar** — floating glass bar at bottom (same pattern as Phase 1.1):
    ```
    fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-lg border border-border bg-surface/95 backdrop-blur shadow-2xl px-4 py-3 flex items-center gap-3 animate-slide-in-right
    ```

12. **Tab navigation on detail page** — add `bg-background/90 backdrop-blur border-b border-border sticky top-0 z-[5]` to the tab bar (same glass pattern as other sticky elements)

13. **Status badges on org cards** — use existing Badge component variants:
    - Active: `bg-green-50 text-green-700 border-green-200`
    - Suspended: `bg-red-50 text-red-700 border-red-200`
    - Trial: `bg-cyan-50 text-cyan-800 border-cyan-200`
    - Archived: `bg-amber-50 text-amber-800 border-amber-200`

---

### Task 9: Fix Data & Type Issues

1. **Fix branches page type mismatch** — The `branches-client.tsx` uses `GymBranchManagementData` type but only receives partial data (summary, gyms, orphanBranches, organizations). Ensure the page passes the full data shape to `GymBranchManagementWorkspace`.

2. **Add missing `last_login` to org owner display** — The org card shows the owner but doesn't show when the owner last logged in. Fetch from login_history.

3. **Fix revenue formatting** — Ensure all revenue displays use the organization's currency setting and format correctly (paise → rupees, with ₹ symbol).

4. **Remove the `branches-client.tsx` simulated setTimeout calls** — Leave the file but comment out the simulated code block at the top with a NOTE referencing `GymBranchManagementWorkspace`.

---

## Files Summary

### Files to CREATE:
| File | Purpose |
|------|---------|
| `features/super-admin/components/organizations/OrgDetailActions.tsx` | Action bar + drawer routing for org detail page |
| `features/super-admin/components/organizations/OrgUsageTab.tsx` | Usage vs limits visualization with progress bars + trend chart |

### Files to MODIFY:
| File | Changes |
|------|---------|
| `app/(super-admin)/super-admin/branches/page.tsx` | Replace with `GymBranchManagementWorkspace` instead of `BranchesClient` |
| `app/(super-admin)/super-admin/organizations/[orgId]/page.tsx` | Add action bar, Revenue drilldown in billing tab, Usage tab, enhance gyms tab |
| `features/super-admin/services/organization-management-service.ts` | Add `getOrgRevenueData()`, `getOrgUsageData()`, gym metrics |
| `features/super-admin/actions/organization-actions.ts` | Add force delete bypass, extend bulk delete |
| `features/super-admin/schemas/organization-schemas.ts` | Add force delete schema, extend bulk schema |
| `features/super-admin/components/organizations/OrganizationManagementWorkspace.tsx` | Enhance lifecycle drawer with bypass option, bulk delete in bulk drawer, glass styling |
| `features/super-admin/components/organizations/OrganizationApprovalReviewPanel.tsx` | Add reveal-up animations |
| `features/super-admin/components/gyms/GymBranchManagementWorkspace.tsx` | Glass styling, expandable gym cards |

---

## UI Styling Guidelines

Follow the design system in `docs/SUPER_ADMIN_PRODUCTION_PLAN.md` exactly. Key patterns to use throughout:

### Sticky Glass Header (Org List Page)
```tsx
<div className="bg-background/90 backdrop-blur sticky top-0 z-10 border-b border-border -mx-5 px-5 py-3 space-y-3">
  <div className="flex items-center justify-between">
    <h1 className="text-2xl font-black">Organizations</h1>
    <button ...>Create Organization</button>
  </div>
  <!-- KPI row with reveal-up animation -->
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    {kpis.map((kpi, i) => (
      <div key={kpi.label}
        className="reveal-up rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-4 transition-all hover:shadow-md hover:border-border-strong"
        style={{"--reveal-delay": `${i * 0.05}s`} as React.CSSProperties}
      >
        <div className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{kpi.label}</div>
        <div className="mt-1 text-3xl font-black text-foreground">{kpi.value}</div>
      </div>
    ))}
  </div>
</div>
```

### Glass Filter Bar (Sticky Below Header)
```tsx
<div className="sticky top-[73px] z-[9] bg-background/80 backdrop-blur-sm border-b border-border py-3 -mx-5 px-5">
  <form className="flex items-center gap-3">
    <input ... placeholder="Search..." />
    <select ... ><option>All statuses</option>...</select>
    <button type="submit">Apply</button>
  </form>
</div>
```

### Org Card with Actions
```tsx
<div className="rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-5 transition-all hover:shadow-md hover:border-border-strong">
  <div className="flex items-start justify-between">
    <div>
      <a href={`/super-admin/organizations/${org.id}`} className="text-lg font-black hover:text-accent transition-colors">
        {org.name}
      </a>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={statusVariant}>{org.status}</Badge>
        <HealthBadge score={org.health} />
      </div>
    </div>
    <div className="flex items-center gap-1">
      {actionButtons.map(btn => (
        <button key={btn.key} onClick={btn.onClick}
          className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted hover:border-border-strong transition-all grid place-items-center"
          title={btn.label}
        >
          {btn.icon}
        </button>
      ))}
    </div>
  </div>
</div>
```

### Usage Progress Bar
```tsx
<div className="rounded-lg border border-border bg-background p-4">
  <div className="flex items-center justify-between">
    <span className="text-sm font-black">Members</span>
    <span className="text-xs text-muted-foreground">{current} / {limit === -1 ? "∞" : limit}</span>
  </div>
  {limit > 0 && (
    <div className="mt-2 h-2 rounded-full bg-surface-muted">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.min((current / limit) * 100, 100)}%`,
          backgroundColor: ratio < 0.7 ? "#16A34A" : ratio < 0.9 ? "#D97706" : "#D92D20"
        }}
      />
    </div>
  )}
  {limit === -1 && (
    <p className="mt-1 text-xs text-muted-foreground">Unlimited plan</p>
  )}
</div>
```

### Floating Bulk Action Bar
```tsx
{selectedIds.length > 0 && (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-lg border border-border bg-surface/95 backdrop-blur shadow-2xl px-4 py-3 flex items-center gap-3 animate-slide-in-right">
    <span className="text-sm font-black">{selectedIds.length} selected</span>
    <div className="w-px h-5 bg-border" />
    <button onClick={() => setDrawer({ type: "bulk", selectedIds })} className="...">
      Bulk Actions
    </button>
  </div>
)}
```

---

## Verification Checklist

After completing all tasks, verify:

### Fixes
- [ ] `/super-admin/branches` page uses real server actions (not simulated setTimeout)
- [ ] Branches page no longer has fake mock data — all CRUD goes through Supabase

### New Features
- [ ] Org detail page has action bar with Edit, Transfer, Suspend/Activate, Delete buttons
- [ ] All lifecycle actions work from detail page (same as workspace)
- [ ] Force delete bypass option works (dual type-to-confirm + MFA)
- [ ] Bulk delete works (reason dropdown, count confirmation, rate limited)
- [ ] Revenue drilldown shows charts + KPIs on billing tab
- [ ] Usage tab shows progress bars for all limit types + trend chart
- [ ] Gym/branch expandable rows show stats + admin status

### Styling
- [ ] Org list page has sticky glass header + glass filter bar
- [ ] Detail page tab bar has glass backdrop
- [ ] Drawer modals have backdrop-blur + slide-in animation
- [ ] Org cards have hover transitions
- [ ] Approval cards animate in with staggered reveal
- [ ] Usage progress bars animate width on load

### Security
- [ ] All destructive actions require type-to-confirm
- [ ] Force delete + bulk delete require MFA step-up + dual confirmation
- [ ] All writes gated with `requireRole(["super_admin"])`
- [ ] All writes produce audit log entries
- [ ] Rate limiting on bulk operations (1/120s) and force delete (3/60s)

### Build
- [ ] `npm run typecheck` passes (0 errors)
- [ ] `npm run lint` passes (0 new errors)
- [ ] `npm run build` completes
- [ ] No page/console errors at `/super-admin/organizations`, `/super-admin/branches`, `/super-admin/organizations/[id]`

---

## Important Notes

1. **Do NOT delete `branches-client.tsx`** — It may be referenced elsewhere. Just stop rendering it from the page and add a comment noting it's superseded.

2. **Keep all existing server action signatures** — Add new optional parameters rather than changing existing ones.

3. **Do NOT change the database schema** — All new data comes from existing tables. Revenue data uses `payments` table. Usage data uses `subscription_usage_snapshots` and `organization_entitlements`.

4. **Reuse existing components from the workspace** — The `OrganizationEditDrawer`, `TransferOwnerDrawer`, `LifecycleConfirmDrawer` etc. should be reused on the detail page, not recreated. Extract them to shared files if needed.

5. **Match existing code patterns** — Look at how `OrganizationManagementWorkspace.tsx` manages drawer state (lines 56-68 `DrawerState` type, lines 451-469 `OrganizationDrawer` router) and follow the same pattern.
