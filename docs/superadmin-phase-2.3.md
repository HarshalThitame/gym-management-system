# Super Admin Phase 2.3 — Live System Monitoring (SAR-007)

> **Master plan:** `docs/SUPER_ADMIN_PRODUCTION_PLAN.md`
> **QA report:** `docs/52-super-admin-qa-report.md` (SAR-007, Medium risk)
> **Duration:** ~1 day
> **Type:** Build (external health checks, alert routing, real-time dashboard)

---

## Context

The monitoring infrastructure has a strong foundation with real Supabase queries across 11+ tables, but lacks **external provider health checks** — it reports what's in the database rather than actively pinging external services. The observability service (20+ tables) tracks internal infrastructure metrics but doesn't check external dependencies (Supabase API, Razorpay, Resend, OpenAI, Vercel) in real time.

### What Already Exists

**Monitoring Service** (`features/monitoring/services/monitoring-service.ts`, 413 lines):
- Queries 11 Supabase tables for system metrics
- Computes health checks for 8 internal components (API, Database, Auth, Storage, Queue, Email, Payments, Background Jobs)
- Computes data integrity issues
- REAL data with fallback — not simulated

**Observability Service** (`features/observability/services/observability-service.ts`, 312 lines):
- Queries 20+ observability tables for infra metrics, SLOs, tracing, containers
- Computes platform health scores, error budgets, dependency graphs
- 15-second caching

**Monitoring Dashboard** (`MonitoringDashboardClient`, 492 lines):
- Service health grid, system activity, subscription monitoring, error tracking, data integrity, security alerts, rate limiting, backup health
- Full UI with status indicators

### What's MISSING

1. **No external API health checks** — doesn't ping Razorpay, Resend, OpenAI, Supabase, Vercel APIs
2. **No alert routing** — no way to configure notification channels (Slack, email, PagerDuty) for threshold breaches
3. **No real-time updates** — dashboard is poll-only, no WebSocket/SSE push
4. **No status page** — no public-facing status page for tenants
5. **No automated incident creation** — no connection between health check failure and incident creation

---

## Tasks

### Task 1: Add External Provider Health Checks

**Current:** Only checks internal Supabase tables.

**Required:** Create `features/monitoring/services/external-health-checks.ts` with:

1. **Supabase API check** — `GET /rest/v1/` with admin key, verify 200 + valid JSON
2. **Razorpay check** — `GET /v1/payments?count=1` with API key, verify 200
3. **Resend check** — `GET /emails` with API key, verify 200
4. **OpenAI check** — `GET /v1/models` with API key, verify 200
5. **Vercel check** — `GET /v1/deployments` with API key, verify 200
6. **DNS check** — resolve known tenant domains
7. **SSL check** — check certificate expiry for known domains
8. **Database connection check** — `SELECT 1` + latency measurement

Each check returns: `{ service: string, status: "up"|"down"|"degraded", latency: number, lastChecked: timestamp, error?: string }`

Checks run:
- Fast checks (DB ping, API ping): every 60 seconds
- Slow checks (SSL, Razorpay): every 5 minutes
- All results cached in a `health_check_results` JSONB or in-memory map

**File to create:**
- `features/monitoring/services/external-health-checks.ts`

---

### Task 2: Add Alert Routing Configuration UI

**Current:** No way to configure notification channels.

**Required:** Add Alert Configuration section to the Monitoring page:

1. **Notifications tab** (new 13th tab) with:
   - **Email recipients** — text input (comma-separated emails)
   - **Slack Webhook** — URL input + "Test" button
   - **PagerDuty** — integration key input + severity mapping
   - **Threshold config** — per-check configurable thresholds:
     - Latency warning (ms)
     - Error rate warning (%)
     - Uptime warning (%)
   - **Alert rules** — which services to monitor, which channels to notify per severity level

2. **Alert history** — table of past alerts (timestamp, service, severity, channel, acknowledged)

3. Wire to a new `saveAlertConfigAction` server action that persists to a `monitoring_alert_configs` table + `monitoring_alert_history` table

**Files to create:**
- `features/monitoring/services/alert-service.ts` — alert config CRUD + history
- `features/monitoring/actions/alert-actions.ts` — server actions

**Files to modify:**
- `app/(super-admin)/super-admin/monitoring/monitoring-dashboard.tsx` — add Notifications tab

---

### Task 3: Add Real-Time Status Dashboard with Live Refresh

**Current:** Dashboard is static — requires manual page refresh.

**Required:**
1. Add **auto-refresh toggle** (every 30s / 60s / 120s / off) at top of dashboard
2. Use `useEffect` + `setInterval` or Server-Sent Events for live updates
3. Show **last updated** timestamp with "X seconds ago" relative time
4. Add **status change animation** — when a service transitions from up→down, flash the card red briefly
5. Add **component health sparkline** — mini line chart showing last 24h latency trend (use Recharts `AreaChart`)

**Files to modify:**
- `app/(super-admin)/super-admin/monitoring/monitoring-dashboard.tsx` — add auto-refresh, sparklines, status flash

---

### Task 4: Add Service Health Grid Enhancement

**Current:** The health grid shows service name + status badge.

**Required:** Enhance each health card with:
- Latency (current ms + trend arrow up/down)
- Last check time (relative: "12s ago")
- 24h uptime percentage
- Click to expand: show recent check history (last 20 results)
- Click "Investigate" → links to relevant observability or logs section

**Styling:**
```tsx
<div className="rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-4 transition-all hover:shadow-md">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className={`size-3 rounded-full ${status === "up" ? "bg-green-500" : status === "degraded" ? "bg-amber-500" : "bg-red-500"} ${status === "up" ? "" : "animate-pulse"}`} />
      <div>
        <div className="text-sm font-black">{serviceName}</div>
        <div className="text-xs text-muted-foreground">{latency}ms · {uptime}% uptime</div>
      </div>
    </div>
    <Badge variant={statusVariant}>{status}</Badge>
  </div>
  <!-- Sparkline -->
  {sparklineData && (
    <div className="mt-2 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sparklineData}>
          <Area type="monotone" dataKey="latency" stroke="#22D3EE" fill="#22D3EE" fillOpacity={0.1} strokeWidth={1.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )}
</div>
```

**Files to modify:**
- `app/(super-admin)/super-admin/monitoring/monitoring-dashboard.tsx` — enhance health cards

---

### Task 5: Wire Incident Creation from Health Check Failures

**Current:** Health check failures don't create incidents.

**Required:**
1. When a health check transitions to "down", auto-create a security incident via `createSecurityIncident` from `security-incident-service.ts`
2. Set severity based on service criticality (database=critical, auth=critical, others=high)
3. Add incident reference to the health card
4. Link to security incidents page for investigation

**Files to modify:**
- `features/monitoring/services/external-health-checks.ts` — integrate with security incident creation

---

## Files Summary

### Files to CREATE:
| File | Purpose |
|------|---------|
| `features/monitoring/services/external-health-checks.ts` | External API health checks (8 providers) |
| `features/monitoring/services/alert-service.ts` | Alert config CRUD + history |
| `features/monitoring/actions/alert-actions.ts` | Save alert config + test webhook server actions |

### Files to MODIFY:
| File | Changes |
|------|---------|
| `app/(super-admin)/super-admin/monitoring/monitoring-dashboard.tsx` | Add Notifications tab, auto-refresh, enhanced health cards, sparklines |
| `features/monitoring/services/monitoring-service.ts` | Integrate external health checks into dashboard data |

---

## Verification Checklist

- [ ] External health checks ping all 8 providers and return real status
- [ ] Health cards show latency, uptime %, last check time, sparkline
- [ ] Auto-refresh works at 30/60/120s intervals
- [ ] Status flash animation when service transitions up→down
- [ ] Alert configuration saved and persisted
- [ ] Test Slack webhook button sends test message
- [ ] Alert history shows past alerts with acknowledge status
- [ ] Health check failure auto-creates security incident
- [ ] All checks show "last checked X seconds ago"
- [ ] `npm run typecheck` passes
