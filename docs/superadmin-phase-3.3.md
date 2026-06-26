# Super Admin Phase 3.3 — Support Center Completion

> **Master plan:** `docs/SUPER_ADMIN_PRODUCTION_PLAN.md`
> **Duration:** ~0.5 day
> **Type:** Build (ticket assignment, SLA tracking, KB search, agent workflows)

---

## Context

The support center has 10 fully routed pages with real server actions and services. However, the main support inbox has client-side-only search/filter (no URL sync), the knowledge base lacks search, and ticket assignment/escalation workflows are not surfaced in the super admin UI (they exist in the support service layer).

### What Already Exists

**Support Pages (10 routes):** All fully routed with real data
**Support Services (14 files, ~1,800 lines):** Tickets, analytics, automation, AI, SLA, collaboration, KB, escalations, agents, saved views
**Support Actions:** Ticket CRUD, assignment, notes, status changes
**Support API Routes (21 files):** Full REST API including webhooks

### What's MISSING

1. **KB search** — knowledge base page loads all articles with `pageSize: 100` but has no search input or category filter
2. **Ticket assignment UI** — super admin can't assign tickets to agents from the inbox view
3. **SLA timer visibility** — SLA breach countdown not shown on ticket cards
4. **Bulk ticket operations** — no multi-select + bulk status change
5. **Agent workload view** — agents page shows performance but no capacity/workload balancing

---

## Tasks

### Task 1: Add Search & Category Filter to Knowledge Base

**Current:** KB page fetches all articles with `pageSize: 100`, renders flat grid.

**Required:**
1. Add search input with debounce (filter by title/content)
2. Add category filter dropdown (from article categories)
3. Add type filter (guide/faq/api/troubleshooting)
4. Add status filter (published/draft/archived)
5. Paginate results (12 per page)
6. URL-sync filters

**Files to modify:**
- `app/(super-admin)/super-admin/support/knowledge-base/page.tsx`

---

### Task 2: Add Ticket Assignment to Inbox View

**Current:** No assignee selector on ticket cards.

**Required:**
1. Add assignee dropdown to each ticket card in the inbox
2. Dropdown shows available agents with current ticket count
3. On assign: call `assignTicketAction` server action
4. Show assigned agent's avatar/name + "Unassigned" badge for unassigned
5. Add "My Tickets" filter to show only tickets assigned to current admin

**Files to modify:**
- `features/support/components/support-inbox.tsx` — add assignee selector
- `features/support/actions/support-actions.ts` — add `assignTicketAction`

---

### Task 3: Add SLA Breach Countdown to Ticket Cards

**Current:** SLA data exists in the service but isn't displayed on ticket cards.

**Required:**
1. On each ticket card, show SLA breach countdown:
   - Green: "23h remaining"
   - Amber: "4h remaining"
   - Red: "OVERDUE by 2h"
2. Sort tickets by SLA urgency
3. Add "SLA breached" filter
4. Add SLA compliance rate to Analytics tab

**Files to modify:**
- `features/support/components/support-inbox.tsx` — add SLA countdown
- `features/support/services/support-sla-service.ts` — compute remaining time

---

### Task 4: Add Bulk Ticket Operations

**Required:**
1. Add multi-select checkboxes to ticket list
2. When 1+ selected, show floating bulk action bar (same glass pattern as Phase 1.1):
   - Assign to agent
   - Change status (open/pending/resolved/closed)
   - Change priority (low/medium/high/critical)
   - Add tag
3. Wire to existing `bulkUpdateTicketsAction` or create if needed

**Files to modify:**
- `features/support/components/support-inbox.tsx` — add bulk selection + action bar
- `features/support/actions/support-actions.ts` — add `bulkUpdateTicketsAction`

---

### Task 5: UI Polish

- Glass floating bulk action bar
- Ticket cards with SLA countdown color-coded left border
- Agent workload view shows current ticket count vs capacity
- Reveal-up staggered animation on ticket cards
- Empty states for each filter combination

---

## Files Summary

### Files to CREATE:
- None (modify existing files only)

### Files to MODIFY:
| File | Changes |
|------|---------|
| `app/(super-admin)/super-admin/support/knowledge-base/page.tsx` | Add search, filters, pagination, URL sync |
| `features/support/components/support-inbox.tsx` | Add assignee selector, SLA countdown, bulk ops |
| `features/support/actions/support-actions.ts` | Add assign ticket + bulk update actions |
| `features/support/services/support-sla-service.ts` | Add SLA remaining time computation |

---

## Verification Checklist

- [ ] KB search works with debounce + category filter + pagination
- [ ] Ticket assignee dropdown shows agents and persists selection
- [ ] SLA countdown shows on each ticket card with color coding
- [ ] Bulk select + status change + assign works
- [ ] Filter by SLA breached works
- [ ] Agent workload view shows current ticket count
- [ ] `npm run typecheck` passes
