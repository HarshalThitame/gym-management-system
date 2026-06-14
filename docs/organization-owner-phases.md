# Organization Owner Portal — Phase Plan

## Phase 1: Foundation ✅ COMPLETED

### 1.1 Infrastructure
- `[module]/page.tsx` catch-all route (mirrors super-admin pattern)
- `features/organization-owner/actions/` — Server Actions for all 14 modules
- `features/organization-owner/schemas/` — Zod validation schemas for all modules
- `features/organization-owner/services/` — per-module service files (gym, member, staff, revenue, support)
- `features/organization-owner/lib/audit-helpers.ts` — audit logging + export

### 1.2 Enterprise UI Components
- `DataCard` — rich card with title, subtitle, meta, badge, status, sections, actions, selection
- `DataList` — full list with select-all, bulk actions toolbar, card list, pagination, loading/empty states
- `FilterBar` — search input + multi-filter selects + sort + page size + Apply/Reset
- `OrgOwnerDrawer` — slide-in drawer with focus trap, form fields, submit button, form message
- `DrawerField`, `DrawerSelectField`, `DrawerSubmitButton`, `DrawerFormMessage`

### 1.3 19 Module Components
Each module has: **Stat KPIs → FilterBar → DataList → OrgOwnerDrawer**

| Module | File | Status |
|--------|------|--------|
| Dashboard | `workspace.tsx` (dashboard view) | ✅ |
| Gyms | `GymsModule.tsx` | ✅ |
| Staff | `StaffModule.tsx` | ✅ |
| Members | `MembersModule.tsx` | ✅ |
| Memberships | `MembershipsModule.tsx` | ✅ |
| Revenue | `RevenueModule.tsx` | ✅ |
| Trainers | `TrainersModule.tsx` | ✅ |
| Attendance | `AttendanceModule.tsx` | ✅ |
| Classes | `ClassesModule.tsx` | ✅ |
| Communications | `CommunicationsModule.tsx` | ✅ |
| Analytics | `AnalyticsModule.tsx` | ✅ |
| Branding | `BrandingModule.tsx` | ✅ |
| Domains | `DomainsModule.tsx` | ✅ |
| Billing | `BillingModule.tsx` | ✅ |
| Nutrition | `NutritionModule.tsx` | ✅ |
| Support | `SupportModule.tsx` | ✅ |
| Profile | `ProfileModule.tsx` | ✅ |
| Settings | `SettingsModule.tsx` | ✅ |
| Security | `SecurityModule.tsx` | ✅ |

---

## Phase 2: Production Hardening ✅ COMPLETED

### 2.1 Type Safety
- Fixed 36 → **0 type errors** in Server Actions
- Aligned all actions with actual Supabase DB schema (column names, required fields, exactOptionalPropertyTypes)
- Fixed: `emergency_contact` → `emergency_contact_name/phone`, `role` → `role_id` (FK lookup), `specialization` → removed (separate table), `profiles` → removed `organization_id` (doesn't exist), `branch_settings` → typed JSON columns, `membership_plans` → added required `slug/description/duration_days`

### 2.2 Loading & Error States
- `loading.tsx` — full-page skeleton for dashboard
- `[module]/loading.tsx` — per-module skeleton matching real layout
- `error.tsx` — error boundary with retry

### 2.3 Breadcrumbs & SEO
- `Breadcrumbs` on every module page (Dashboard > Module Name)
- `generateMetadata()` with title/description for all modules

### 2.4 Export
- CSV download button in DataList toolbar
- `exportToCSV()` + `exportToJSON()` utilities
- `toast-utils.ts` — `notifySuccess/Error/Info` helpers

### 2.5 Server-Side Pagination
- `module-data-resolver.ts` — per-module paginated queries with `count: "exact"`
- URL search params drive all queries (`?q=&status=&page=&pageSize=`)
- Supports 15 modules with server-side `range()` pagination

### 2.6 Dashboard Charts (Recharts)
- Revenue Trend (LineChart) — monthly aggregated
- Member Growth (LineChart) — active members over time
- Attendance Trend (LineChart) — visit counts over time
- Branch Performance (BarChart) — top 8 branches by revenue

### 2.7 Mobile Responsive
- Full-screen drawer on mobile (`< md`)
- Stacked FilterBar with full-width controls
- Compact DataCards with smaller padding/text
- 44px+ minimum touch targets on all interactive elements
- `safe-area-inset-bottom` for notched phones
- Icon hidden on mobile module hero

### 2.8 useOptimistic Updates
- `use-optimistic-crud.ts` — reusable `useOptimisticList<T>()` hook
- GymsModule: instant create, instant status toggle (active/suspended/archived)
- Rollback on server error + toast notification
- Pattern ready for all other modules

### 2.9 WCAG 2.2 AA Accessibility
- **Skip to content** link in layout (visible on focus)
- **Focus trapping** in drawer (Tab/Shift+Tab cycle)
- **Focus restoration** on drawer close
- **Escape key** closes drawer
- **Focus indicators** — `focus-visible:ring-2` on all interactive elements
- **ARIA** — `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`, `role="alert"`, `role="search"`, `role="status"`, `aria-live="polite"`, `aria-busy`, `aria-atomic`
- **Screen reader** — `sr-only` text, `aria-label` on icon-only buttons/link

### 2.10 E2E Tests (Playwright)
`tests/e2e/organization-owner-workflows.spec.ts` — 8 test suites:

| Test | What it validates |
|------|------------------|
| 1 — Gym CRUD | List renders, filter bar, create drawer opens, edit drawer opens, Escape closes, no error crashes |
| 2 — Staff | Invite button, drawer form fields (email, name, role, gym, branch, scope), role filter, Apply button |
| 3 — Members | Search input, status filter, add drawer, transfer drawer, URL params for `q=` and filter |
| 4 — Modules | Memberships/Trainers/Revenue: KPI grid, filter bar, no errors |
| 5 — Dashboard | Hero text, KPIs visible, 4 chart headings, activity section, navigation to gyms |
| 6 — Module routes | All 18 module routes load without errors |
| 7 — Breadcrumbs | Dashboard link on 3 modules navigates to `/organization` |
| 8 — Plan & Billing | Plan page renders subscription section, billing loads |

### 2.11 Status: Overall TypeScript Health
- `features/organization-owner/` — **0 errors**
- `app/(organization-owner)/` — **0 errors**
- `tests/e2e/organization-owner-*` — **0 errors**

---

## Phase 3 — Maximum Enterprise Polish (PLANNED)

### 3.0 Priority Legend
- **P0** — Ship-stopper if missing
- **P1** — Expected by enterprise clients
- **P2** — Competitive differentiator
- **P3** — Delight / market-leading

### 3.1 P0 — Propagate useOptimistic to All 18 Remaining Modules

**Why:** Currently only GymsModule has instant UI feedback. Every other module feels sluggish.

**Work per module:** ~30 min × 18 = 9 hours
**Files to update:**
| Module | Key Actions |
|--------|------------|
| Staff | `inviteStaffAction`, `deactivateStaffAction` |
| Members | `saveMemberAction`, `transferMemberAction`, `setMemberStatusAction` |
| Memberships | `savePlanAction`, `setPlanStatusAction` |
| Trainers | `saveTrainerAction`, `assignMemberToTrainerAction` |
| Classes | `saveClassSessionAction`, `cancelClassSessionAction` |
| Communications | `saveCampaignAction`, `sendCampaignAction` |
| Branding | `saveBrandingAction` |
| Domains | `addDomainAction`, `removeDomainAction` |
| Settings | `toggleFeatureFlagAction`, `saveBranchSettingAction` |
| Profile | `saveOrganizationProfileAction` |
| Support | `createTicketAction` |
| Billing/Revenue | (read-heavy, optimistic less critical but nice) |
| Attendance/Analytics | (read-only, optimistic less critical) |

### 3.2 P0 — Wire Server-Paginated Data to All Module Components

**Why:** `module-data-resolver.ts` exists and `[module]/page.tsx` passes `moduleData`, but all components still use `dashboard.items` as fallback. The paginated server data is ignored.

**What to change per module:**
- Accept `moduleData` and `moduleFilters` props ✅ (already done in Phase 2)
- Use `moduleData.items` as primary data source, `dashboard.items` as fallback only
- On filter change → navigate to URL with search params (instead of local state)
- DataList pagination drives URL params

**Files:** All 15+ module components that have DataList

### 3.3 P1 — Bulk Actions Implementation

**Why:** DataList has the toolbar infrastructure, but no actual bulk operations exist.

**Bulk actions per module:**
| Module | Bulk Actions |
|--------|-------------|
| Members | Bulk suspend, bulk transfer to gym, bulk export CSV |
| Staff | Bulk deactivate, bulk reassign branch |
| Memberships | Bulk archive plans, bulk change pricing |
| Trainers | Bulk reassign gym, bulk export |
| Revenue | Bulk export selected payments as CSV |
| All | Bulk select-all + CSV export selected |

**New files needed:**
- `features/organization-owner/actions/bulk-actions.ts` — bulk server actions with validation
- Updates to each module component's `BulkAction[]` config

### 3.4 P1 — Saved Filter Presets

**Why:** Enterprise users need to save "Active Members in Mumbai Gym" as a one-click preset.

**Implementation:**
- `features/organization-owner/components/org-owner-presets.tsx` — Save/Load preset UI
- `lib/saved-filters.ts` — store presets in localStorage or Supabase `user_preferences` table
- Each FilterBar gets a "Save View" button + preset dropdown
- Presets store: `{ name, module, filters: { q, status, gymId, sort, pageSize } }`

### 3.5 P2 — Keyboard Shortcuts

**Why:** Power users navigate entirely via keyboard — Ctrl+K command palette is the standard.

**Implementation:**
- Ctrl+K → command palette overlay (already exists as `components/ui/command-palette.tsx`)
- Register org-owner commands:
  - `g→d` → Dashboard
  - `g→g` → Gyms
  - `g→m` → Members
  - `g→s` → Staff
  - `g→r` → Revenue
  - `g→t` → Trainers
  - `g→p` → Memberships (plans)
  - `g→c` → Classes
  - `g→b` → Billing
  - `g→n` → Settings
  - `/` → focus search in current module
  - `?` → show keyboard shortcuts guide
  - `n` → new/create (when in a module)
- `features/organization-owner/lib/keyboard-shortcuts.ts` — hook for registering shortcuts

### 3.6 P2 — Real-Time Updates (Supabase Realtime)

**Why:** Dashboard should update without page refresh — live attendance, new members, security alerts.

**Implementation:**
- `features/organization-owner/lib/use-realtime.ts` — generic Realtime subscription hook
- Subscribe to:
  - `attendance_logs` (organization-scoped) → live count on dashboard
  - `security_events` → alert badge updates
  - `members` (organization-scoped) → live member count
- Dashboard KPI cards show live indicators (pulsing green dot)

### 3.7 P3 — Notification Center

**Why:** Enterprise communication hub — in-app notifications with real-time push.

**Implementation:**
- `features/organization-owner/components/notification-center.tsx` — dropdown panel in header
- Real-time subscription to `notifications` table
- Features: mark read, mark all read, action links, filter by type
- Badge count on notification bell icon in PortalShell

### 3.8 P3 — Advanced Analytics BI Suite

**Why:** BI-grade intelligence — cohort analysis, churn prediction, custom report builder.

**Implementation:**
- `features/organization-owner/components/analytics/` — sub-directory for analytics:
  - `RevenueForecastChart.tsx` — predicted vs actual revenue
  - `CohortRetentionChart.tsx` — member retention by signup month
  - `ChurnPredictionTable.tsx` — at-risk members with risk score
  - `CustomReportBuilder.tsx` — drag-drop metric builder with export
- Date range picker with presets (7d, 30d, 90d, 1y, custom)
- Saved report configurations per user

### 3.9 P3 — Live Theme Preview (Branding)

**Why:** Current branding module is read-only. Enterprise clients need to see changes in real-time.

**Implementation:**
- `BrandingModule.tsx` gets live preview panel showing:
  - Sidebar with selected primary/secondary/accent colors
  - Button previews (primary, secondary, ghost variants)
  - Typography sample
  - Logo upload with crop + preview
- Color picker with contrast ratio validation (WCAG AA/AAA)
- "Publish" button to apply to live site

---

## Phase 4 — Maintenance & Scale (FUTURE)

### 4.1 Performance
- React Suspense streaming for module pages
- ISR for dashboard data (revalidate every 60s)
- Granular data fetching — no monolithic dashboard call
- Bundle analysis + code splitting

### 4.2 i18n (Internationalization)
- next-intl integration
- Hindi, Marathi, Gujarati language support (India market requirement)
- RTL layout support

### 4.3 Audit
- Granular before/after diff on all mutations
- Immutable audit trail viewer with search/filter/export
- Compliance report generator (GDPR, SOC 2)

### 4.4 Security
- Rate limiting on all Server Actions
- Step-up MFA for destructive actions (transfer org, delete entities)
- Session management UI

---

## Summary: Time Estimates

| Phase | Effort | Deliverable |
|-------|--------|-------------|
| Phase 1 | ~15 hrs | Foundation + 19 module UIs |
| Phase 2 | ~25 hrs | Production hardening (0 errors, a11y, mobile, tests, charts, pagination, optimistic) |
| **Phase 3** | **~35 hrs** | **Maximum enterprise (full optimistic, server pagination, bulk actions, presets, shortcuts, real-time, notifications, analytics, theme preview)** |
| Phase 4 | ~20 hrs | Scale & maintenance (i18n, perf, audit, security) |
