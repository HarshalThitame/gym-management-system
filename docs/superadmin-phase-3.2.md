# Super Admin Phase 3.2 — UX Governance Automation

> **Master plan:** `docs/SUPER_ADMIN_PRODUCTION_PLAN.md`
> **Duration:** ~0.5 day
> **Type:** Build (automated UX compliance checking)

---

## Context

The UX Governance page is currently a static reference document listing design tokens, component library, accessibility features, and standards. There is **no automated monitoring, no scoring, and no compliance enforcement**. This phase converts it into a live compliance dashboard.

### What Already Exists

**UX Governance Dashboard** (`ux-governance-dashboard.tsx`, 131 lines):
- 11 static reference sections in card grid
- Amber warning banner: "Automated UX governance monitoring is not yet configured"
- Design tokens, component library, accessibility features (all hardcoded reference text)
- No directory at `features/super-admin/components/ux-governance/`

### What's MISSING

1. No automated design token scanning (hardcoded colors vs CSS variables)
2. No component usage compliance monitoring
3. No accessibility regression detection
4. No UX quality score
5. No bundle size monitoring

---

## Tasks

### Task 1: Build Design Token Scanner

**Required:** Create a scanner that checks for hardcoded color/typography values in the codebase:

1. **Color scanner** — search `*.tsx` and `*.tsx` files for hardcoded color values (`#hex`, `rgb(`, `rgba(`) outside of `globals.css` and tailwind classes
2. **Typography scanner** — search for hardcoded font sizes (`text-[...]`) or font-family declarations outside the design system
3. **Spacing scanner** — search for hardcoded spacing values (`p-[...]`, `m-[...]`, `gap-[...]`) that don't match the 4px grid

Return results grouped by severity: violations, warnings, info.

**File to create:**
- `features/super-admin/services/ux-governance-service.ts` — scanners + scoring

---

### Task 2: Build UX Quality Score

**Required:** Compute a composite UX quality score (0-100) from:

| Metric | Weight | Source |
|--------|--------|--------|
| Design token compliance | 25% | Scanner results |
| Accessibility attributes | 20% | Scan for `aria-*`, `role`, `alt` on images |
| Component library usage | 15% | Check for raw `<button>` vs `<Button>` usage |
| Loading states | 15% | Count modules with loading.tsx |
| Error states | 15% | Count modules with error.tsx |
| Mobile responsive | 10% | Check for responsive class patterns |

**File to modify:**
- `features/super-admin/services/ux-governance-service.ts` — score computation

---

### Task 3: Wire Dashboard with Real Data

**Current:** Static reference cards.

**Required:**
1. Replace each static card with live data from `ux-governance-service.ts`
2. Score card shows overall UX quality score with progress ring (same style as Phase 3.1 compliance)
3. Each category shows pass/fail/warning status
4. Amber warning banner replaced with real scores
5. "Run Audit" button triggers re-scan
6. Audit history — previous scan results with timestamps, trend arrow

**Files to modify:**
- `app/(super-admin)/super-admin/ux-governance/ux-governance-dashboard.tsx` — wire real data

---

### Task 4: UI Polish

- Progress ring for overall score (same pattern as compliance cards)
- Category cards with pass/fail badges
- Violation list with expandable details
- `reveal-up` staggered animation
- Last scanned timestamp with "Run Audit" button

---

## Verification Checklist

- [ ] Design token scanner finds hardcoded colors outside the design system
- [ ] UX quality score is computed and displayed
- [ ] Each category shows real compliance data
- [ ] "Run Audit" button triggers re-scan with progress
- [ ] Audit history shows previous results
- [ ] Amber warning banner replaced with real scores
- [ ] `npm run typecheck` passes
