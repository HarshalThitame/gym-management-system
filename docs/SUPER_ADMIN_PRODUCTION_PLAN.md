# Super Admin Production Readiness Plan

> **Last updated:** 2026-06-25
> **Parent plan:** `docs/ENTERPRISE_PRODUCTION_PLAN.md`
> **Target:** All super admin features UI-accessible, workable, real data, enterprise production ready
> **Current readiness:** 86% (per QA Report `docs/52-super-admin-qa-report.md`)
> **Timeline:** ~10 days across 10 phases

---

## Quick Reference

| Doc | Purpose |
|-----|---------|
| `docs/ENTERPRISE_PRODUCTION_PLAN.md` | Org Owner features (CRM, reports, payroll, etc.) |
| `docs/52-super-admin-qa-report.md` | Current QA state, SAR risks, test coverage |
| `docs/SUPER_ADMIN_PRODUCTION_PLAN.md` | **This file** — Super Admin master plan |
| `docs/superadmin-phase-X.Y.md` | Per-phase detailed prompts |

---

## Core Principles

1. **All features MUST be on UI.** Every server action must have a corresponding UI form/dialog/button. No orphaned actions.
2. **All data MUST be real.** No mock/simulated/placeholder data. Every dashboard KPI, table row, and chart comes from actual DB queries.
3. **Enterprise production ready.** Destructive actions require type-to-confirm + MFA. Rate limiting on all writes. Audit logs on all changes.
4. **Stylish, modern, cinematic UI.** Glass/backdrop-blur modals, premium shadows, smooth CSS animations, cinematic hover states.
5. **Build stays green.** typecheck/lint/build pass after every phase.

---

## UI Design Standards

All super admin UI must follow these conventions:

### Color Tokens (from `app/globals.css`)
| Token | Usage |
|-------|-------|
| `bg-surface` / `text-foreground` | Cards, modals, panels |
| `bg-background` / `text-foreground` | Page backgrounds, inner rows |
| `bg-accent` (#C8F24A) / `text-accent-foreground` | Primary CTA, highlights |
| `bg-secondary` (#22D3EE) / `text-secondary-foreground` | Data links, active states |
| `bg-destructive` (#D92D20) | Delete/danger buttons |
| `bg-surface-muted` | Secondary backgrounds, hover states |

### Glass/Cinematic Patterns
| Element | Pattern |
|---------|---------|
| **Modal backdrop** | `fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm` |
| **Modal dialog** | `rounded-lg border border-border bg-surface shadow-2xl` |
| **Glass card (dark)** | `rounded-lg border border-white/10 bg-white/[0.06] backdrop-blur` |
| **Glass header** | `bg-background/90 backdrop-blur border-b border-border` |
| **Premium shadow** | `shadow-[0_18px_60px_rgb(17_18_20/0.06)]` for cards<br>`shadow-2xl` for modals |

### Typography
- Headings: `font-black` (900 weight), sizes: `text-2xl` to `text-5xl`
- Overlines/labels: `text-xs font-black uppercase tracking-[0.14em] text-muted-foreground`
- Body: `text-sm leading-6 text-muted-foreground`
- Stat values: `text-3xl font-black` or `text-4xl font-black`

### Animation
- Page reveal: `<div className="reveal-up">` (0.45s ease-out, translateY 14px)
- Staggered: `style={{ "--reveal-delay": `${index * 0.05}s` }}`
- Button hover: `hover:-translate-y-0.5 transition-transform`
- Card hover: `transition-all hover:shadow-md hover:border-border-strong`
- No framer-motion imports (use CSS animations only)

### Layout Grid
- Section spacing: `space-y-8` between major sections
- Standard grid: `grid gap-5`
- 2-column layout: `grid gap-5 xl:grid-cols-2`
- Metric quad: `grid gap-4 md:grid-cols-2 xl:grid-cols-4`
- Asymmetric: `grid gap-5 xl:grid-cols-[1.35fr_0.65fr]`

### Card Styling
- Outer card: `rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-5 md:p-6`
- Inner row: `rounded-md border border-border bg-background p-4`
- Glass variant: `rounded-lg border border-white/10 bg-white/[0.06] backdrop-blur p-5`

### Status Colors
- Success: `text-green-700 bg-green-50 border-green-200`
- Warning: `text-amber-800 bg-amber-50 border-amber-200`
- Error: `text-red-700 bg-red-50 border-red-200`
- Info: `text-cyan-800 bg-cyan-50 border-cyan-200`
- Premium/accent: `bg-accent text-accent-foreground border-accent/60`

### Form Elements
- Input: `h-11 rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm`
- Select: same as input
- Search: `h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-base shadow-sm`
- Focus: `focus-visible:outline-2 focus-visible:outline-offset-2 outline-[var(--ring)]`

---

## Phase Plan

### Phase 1: Critical Production Gaps (SAR-001 to SAR-004)

| Phase | Doc | Risk | Description | Effort |
|-------|-----|------|-------------|--------|
| 1.1 | `docs/superadmin-phase-1.1.md` | **P0** | User Management — wire all actions to UI: auth creation, password reset, lock/unlock, force logout, bulk actions, login history, org owner creation wizard | 1.5 days |
| 1.2 | `docs/superadmin-phase-1.2.md` | **P0** | Organization & Gym Destructive Workflows — delete/suspend/activate/transfer ownership UI, gym move/delete, governance controls, approval panel | 1.5 days |
| 1.3 | `docs/superadmin-phase-1.3.md` | **P0** | Subscription & Billing Operations — plan CRUD lifecycle, assign/upgrade/downgrade UI, invoice generation, MRR dashboard, payment recovery, entitlement sync | 1.5 days |
| 1.4 | `docs/superadmin-phase-1.4.md` | **P0** | Backup & Restore — real Supabase backup listing, manual trigger, restore drill, PITR UI, verification, schedule config | 1 day |

### Phase 2: Medium-Risk Gaps (SAR-005 to SAR-007)

| Phase | Doc | Risk | Description | Effort |
|-------|-----|------|-------------|--------|
| 2.1 | `docs/superadmin-phase-2.1.md` | **P1** | File Upload Security — MIME validation, size limits, virus scanning hook, upload progress, secure storage paths | 0.5 day |
| 2.2 | `docs/superadmin-phase-2.2.md` | **P1** | Search, Pagination, Filter & Export — shared DataTable primitive, per-module pagination, advanced filters, CSV/PDF export | 1 day |
| 2.3 | `docs/superadmin-phase-2.3.md` | **P1** | Live System Monitoring — real API/DB/storage/email/AI health checks, cron status, alert routing, real-time dashboard | 1 day |

### Phase 3: Completing Partial Features

| Phase | Doc | Risk | Description | Effort |
|-------|-----|------|-------------|--------|
| 3.1 | `docs/superadmin-phase-3.1.md` | **P2** | Security Compliance & Investigation — wire compliance monitoring, investigation center, threat timeline | 0.5 day |
| 3.2 | `docs/superadmin-phase-3.2.md` | **P2** | UX Governance — live design token scanner, component audit, bundle size monitor | 0.5 day |
| 3.3 | `docs/superadmin-phase-3.3.md` | **P2** | Support Center Completion — ticket assignment, respond/escalate/resolve flows, SLA tracking, search/filters | 0.5 day |

### Phase 4: Testing & Hardening

| Phase | Doc | Risk | Description | Effort |
|-------|-----|------|-------------|--------|
| 4.1 | `docs/superadmin-phase-4.1.md` | **P3** | E2E Testing — 20+ Playwright specs covering all lifecycle workflows | 1 day |
| 4.2 | `docs/superadmin-phase-4.2.md` | **P3** | Performance & Security Hardening — Lighthouse audit, bundle analysis, security audit, rate limiting, audit log completeness | 1 day |

---

## REMAINING SAR RISKS

| ID | Severity | Risk | Phase |
|----|----------|------|-------|
| SAR-001 | **High** | Super Admin User Management not complete enough for real SaaS operations | 1.1 |
| SAR-002 | **High** | Organization/Gym destructive and ownership workflows incomplete | 1.2 |
| SAR-003 | **High** | SaaS Subscription and Billing management not fully operational | 1.3 |
| SAR-004 | **High** | Backup and restore workflow not validated against real Supabase | 1.4 |
| SAR-005 | Medium | File upload validation and virus scanning not implemented | 2.1 |
| SAR-006 | Medium | Search, pagination, filtering, export not across every module | 2.2 |
| SAR-007 | Medium | System health monitoring mostly UI/status placeholders | 2.3 |
| SAR-008 | Low | Supabase middleware Edge Runtime build warning | Track |

---

## How to Resume a Session

Start each new session with the phase prompt file:
```
Continue from docs/SUPER_ADMIN_PRODUCTION_PLAN.md Phase X.Y
Read docs/superadmin-phase-X.Y.md for full instructions
```

Each phase prompt file is self-contained with:
- Current state analysis
- Detailed task breakdown
- Files to create/modify
- UI styling requirements
- Verification checklist
- Expected duration

---

## Commands Reference

After every phase, run:
```bash
npm run typecheck    # Must pass with 0 errors
npm run lint         # 0 new errors
npm run build        # Must complete successfully
npm test             # No new test failures
```

## Verification Per Phase
- [ ] All new UI flows work end-to-end
- [ ] All server actions gated with requireRole(["super_admin"])
- [ ] All destructive actions require type-to-confirm + MFA
- [ ] All changes written to audit_logs
- [ ] Rate limiting applied to all write actions
- [ ] No placeholder/mock data — every value from real DB
- [ ] typecheck, lint, build pass
