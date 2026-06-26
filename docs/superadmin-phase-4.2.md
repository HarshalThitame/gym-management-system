# Super Admin Phase 4.2 — Performance & Security Hardening

> **Master plan:** `docs/SUPER_ADMIN_PRODUCTION_PLAN.md`
> **Duration:** ~1 day
> **Type:** Audit + optimization (Lighthouse, bundle, security, build validation)

---

## Context

After all Phases 1-3 and Phase 4.1 are complete, this phase validates the entire super admin portal against production readiness criteria: Lighthouse scores, bundle size, security audit, rate limiting completeness, audit log completeness, and build verification.

### What Already Exists

- Rate limiting library (`lib/rate-limit.ts`) but not applied to all endpoints
- Audit logging (`lib/audit.ts`) but some new actions may not call it
- Security guards (`requireRole`, MFA step-up) but inconsistent application
- Existing Lighthouse/build pipeline in CI

---

## Tasks

### Task 1: Lighthouse Audit

Run Lighthouse CI against all super admin pages:

1. **Login page** — `/login`
2. **Dashboard** — `/super-admin`
3. **Organizations** — `/super-admin/organizations`
4. **Users** — `/super-admin/users`
5. **Subscriptions** — `/super-admin/subscriptions`
6. **Backups** — `/super-admin/backups`
7. **Security** — `/super-admin/security`
8. **Support** — `/super-admin/support`
9. **Billing** — `/super-admin/billing`
10. **Monitoring** — `/super-admin/monitoring`

**Target scores:** Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95

**Fix any regressions below target:**
- Large bundle warnings → code-split heavy components
- Missing `alt` text on images → add descriptive alt attributes
- Missing `aria-*` attributes on interactive elements → add ARIA labels
- Render-blocking resources → defer non-critical CSS/JS
- Missing meta viewport/description on any page → add to layout metadata

---

### Task 2: Bundle Analysis

Analyze the production JavaScript bundle:

1. Run `ANALYZE=true next build` (or use `@next/bundle-analyzer`)
2. Identify large modules:
   - Any single chunk > 150KB → split into dynamic imports
   - Recharts components → dynamic import with `next/dynamic`
   - Radix UI primitives → tree-shake unused imports
   - moment.js or date-fns → verify date-fns is used (tree-shakeable)
3. Check for duplicate dependencies: `npx dpdm` or `npm ls`

**Fixes:**
```typescript
// Before
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

// After
import dynamic from "next/dynamic"
const BarChart = dynamic(() => import("recharts").then(m => m.BarChart), { ssr: false })
const Bar = dynamic(() => import("recharts").then(m => m.Bar))
```

---

### Task 3: Security Audit — Server Action Gating

**Required:** Audit ALL super admin server actions to ensure they are gated:

1. List every exported function from `features/super-admin/actions/`
2. For each, check:
   - `requireRole(["super_admin"])` is called at the top
   - Rate limiting is applied (`checkRateLimit` or similar)
   - Destructive actions have MFA step-up (`verifyCriticalSuperAdminAccess` or `verifyMfaStepUp`)
   - Destructive actions require type-to-confirm
   - Audit log is written (`writeAuditLog`)
   - Input is validated via Zod schema
3. Create an audit spreadsheet/document with status for each action

**Fix any unguarded actions** by adding the missing guards.

---

### Task 4: Rate Limiting Hardening

**Required:** Ensure ALL mutation endpoints have appropriate rate limits:

| Action Type | Rate Limit | Notes |
|-------------|-----------|-------|
| Create/update (org, user, role, gym) | 20/60s | Standard CRUD |
| Destructive (delete, suspend, force delete) | 5/60s | Higher latency impact |
| Bulk operations | 1/120s | Always slow |
| Backup create/delete | 5/60s | |
| Package create/update | 10/60s | |
| Subscription lifecycle (upgrade/downgrade/cancel) | 5/60s | |
| Refund, invoice, write-off | 5/60s | Financial impact |
| File upload | 10/60s | Memory/resource usage |
| Approval operations | 20/60s | |

**Add missing rate limits** using the existing `checkRateLimit` pattern from `user-management-actions.ts`.

---

### Task 5: Audit Log Completeness

**Required:** Verify every super admin server action writes to `audit_logs`:

1. Cross-reference action list from Task 3 with `writeAuditLog` calls
2. For each action, verify:
   - Action name is descriptive (e.g., "super_admin.organization.delete")
   - Actor ID is captured
   - Target entity ID is captured
   - Before/after snapshots are captured for destructive actions
   - Severity is appropriate (critical for destructive, notice for standard)
3. **Fix missing audit logs** — add `writeAuditLog` to any action that lacks it

---

### Task 6: Final Build Verification

```bash
npm run typecheck    # 0 errors
npm run lint         # 0 new errors
npm run build        # Must complete
npm test             # 74+ tests pass
npx playwright test tests/e2e/super-admin-* --project=chromium  # All super admin E2E pass
```

**Fix any build/test failures** before declaring completion.

---

## Verification Checklist

- [ ] Lighthouse scores: Performance ≥ 85, A11Y ≥ 95, Best Practices ≥ 95, SEO ≥ 95
- [ ] No JS chunks > 150KB
- [ ] All Recharts charts are dynamically imported
- [ ] All server actions have `requireRole(["super_admin"])` guard
- [ ] All destructive actions have MFA step-up
- [ ] All destructive actions have type-to-confirm
- [ ] All mutation endpoints have appropriate rate limits
- [ ] All server actions write audit logs
- [ ] `npm run typecheck` passes (0 errors)
- [ ] `npm run lint` passes (0 new errors)
- [ ] `npm run build` completes
- [ ] `npm test` — all 74+ tests pass
- [ ] All super admin Playwright tests pass
