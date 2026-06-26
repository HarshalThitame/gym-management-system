# Super Admin Phase 3.1 — Security Compliance & Investigation

> **Master plan:** `docs/SUPER_ADMIN_PRODUCTION_PLAN.md`
> **Duration:** ~0.5 day
> **Type:** Build (wire compliance monitoring, enhance investigation)

---

## Context

The security compliance page displays framework labels but explicitly warns "Compliance Framework Monitoring Not Fully Configured." The investigation page renders the UI but the underlying services are real. This phase wires the compliance automation and polishes the investigation center.

### What Already Exists

**Compliance Page** (`security/compliance/page.tsx`):
- 4 framework cards (GDPR, SOC 2, ISO 27001, HIPAA) — all marked "Reference framework"
- Amber warning banner about incomplete automation
- Real queries for GDPR requests + SOC 2 reports from DB tables
- Generate Report button exists but produces reference-only output

**Investigation Page** (`security/investigate/page.tsx`):
- `SecurityInvestigationCenter` (227 lines) — fully functional
- Backed by `security-investigation-service.ts` (90 lines) with real operations
- User search, detection cards, active sessions, login history, investigator actions
- All 4 actions work: Block User, Force Password Reset, Force MFA Reset, Revoke All Sessions

### What's MISSING

1. **Compliance automation** — no automated checks for RLS coverage, RBAC role coverage, audit log completeness, storage policy compliance
2. **Compliance scoring** — no per-framework compliance score (0-100%)
3. **Investigation timeline** — no visual timeline of events leading up to investigation
4. **Batch investigation** — no way to investigate multiple users in one session

---

## Tasks

### Task 1: Wire Automated Compliance Checks

**Required:** Create `features/security/services/compliance-checker-service.ts` with:

1. **RLS Coverage Check** — query `pg_policies` to find tables WITHOUT RLS enabled, return list of uncovered tables
2. **RBAC Role Coverage Check** — compare `role_permissions` against required resources, flag missing permissions
3. **Audit Log Completeness Check** — compare `audit_logs` against expected event types per resource, flag gaps
4. **Storage Policy Check** — verify all Supabase storage buckets have RLS policies defined
5. **Encryption Check** — verify database has encryption at rest (query Supabase project settings)
6. **Access Review Check** — flag users with elevated privileges who haven't logged in >90 days

Each check returns: `{ framework: string, check: string, status: "pass"|"fail"|"warning", details: string, score: number }`

Compute an overall compliance score per framework (pass = 100%, fail = 0%, warning = 50%).

**Wire into the compliance page:**
- Replace amber warning banner with real scores
- Framework cards show real compliance percentage + progress bar
- Each framework card shows individual check results (expandable)
- Re-run checks button

**Files to create:**
- `features/security/services/compliance-checker-service.ts`

**Files to modify:**
- `app/(super-admin)/super-admin/security/compliance/page.tsx` — wire real scores, remove amber banner

---

### Task 2: Add Investigation Timeline

**Required:** Add a visual timeline to the investigation center:
- Chronological view of events: login attempts, security events, support tickets, password changes
- Each event shows: timestamp, event type, severity dot, description, metadata
- Click to expand metadata details
- Filter by event type
- Export timeline as PDF

**Files to modify:**
- `features/security/components/investigation-center.tsx` — add timeline view

---

### Task 3: UI Polish — Compliance Cards with Scores

**Required:**
- Framework cards show score as large number + colored progress ring:
  - >90%: green ring + "Compliant"
  - 70-90%: amber ring + "At Risk"
  - <70%: red ring + "Non-Compliant"
- Individual check results expandable from the card
- Glass card styling with reveal-up animation
- "Run All Checks" button with progress indicator

```tsx
<div className="reveal-up rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-5"
     style={{"--reveal-delay": `${i * 0.05}s`}}>
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="grid size-12 place-items-center rounded-full" style={{background: `conic-gradient(#16A34A ${score}%, #E4E7DD ${score}%)`}}>
        <div className="grid size-10 place-items-center rounded-full bg-surface">
          <span className="text-sm font-black">{score}%</span>
        </div>
      </div>
      <div>
        <div className="text-base font-black">{frameworkName}</div>
        <Badge variant={score > 90 ? "success" : score > 70 ? "warning" : "error"}>
          {score > 90 ? "Compliant" : score > 70 ? "At Risk" : "Non-Compliant"}
        </Badge>
      </div>
    </div>
  </div>
</div>
```

---

## Verification Checklist

- [ ] Compliance checks run against real DB (RLS, RBAC, audit logs, storage policies)
- [ ] Framework cards show real scores instead of "Reference framework" labels
- [ ] Amber warning banner is replaced with real compliance data
- [ ] Investigation center has visual timeline
- [ ] Timeline can be exported as PDF
- [ ] `npm run typecheck` passes
