# Super Admin Phase 4.1 — E2E Testing

> **Master plan:** `docs/SUPER_ADMIN_PRODUCTION_PLAN.md`
> **Duration:** ~1 day
> **Type:** Testing (Playwright E2E specs for all new workflows)

---

## Context

There are 54 existing Playwright test spec files (19,318 lines), including 16 super-admin-specific specs. However, the new workflows built in Phases 1-3 need corresponding E2E tests. This phase adds 20+ new test specs covering all lifecycle workflows, destructive actions, subscription operations, backup operations, and feature gating.

### Existing Super Admin Tests (16 files)
- `super-admin-audit.spec.ts` — Portal stability, KPI presence, Org/Gym create validation
- `super-admin-analytics.spec.ts` — Analytics route + chart rendering
- `super-admin-backups.spec.ts` — Backup dashboard render
- `super-admin-billing.spec.ts` — Billing dashboard render
- `super-admin-dashboard.spec.ts` — Dashboard KPI validation
- `super-admin-domains.spec.ts` — Domain management
- `super-admin-gyms.spec.ts` — Gym CRUD
- `super-admin-modules-audit.spec.ts` — All module route sweep
- `super-admin-monitoring.spec.ts` — Monitoring dashboard
- `super-admin-organizations.spec.ts` — Org CRUD
- `super-admin-roles.spec.ts` — Role CRUD
- `super-admin-security.spec.ts` — Security pages
- `super-admin-subscriptions.spec.ts` — Subscription pages
- `super-admin-support.spec.ts` — Support pages
- `super-admin-users.spec.ts` — User pages
- `super-admin-users-roles-responsive.spec.ts` — Mobile responsive

### What's Missing (New Tests Needed)

Each new workflow from Phases 1-3 needs its own Playwright spec:

---

## Tasks

### Task 1: User Lifecycle E2E (Phase 1.1)

Create `tests/e2e/super-admin-user-lifecycle.spec.ts`:
- Invite a new user via the Invite User form
- Verify user appears in the user list
- Reset password for the user
- Force logout the user
- Suspend the user
- Reactivate the user
- View login history on user detail page
- Add account note to user
- Verify all actions produce audit log entries
- Verify MFA is required for destructive actions
- Verify type-to-confirm is required

### Task 2: Organization Lifecycle E2E (Phase 1.2)

Create `tests/e2e/super-admin-org-lifecycle.spec.ts`:
- Create a new organization
- Verify org appears in org list with correct status
- Edit org profile
- Suspend org → verify approval request created
- Activate org directly → verify immediate status change
- Request soft delete → verify approval request created
- Transfer ownership → verify approval request created
- Verify approval approve/reject workflow
- Verify revenue/usage drilldown renders on detail page
- Verify gym/branch statistics on detail page

### Task 3: Subscription Operations E2E (Phase 1.3)

Create `tests/e2e/super-admin-subscription-operations.spec.ts`:
- Assign package to org
- Upgrade org to higher package
- Downgrade org to lower package (verify scheduled change created)
- Cancel subscription (end_of_period)
- Reactivate cancelled subscription
- Extend trial
- Convert trial to paid
- Assign add-on to subscription
- Remove add-on from subscription
- Override subscription price
- Sync entitlements for an org
- Verify bulk sync + cleanup stale operations

### Task 4: Backup Operations E2E (Phase 1.4)

Create `tests/e2e/super-admin-backup-operations.spec.ts`:
- Create a new backup (database type, platform scope)
- Verify backup appears in backup list
- Delete a completed backup (verify type-to-confirm + MFA)
- Open recovery wizard → walk through to step 3
- Create a backup schedule
- Edit backup schedule
- Delete backup schedule
- Generate compliance report
- Verify all tabs render with real data

### Task 5: File Upload Security E2E (Phase 2.1)

Create `tests/e2e/super-admin-file-upload-security.spec.ts`:
- Upload valid logo → verify success
- Upload file with spoofed extension (.exe renamed to .png) → verify rejection
- Upload file with path traversal in name → verify sanitization
- Upload oversized file (>2MB) → verify 413 rejection
- Upload oversize logo (>512px) → verify dimension rejection
- Upload non-square favicon → verify rejection
- Exceed rate limit → verify 429 response

### Task 6: Feature Gating & Entitlement Guard E2E

Create `tests/e2e/super-admin-entitlement-guards.spec.ts`:
- Verify all new server actions are gated with `requireRole(["super_admin"])`
- Verify direct URL access to all super admin routes for non-super-admin returns redirect/403
- Verify all destructive actions require MFA + type-to-confirm
- Verify all writes produce audit log entries (check audit tab after action)

### Task 7: Mobile Responsive Pass

Update `tests/e2e/super-admin-users-roles-responsive.spec.ts`:
- Test all new UI modals/drawers at mobile viewport (375×812)
- Test floating bulk action bar at mobile viewport
- Test recovery wizard at mobile viewport
- Test backup creation modal at mobile viewport

---

## Test Structure Pattern

Each test follows the existing pattern from `super-admin-audit.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Super Admin: User Lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill("[name=email]", process.env.SUPER_ADMIN_EMAIL!);
    await page.fill("[name=password]", process.env.SUPER_ADMIN_PASSWORD!);
    await page.click("button[type=submit]");
    await page.waitForURL("/super-admin");
  });

  test("invite a new user", async ({ page }) => {
    await page.goto("/super-admin/users");
    await page.click("text=Invite User");
    // ... fill form ...
    await page.click("button:has-text('Send Invite')");
    await expect(page.locator("text=User invited successfully")).toBeVisible();
  });
});
```

---

## Verification Checklist

- [ ] User lifecycle test passes (invite → reset → logout → suspend → reactivate → delete)
- [ ] Org lifecycle test passes (create → edit → suspend → activate → transfer → delete)
- [ ] Subscription operations test passes (assign → upgrade → downgrade → cancel → reactivate → addon)
- [ ] Backup operations test passes (create → list → delete → schedule → compliance report)
- [ ] File upload security test passes (valid, spoofed, oversized, path traversal, rate limit)
- [ ] Entitlement guard test passes (role check, URL access, MFA, audit logs)
- [ ] Mobile responsive test passes for all new modals/drawers
- [ ] All 20+ new test files pass in CI
- [ ] Total test count: 54 + 20 = 74+ passing
