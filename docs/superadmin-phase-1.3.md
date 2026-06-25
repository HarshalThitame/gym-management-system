# Super Admin Phase 1.3 — Subscription & Billing Operations (SAR-003)

> **Master plan:** `docs/SUPER_ADMIN_PRODUCTION_PLAN.md`
> **QA report:** `docs/52-super-admin-qa-report.md` (SAR-003, High risk)
> **Duration:** ~1.5 days
> **Type:** Build (UI + wire server actions + test)

---

## Context

The super admin subscription and billing management implementation is **unusually deep** — there are 20+ server actions, 12+ services, and 10+ UI modals — but has **critical gaps where server actions exist but have no UI button to call them**.

### What Already Exists

**Server Actions (most gaps are UI-only):**

`features/super-admin/actions/subscription-actions.ts` (125 lines):
- `assignPackageAction` — assign package to org
- `updateSubscriptionStatusAction` — update subscription status

`features/super-admin/actions/subscription-enterprise-actions.ts` (792 lines):
- `upgradePlanAction` — upgrade with proration
- `downgradePlanAction` — downgrade with scheduled change + usage check
- `cancelSubscriptionAction` — cancel (immediate or end_of_period) with MFA
- `reactivateSubscriptionAction` — reactivate with MFA
- `extendTrialAction` — extend trial dates
- `convertTrialAction` — convert trial to paid
- `assignAddonAction` — assign addon
- `removeAddonAction` — remove addon
- `scheduleChangeAction` — schedule future plan change
- `cancelScheduledChangeAction` — cancel scheduled change
- `bulkUpdateSubscriptionStatusAction` — bulk update status
- `overrideSubscriptionPriceAction` — override price with MFA

`features/super-admin/actions/package-management-actions.ts` (395 lines):
- `savePackageAction` — create/update package with full feature matrix
- `deletePackageAction` — archive/delete package

`features/super-admin/actions/entitlement-sync-actions.ts` (214 lines):
- `syncAllOrganizationEntitlements` — batch sync all org entitlements
- `cleanupStaleEntitlements` — clean stale entitlement records

`features/super-admin/actions/dunning-actions.ts` (200 lines):
- `retrySubscriptionPaymentAction` — retry failed payment (creates Razorpay order)
- `extendGracePeriodAction` — extend dunning grace period
- `suspendSubscriptionForNonPaymentAction` — suspend for non-payment
- `reactivateAfterPaymentAction` — reactivate after payment resolved

**UI Components (already wired):**
- `subscriptions-client.tsx` (599 lines) — Subscription drawer with 10 action modals
- `package-management-client.tsx` (815 lines) — Package CRUD with full feature matrix editor
- `OrgSubscriptionTable.tsx` (149 lines) — Org subscription list
- `AssignPackageModal.tsx` (305 lines) — Assign package modal
- `SubscriptionAnalyticsCards.tsx` (70 lines) — MRR/ARR KPI cards
- `SubscriptionRecentEvents.tsx` (139 lines) — Event timeline
- `BillingDashboard.tsx` (610 lines) — Read-only financial overview (10 tabs)
- `PaymentDashboard.tsx` (401 lines) — Revenue + dunning overview (6 tabs)

### What's MISSING (Critical Gaps)

**Gap 1 (CRITICAL): Dunning recovery actions NOT wired in PaymentDashboard.**
Server actions exist (`retrySubscriptionPaymentAction`, `extendGracePeriodAction`, `suspendSubscriptionForNonPaymentAction`, `reactivateAfterPaymentAction`) but there are ZERO action buttons in the PaymentDashboard or BillingDashboard. The dashboards display dunning data but are entirely read-only. Super admins cannot retry payments, extend grace periods, or handle non-payment.

**Gap 2 (HIGH): Bulk operations have no UI.**
`bulkUpdateSubscriptionStatusAction` exists but has no bulk selection UI or button. `syncAllOrganizationEntitlements` and `cleanupStaleEntitlements` exist but have no trigger in any dashboard.

**Gap 3 (HIGH): No suspend button in SubscriptionDrawer.**
The subscription drawer has Cancel + Reactivate buttons but no Suspend button. The `updateSubscriptionStatusAction` supports suspend but there is no UI for it.

**Gap 4 (HIGH): No invoice generation manual trigger.**
The billing dashboard shows invoices but has no "Generate Invoice" or "Create Invoice" button. Invoice generation is purely event-driven.

**Gap 5 (MEDIUM): No refund processing UI.**
Billing dashboard shows refunds but has no "Process Refund" button. Server-side refund service exists (`getRefunds` etc) but no create/trigger action.

**Gap 6 (MEDIUM): Usage-limit enforcement not visibly displayed.**
The subscription analytics service counts `subscriptionsOverMemberLimit` but there is no prominent usage vs limits visualization in the subscription drawer or org detail. Only checked during downgrade validation.

**Gap 7 (MEDIUM): Dispute, write-off, reconciliation management are read-only.**
Billing dashboard shows dispute/write-off/reconciliation data but has no action buttons. No "Resolve Dispute", "Write Off", "Reconcile" buttons exist.

**Gap 8 (MEDIUM): No trial reminder configuration.**
The trial service has `getTrialReminderOrgs` and `processExpiredTrials` but there's no UI to configure reminder timing or view pending trial expirations.

---

## Tasks

### Task 1: Wire Dunning Recovery Actions to PaymentDashboard (PRIORITY)

**Current:** `PaymentDashboard.tsx` (401 lines) has a "Dunning" tab showing dunning cases with read-only data. The dunning actions in `dunning-actions.ts` are never called from any UI.

**Required:** Add action buttons to each dunning case row in the Dunning tab:

1. **Dunning case card/row** — show organization name, package, dunning attempt count (X/3), next retry date, amount overdue, days since last attempt
2. **Action buttons per row:**
   - **Retry Payment** — calls `retrySubscriptionPaymentAction`, creates Razorpay order. Show spinner during processing. Show success toast with payment link.
   - **Extend Grace Period** — calls `extendGracePeriodAction`. Show date picker for new grace end date.
   - **Suspend for Non-Payment** — calls `suspendSubscriptionForNonPaymentAction`. Requires MFA + type-to-confirm.
   - **Reactivate After Payment** — calls `reactivateAfterPaymentAction`. Requires MFA + type-to-confirm (only show if status is suspended).
3. **Status indicators:**
   - Green: Within grace period
   - Amber: Retry attempt pending (1-2 attempts made)
   - Red: Max attempts reached or past grace period
4. **Dunning summary KPIs** at top of tab:
   - Active Dunning Cases | Past Grace Period | Pending Retry Today | Recently Resolved
5. **All actions require:** MFA step-up for destructive actions (suspend), rate limited, audit logged

**Files to modify:**
- `features/super-admin/components/payment-dashboard.tsx` — add dunning action buttons and modals

---

### Task 2: Add Bulk Subscription Operations UI

**Current:** `bulkUpdateSubscriptionStatusAction` exists but no UI. `syncAllOrganizationEntitlements` and `cleanupStaleEntitlements` exist but no trigger.

**Required:**

**Part A: Bulk subscription status update**
- Add multi-select checkboxes to `OrgSubscriptionTable` rows
- When 1+ rows selected, show a floating glass bulk action bar at the bottom (same pattern as Phase 1.1/1.2):
  - "N selected" label
  - Actions dropdown: Update Status (active/suspended/expired), Sync Entitlements
  - Confirm button with MFA step-up
- Wire to `bulkUpdateSubscriptionStatusAction` for status changes
- Wire to `syncAllOrganizationEntitlements` for entitlement sync

**Part B: Global sync buttons**
- Add "Sync All Entitlements" and "Cleanup Stale" buttons in the Subscriptions page header (next to "Create Package" button)
- Wire to `syncAllOrganizationEntitlements` and `cleanupStaleEntitlements`
- Show progress indicator during batch sync (processed N/Total, success/fail counts)
- Show summary toast: "Synced 142/150 orgs successfully, 8 failed"

**Files to modify:**
- `features/super-admin/components/subscriptions/OrgSubscriptionTable.tsx` — add checkboxes, bulk bar
- `app/(super-admin)/super-admin/subscriptions/subscriptions-client.tsx` — add global sync buttons, progress state

---

### Task 3: Add Suspend Button to SubscriptionDrawer

**Current:** The subscription drawer has Cancel and Reactivate buttons but no Suspend. The `updateSubscriptionStatusAction` in `subscription-actions.ts` supports suspend.

**Required:** Add a "Suspend" button in the SubscriptionDrawer's Lifecycle section:

1. **Button placement:** Between the existing "Cancel Subscription" and "Sync Entitlements" buttons
2. **Button label:** "Suspend Subscription" (only visible for active/trial statuses)
3. **On click:** Open `SuspendModal` with:
   - Warning banner: "Suspending will block all organization users until reactivated"
   - Reason textarea (min 10 chars)
   - MFA step-up email input
   - Type-to-confirm: Type "SUSPEND"
   - "Suspend Subscription" button (destructive styling)
4. Wire to a new `suspendSubscriptionAction` (or reuse `updateSubscriptionStatusAction` with status="suspended")
5. If reusing `updateSubscriptionStatusAction`, extend its schema to require MFA (add stepUpEmail field)

**Files to create:**
- `features/super-admin/components/subscriptions/SuspendModal.tsx`

**Files to modify:**
- `app/(super-admin)/super-admin/subscriptions/subscriptions-client.tsx` — add Suspend button + modal state
- `features/super-admin/schemas/subscription-schemas.ts` — extend update subscription schema with MFA
- `features/super-admin/actions/subscription-actions.ts` — wire MFA check into status update

---

### Task 4: Add Invoice Generation Manual Trigger

**Current:** Billing dashboard shows invoices but has no "Generate Invoice" button. Invoice generation is purely event-driven (Razorpay webhooks, cron jobs).

**Required:**
1. Add "Generate Invoice" button in the Billing Dashboard header and in the SubscriptionDrawer invoices tab
2. `GenerateInvoiceModal` with:
   - Organization select (pre-filled from context)
   - Invoice type: Subscription (recurring) or One-time
   - Amount in paise (with INR conversion display)
   - Description/line items textarea
   - Due date picker
   - Generate button
3. Wire to a new `generateInvoiceAction` server action that:
   - Creates an invoice in `org_subscription_invoices` table
   - Links to subscription if applicable
   - Writes audit log
   - Returns invoice ID for reference
4. Show success toast with invoice ID + link to view

**Files to create:**
- `features/super-admin/actions/billing-actions.ts` — add `generateInvoiceAction`
- `features/super-admin/components/billing/GenerateInvoiceModal.tsx`

**Files to modify:**
- `app/(super-admin)/super-admin/billing/billing-dashboard.tsx` — add Generate Invoice button
- `app/(super-admin)/super-admin/subscriptions/subscriptions-client.tsx` — add Generate Invoice button in drawer invoices tab

---

### Task 5: Add Refund Processing UI

**Current:** Billing dashboard shows refunds in a read-only table. No "Process Refund" button.

**Required:**
1. Add "Process Refund" button in the Billing Dashboard header and inline on payment rows
2. `ProcessRefundModal` with:
   - Payment/invoice selector (search by ID or org)
   - Amount (pre-filled to full payment, editable to partial)
   - Refund reason (select: Duplicate, Customer Request, Service Issue, Fraud, Other) + free text
   - MFA step-up email input
   - Type-to-confirm: Type "REFUND:{amount}"
3. Wire to a new `processRefundAction` server action that:
   - Creates refund record in `refunds` table
   - Updates payment status
   - For Razorpay payments: triggers `POST /api/billing/razorpay/refunds`
   - Writes audit log

**Files to create:**
- `features/super-admin/actions/billing-actions.ts` — add `processRefundAction`
- `features/super-admin/components/billing/ProcessRefundModal.tsx`

**Files to modify:**
- `app/(super-admin)/super-admin/billing/billing-dashboard.tsx` — add Refund buttons

---

### Task 6: Add Usage-Limit Enforcement Visualization

**Current:** Usage limits are only checked during downgrade validation. No prominent visualization anywhere.

**Required:**
1. **SubscriptionDrawer usage tab** — add a new "Usage" tab in the subscription drawer (between "Addons" and "Scheduled"):
   - Card grid showing each limit type with progress bars (same pattern as Phase 1.2 Task 4):
     - Members | Branches | Gyms | Trainers | Staff | Storage | API Calls | SMS
   - Each card: limit name, current usage / max limit (or "Unlimited"), color-coded progress bar
   - Warnings section: if any org is over limit, show red cards with "OVER LIMIT" badge

2. **Org detail page usage tab** — add a prominent "Usage & Limits" section (this was also defined in Phase 1.2 Task 4, coordinate to avoid duplication).

3. **Subscription analytics risks section** — The `SubscriptionsClient` already calculates risk items. Add a "Usage Alerts" section showing orgs near/over their limits with action links.

**Files to modify:**
- `app/(super-admin)/super-admin/subscriptions/subscriptions-client.tsx` — add Usage tab in subscription drawer, enhance risks section
- `features/super-admin/services/subscription-usage-service.ts` — ensure it provides all limit types

---

### Task 7: Add Dispute, Write-Off & Reconciliation Actions

**Current:** Billing dashboard shows dispute/write-off/reconciliation data in read-only tables. No action buttons.

**Required:**

**Part A: Dispute Management**
- Each dispute row gets action buttons:
  - **Resolve** (favor merchant) — marks dispute as resolved, reverses hold on funds
  - **Accept** (favor customer) — marks dispute as lost, writes off amount
  - **Escalate** — marks as escalated for manual review
- Each action opens a confirmation modal with:
  - Reason/notes textarea
  - MFA step-up email input
  - Type-to-confirm

**Part B: Write-Off Management**
- Add "Write Off" button in Write-Offs tab header
- `CreateWriteOffModal` with:
  - Organization select
  - Amount in paise
  - Reason (select: Bad Debt, Fraud, Abandoned, Other + free text)
  - MFA step-up
  - Type-to-confirm: Type "WRITE_OFF:{amount}"
- Existing write-off rows get "Reverse" button

**Part C: Reconciliation**
- Each unreconciled entry gets "Mark Reconciled" button
- Add "Run Reconciliation" button in header that triggers reconciliation process
- Show confirmation with matched/unmatched count

**Files to create:**
- `features/super-admin/actions/billing-actions.ts` — add dispute/write-off/reconciliation actions

**Files to modify:**
- `app/(super-admin)/super-admin/billing/billing-dashboard.tsx` — add action buttons per tab

---

### Task 8: Add Trial Reminder Configuration & Expiry View

**Current:** Trial service has `getTrialReminderOrgs` and `processExpiredTrials` but no UI to manage trial configurations.

**Required:**
1. Add "Trial Management" section to the Subscriptions page (as a sub-tab or collapsible panel):
   - **Active trials list** — org name, trial start date, trial end date, days remaining, package name, convert/cancel action buttons
   - **Recently expired trials** — org name, expired date, package, reactivate button
   - **Trial configuration** — default trial days (modifiable), reminder timing (send reminder N days before expiry)
   - **Conversion rate KPI** — percentage of trials converted, trend over time

2. **Trial expiry warnings** — in the Overview tab's risk pills, add "X trials expiring in 7 days"

3. Wire to existing actions: `extendTrialAction`, `convertTrialAction` (both already exist with UI in the drawer)

**Files to modify:**
- `app/(super-admin)/super-admin/subscriptions/subscriptions-client.tsx` — add Trial Management section

---

### Task 9: UI Polish — Glass Effects & Cinematic Styling

Apply the design standards from `SUPER_ADMIN_PRODUCTION_PLAN.md` to ALL subscription/billing UI:

**Required style changes:**

1. **Subscriptions page header** — sticky glass header:
   ```
   bg-background/90 backdrop-blur sticky top-0 z-10 border-b border-border -mx-5 px-5 py-4 space-y-4
   ```

2. **Subscription analytics KPI cards** — add reveal-up staggered animation:
   ```
   <div className="reveal-up rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-4 transition-all hover:shadow-md hover:border-border-strong"
        style={{"--reveal-delay": `${i * 0.05}s`}}>
   ```

3. **Subscription drawer** — already uses slide-in pattern, ensure:
   ```
   backdrop: bg-ink/40 backdrop-blur-sm
   dialog: ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden rounded-l-lg border border-border bg-surface shadow-2xl animate-slide-in-right
   header: bg-background/90 backdrop-blur border-b border-border
   ```

4. **Package editor modal** — glass backdrop-blur, premium shadow:
   ```
   <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 backdrop-blur-sm p-4">
     <div className="w-full max-w-3xl rounded-lg border border-border bg-surface shadow-2xl max-h-[90vh] overflow-y-auto">
   ```

5. **Billing dashboard** — add header glass, tab glass bar:
   ```
   Tab bar: sticky top-0 z-[5] bg-background/90 backdrop-blur border-b border-border
   ```

6. **Bulk action bar** — floating glass bar at bottom (same pattern as Phase 1.1/1.2):
   ```
   fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-lg border border-border bg-surface/95 backdrop-blur shadow-2xl px-4 py-3 flex items-center gap-3 animate-slide-in-right
   ```

7. **Dunning case cards** — glass card with status-colored left border:
   ```
   rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-4
   border-l-4 border-l-green-500|amber-500|red-500
   ```

8. **Usage progress bars** (reuse from Phase 1.2):
   ```
   <div className="h-2 rounded-full bg-surface-muted">
     <div className="h-full rounded-full transition-all duration-500"
          style={{width, backgroundColor: ratio < 0.7 ? "#16A34A" : ratio < 0.9 ? "#D97706" : "#D92D20"}} />
   </div>
   ```

9. **Empty states** — centered dashed-border container:
   ```
   rounded-lg border border-dashed border-border bg-background p-12 text-center
   ```

10. **Modal action buttons** — consistent styling:
    - Primary/confirm: `bg-accent text-accent-foreground hover:-translate-y-0.5 transition-transform`
    - Destructive: `bg-destructive text-destructive-foreground`
    - Cancel/secondary: `border border-border bg-surface text-foreground hover:bg-surface-muted`

11. **Invoice tables** — each row with hover state:
    ```
    transition-colors hover:bg-surface-muted
    ```

12. **Risk pills** (in subscription drawer) — rounded-full badge:
    ```
    inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black
    ```

---

### Task 10: Fix Data & Type Issues

1. **Fix MRR/ARR calculation mismatch** — The server (`subscription-analytics-service.ts`) normalizes price by billing period using `billingPeriods` map (monthly: 1, quarterly: 3, half_yearly: 6, annual: 12). The client (`subscriptions-client.tsx`) uses `periodMap` (monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12). Ensure both use the same map and produce identical numbers.

2. **Fix currency formatting** — Some components display amounts in paise without conversion. Others use `formatCurrency` from enterprise lib. Standardize on `formatCurrency` everywhere.

3. **Fix payment dashboard dunning tab** — It currently reads from `data.metrics` but the dunning-specific data comes from `data.dunning`. Ensure the tab correctly receives and renders dunning data.

---

## Files Summary

### Files to CREATE:
| File | Purpose |
|------|---------|
| `features/super-admin/components/subscriptions/SuspendModal.tsx` | Suspend subscription modal with MFA |
| `features/super-admin/components/billing/GenerateInvoiceModal.tsx` | Manual invoice generation modal |
| `features/super-admin/components/billing/ProcessRefundModal.tsx` | Refund processing modal |
| `features/super-admin/actions/billing-actions.ts` | Invoice, refund, dispute, write-off, reconciliation server actions |

### Files to MODIFY:
| File | Changes |
|------|---------|
| `features/super-admin/components/payment-dashboard.tsx` | Wire dunning action buttons (retry payment, extend grace, suspend, reactivate), add modals |
| `features/super-admin/components/subscriptions/OrgSubscriptionTable.tsx` | Add multi-select checkboxes, bulk action bar |
| `app/(super-admin)/super-admin/subscriptions/subscriptions-client.tsx` | Add global sync buttons, suspend button, usage tab, trial management section, glass styling |
| `app/(super-admin)/super-admin/billing/billing-dashboard.tsx` | Add generate invoice, process refund, dispute/write-off/reconciliation action buttons, glass styling |
| `features/super-admin/schemas/subscription-schemas.ts` | Extend update status schema with MFA fields |
| `features/super-admin/actions/subscription-actions.ts` | Wire MFA check into status update |

---

## UI Styling Guidelines

Follow the design system in `docs/SUPER_ADMIN_PRODUCTION_PLAN.md` exactly. Key patterns to use:

### Subscription Drawer Glass Header
```tsx
<div className="flex items-center justify-between px-5 py-4 bg-background/90 backdrop-blur border-b border-border">
  <div>
    <h2 className="text-lg font-black">{org.name}</h2>
    <p className="text-xs text-muted-foreground">Subscription Management</p>
  </div>
  <button onClick={onClose} className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted grid place-items-center">
    <X className="size-4" />
  </button>
</div>
```

### Dunning Case Card
```tsx
<div className="rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-4 border-l-4 border-l-amber-500 transition-all hover:shadow-md">
  <div className="flex items-start justify-between">
    <div>
      <div className="text-sm font-black">{org.name}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        Attempt {attempts}/3 · Next retry: {formatDate(nextRetry)}
      </div>
      <div className="mt-0.5 text-xs font-black text-destructive">₹{formatAmount(overdue)} overdue</div>
    </div>
    <div className="flex items-center gap-1">
      <button onClick={...} className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted transition-all grid place-items-center" title="Retry Payment">
        <RefreshCw className="size-4" />
      </button>
      <button onClick={...} className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted transition-all grid place-items-center" title="Extend Grace">
        <CalendarPlus className="size-4" />
      </button>
      <button onClick={...} className="size-8 rounded-md border border-border bg-background hover:bg-destructive/10 hover:border-destructive/30 text-destructive transition-all grid place-items-center" title="Suspend">
        <PauseCircle className="size-4" />
      </button>
    </div>
  </div>
</div>
```

### Usage Progress Bar
```tsx
<div className="rounded-lg border border-border bg-background p-4">
  <div className="flex items-center justify-between">
    <span className="text-sm font-black">{limitName}</span>
    <span className={`text-xs font-black ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
      {current} / {limit === -1 ? "∞" : limit}
    </span>
  </div>
  {limit > 0 ? (
    <div className="mt-2 h-2 rounded-full bg-surface-muted">
      <div className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.min((current / limit) * 100, 100)}%`,
          backgroundColor: ratio < 0.7 ? "#16A34A" : ratio < 0.9 ? "#D97706" : "#D92D20"
        }}
      />
    </div>
  ) : (
    <p className="mt-1 text-xs text-muted-foreground">Unlimited on this plan</p>
  )}
  {isOverLimit && (
    <p className="mt-1 text-xs font-black text-destructive">⚠ Over limit by {current - limit}</p>
  )}
</div>
```

### Bulk Action Bar
```tsx
{selectedIds.length > 0 && (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-lg border border-border bg-surface/95 backdrop-blur shadow-2xl px-4 py-3 flex items-center gap-3 animate-slide-in-right">
    <span className="text-sm font-black">{selectedIds.length} selected</span>
    <div className="w-px h-5 bg-border" />
    <select className="h-9 rounded-md border border-border bg-surface px-2 text-xs">
      <option value="">Bulk action...</option>
      <option value="active">Set Active</option>
      <option value="suspended">Set Suspended</option>
      <option value="expired">Set Expired</option>
    </select>
    <button disabled={!bulkAction} onClick={...}
      className="h-9 rounded-md border border-border bg-background px-3 text-xs font-black hover:bg-surface-muted transition-all">
      Apply
    </button>
  </div>
)}
```

### KPI Cards Row
```tsx
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
```

### Sync Button with Progress
```tsx
<button onClick={handleSyncAll}
  className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted transition-all"
  disabled={syncing}
>
  {syncing ? (
    <>
      <Loader2 className="size-4 animate-spin" />
      Syncing ({syncedCount}/{totalCount})...
    </>
  ) : (
    <>
      <RefreshCw className="size-4" />
      Sync All Entitlements
    </>
  )}
</button>
```

---

## Verification Checklist

After completing all tasks, verify:

### Fixes
- [ ] Dunning tab shows action buttons: Retry Payment, Extend Grace, Suspend, Reactivate
- [ ] All dunning operations work end-to-end (retry creates Razorpay order, suspend blocks org)
- [ ] Bulk operations: multi-select subscriptions, bulk status update works
- [ ] Global sync buttons work with progress indicator

### New Features
- [ ] Suspend button in SubscriptionDrawer works with MFA + type-to-confirm
- [ ] Invoice generation creates real invoice record
- [ ] Refund processing creates refund record + (optionally) Razorpay refund
- [ ] Usage tab in subscription drawer shows progress bars for all limit types
- [ ] Dispute management: Resolve/Accept/Escalate work
- [ ] Write-off creation and reversal work
- [ ] Reconciliation mark/re-run works
- [ ] Trial management section shows active trials, expiring soon, conversion rate

### Styling
- [ ] Subscriptions page has sticky glass header
- [ ] Package editor modal has backdrop-blur + premium shadow
- [ ] Subscription drawer has slide-in animation with glass header
- [ ] Dunning cards have color-coded left border
- [ ] Usage progress bars animate width on load
- [ ] Bulk action bar appears with slide-in animation
- [ ] KPI cards animate in with staggered reveal

### Security
- [ ] All destructive actions (suspend, refund, write-off) require MFA + type-to-confirm
- [ ] All writes gated with `requireRole(["super_admin"])`
- [ ] All writes produce audit log entries
- [ ] Rate limiting on bulk operations and refunds
- [ ] Dunning actions respect the existing `verifyCriticalSuperAdminAccess` pattern

### Build
- [ ] `npm run typecheck` passes (0 errors)
- [ ] `npm run lint` passes (0 new errors)
- [ ] `npm run build` completes
- [ ] No page/console errors at `/super-admin/subscriptions`, `/super-admin/billing`

---

## Important Notes

1. **Do NOT modify existing server action signatures.** Add new actions in `billing-actions.ts` rather than changing the complex subscription-enterprise-actions.ts.

2. **Reuse the MFA verification pattern.** All existing actions use `verifyCriticalSuperAdminAccess` or `verifyMfaStepUp` from the respective action files. Use the same pattern for new actions.

3. **Do NOT change the database schema.** All new data uses existing tables. Invoice generation creates records in `org_subscription_invoices`. Refunds use `refunds` table. Disputes use `billing_disputes`.

4. **The PaymentDashboard is in `features/super-admin/components/payment-dashboard.tsx`**, not the billing dashboard. Make sure to modify the correct file.

5. **Coordinate with Phase 1.2.** The "Usage tab in org detail" was also described in Phase 1.2 Task 4. If Phase 1.2 hasn't been run yet, this phase should build it. If it has been run, skip that part and only build the subscription drawer usage tab.
