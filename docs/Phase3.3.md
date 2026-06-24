Continue from docs/Phase3.3.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 3.3 — Advanced CRM: Lead Follow-up + Re-engagement + Pipeline for Organization Owner panel.

Short overview:
  Phase 1.2 built a basic Leads module with a data table, status management, and
  convert-to-member. Phase 3.3 adds three advanced CRM features that transform it
  from a simple lead list into a sales pipeline. lead_followup_reminders adds task
  scheduling with due-date notifications for each lead. re_engagement_automation
  auto-flags inactive leads and sends follow-up messages. advanced_crm_lead_pipeline
  adds a Kanban-style pipeline view with drag-and-drop stages, lead scoring, and
  conversion forecasting. All three features extend the existing LeadsModule as new
  sub-tabs. Two new DB tables (lead_tasks, lead_automation_rules). All gated through
  the entitlement pipeline.

  Supabase: https://bobqiyhljubfrzmhqnqq.supabase.co (see .env.local for keys)
  Use Promise.all for all independent Supabase queries.

Reference: docs/ENTERPRISE_PRODUCTION_PLAN.md Phase 3 Session 14.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

Step 1: Read existing files to understand current Leads module.
  - features/organization-owner/components/modules/LeadsModule.tsx (full file — 393 lines,
    STATUS_OPTIONS with 7 stages, SOURCE_OPTIONS, data table with search/filter,
    detail drawer with status change + convert-to-member)
  - features/organization-owner/actions/lead-actions.ts (getOrgLeads, updateLeadStatus,
    convertLeadToMember, deleteLead — all gated)
  - features/organization-owner/services/lead-service.ts (Supabase queries)
  - features/organization-owner/services/module-data-resolver.ts (leads resolver case)
  - types/database.ts (leads table type, members table type)
  - features/entitlement/feature-registry.ts (lead_followup_reminders,
    re_engagement_automation, advanced_crm_lead_pipeline in FEATURE_KEYS)

Step 2: Understand current lead data model.
  The leads table has: id, organization_id, name, phone, email, source, status, notes,
  created_at, updated_at. Status values: new, contacted, trial_scheduled, trial_attended,
  negotiation, converted (won), lost. The LeadsModule shows a flat table with search
  and status/source filters. A detail drawer lets you change status and convert to member.

Step 3: Create migration for CRM tables.
  File: supabase/migrations/YYYYMMDD_create_advanced_crm.sql

  Table: lead_tasks (follow-up reminders)
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE
    title text NOT NULL
    description text
    due_date timestamptz NOT NULL
    completed_at timestamptz
    assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL
    created_by uuid REFERENCES profiles(id)
    is_notified boolean DEFAULT false  -- whether reminder was sent
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()

  Indexes: on (organization_id, due_date), on (lead_id), on (assigned_to).
  Enable RLS.

  Table: lead_automation_rules (re-engagement automation)
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    name text NOT NULL
    trigger_type text NOT NULL CHECK (trigger_type IN ('inactive_days', 'status_stale', 'new_lead'))
    trigger_value integer NOT NULL DEFAULT 7  -- days for inactive, hours for stale
    action_type text NOT NULL CHECK (action_type IN ('send_email', 'send_sms', 'send_whatsapp', 'create_task', 'change_status'))
    action_config jsonb NOT NULL DEFAULT '{}'::jsonb
      -- For send_email: { "template": "Hi {{name}}, ...", "subject": "..." }
      -- For change_status: { "target_status": "contacted" }
      -- For create_task: { "title": "Follow up with {{name}}", "due_in_days": 2 }
    is_active boolean DEFAULT true
    last_triggered_at timestamptz
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()

  Indexes: on organization_id, on trigger_type.
  Enable RLS.

  ALTER TABLE leads ADD COLUMN IF NOT EXISTS:
    lead_score integer DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100)
    last_contacted_at timestamptz
    pipeline_stage integer DEFAULT 0  -- for custom ordering within a status
    tags text[] DEFAULT '{}'

Step 4: Create lead tasks server actions.
  File: features/organization-owner/actions/lead-actions.ts (extend existing file)

  Add these exports to the existing lead-actions.ts:

  - getLeadTasks(organizationId, leadId?) → LeadTask[]
    Gate: requireOrgFeatureAccess(organizationId, "lead_followup_reminders")

  - createLeadTask(organizationId, data: { leadId, title, description?, dueDate, assignedTo? })
    Returns LeadTask
    Gate: requireOrgFeatureAccess(organizationId, "lead_followup_reminders")

  - completeLeadTask(organizationId, taskId) → LeadTask
    Gate: requireOrgFeatureAccess(organizationId, "lead_followup_reminders")

  - deleteLeadTask(organizationId, taskId) → void
    Gate: requireOrgFeatureAccess(organizationId, "lead_followup_reminders")

  - getOverdueTasks(organizationId) → LeadTask[]
    Tasks where due_date < now() AND completed_at IS NULL.
    Gate: requireOrgFeatureAccess(organizationId, "lead_followup_reminders")

  Parallel DB pattern:
    const [tasks, lead] = await Promise.all([
      supabase.from("lead_tasks").select("*").eq("lead_id", leadId).order("due_date"),
      supabase.from("leads").select("name").eq("id", leadId).single(),
    ]);
    return tasks.data?.map(t => ({ ...t, leadName: lead.data?.name })) ?? [];

Step 5: Create re-engagement automation server actions.
  In the same lead-actions.ts file, add:

  - getAutomationRules(organizationId) → AutomationRule[]
    Gate: requireOrgFeatureAccess(organizationId, "re_engagement_automation")

  - createAutomationRule(organizationId, data: { name, triggerType, triggerValue, actionType, actionConfig })
    Returns AutomationRule
    Gate: requireOrgFeatureAccess(organizationId, "re_engagement_automation")

  - updateAutomationRule(organizationId, ruleId, data)
    Returns AutomationRule
    Gate: requireOrgFeatureAccess(organizationId, "re_engagement_automation")

  - deleteAutomationRule(organizationId, ruleId) → void
    Gate: requireOrgFeatureAccess(organizationId, "re_engagement_automation")

  - runAutomationRules(organizationId) → { triggered: number; errors: string[] }
    Scans leads against active rules, executes actions, logs results.
    Intended for cron job but also callable manually from UI.
    Gate: requireOrgFeatureAccess(organizationId, "re_engagement_automation")

    Logic:
    For each active rule:
      - inactive_days trigger: find leads where last_contacted_at < now() - trigger_value days
        AND status NOT IN ('converted','lost')
      - status_stale trigger: find leads where status hasn't changed in trigger_value hours
      - new_lead trigger: find leads created in last trigger_value hours, status = 'new'
    For matching leads, execute action:
      - send_email: uses Resend (resend API key from .env.local: RESEND_API_KEY)
      - change_status: updates lead.status to target_status
      - create_task: inserts lead_task with due_date = now() + due_in_days
    Update rule.last_triggered_at.
    Return summary.

  Parallel DB pattern for runAutomationRules:
    const [rules, inactiveLeads, staleLeads, newLeads] = await Promise.all([
      supabase.from("lead_automation_rules").select("*").eq("is_active", true).eq("organization_id", orgId),
      supabase.from("leads").select("*").eq("organization_id", orgId)
        .lt("last_contacted_at", cutoffDate)
        .not("status", "in", '("converted","lost")'),
      // ... additional parallel queries per trigger type
    ]);

Step 6: Create lead scoring and pipeline actions.
  In the same lead-actions.ts file, add:

  - getPipelineView(organizationId)
    Returns leads grouped by status: { status: string; leads: LeadRow[]; count: number }[]
    Also returns pipeline summary: total leads, conversion rate, avg days to convert.
    Gate: requireOrgFeatureAccess(organizationId, "advanced_crm_lead_pipeline")

  - calculateLeadScore(leadId): auto-calculates and updates lead_score based on:
    - Status progression: +10 per stage advanced (new=0, contacted=10, trial_scheduled=20, ...)
    - Source quality: website=5, referral=15, walk_in=10, phone=5, social_media=0
    - Recency: last_contacted_at within 7 days = +10, within 30 days = +5
    - Task completion: +5 per completed task
    Max score: 100.
    Called automatically on status change and task completion.
    Gate: no separate gate (called internally).

  - getConversionForecast(organizationId)
    Returns { estimatedConversions: number; confidencePercent: number; basedOnPeriodDays: number }
    Simple forecast: avg conversion rate over last 90 days × current open leads.
    Gate: requireOrgFeatureAccess(organizationId, "advanced_crm_lead_pipeline")

Step 7: Create follow-up reminders UI (tab in Leads module).
  File: features/organization-owner/components/modules/LeadFollowUpPanel.tsx
  "use client" component, sub-tab in Leads module.

  Props: { dashboard: OrganizationOwnerDashboard; hasFeature: boolean }

  Layout:
  - Summary: Overdue tasks count (red badge), Due today count (orange), Upcoming count
  - "Add Task" button → inline form or drawer:
    - Lead selector (dropdown of open leads)
    - Title input
    - Description textarea
    - Due date picker
    - Assign to staff (dropdown)
  - Task list in two sections:
    - "Overdue" section (red header): tasks past due date, not completed
    - "Upcoming" section: tasks due today and future
    - Each task: checkbox to complete, lead name, title, due date, assigned to, edit, delete
  - Clicking a task opens lead detail in the parent Leads module
  - "Complete All" button for bulk completion

Step 8: Create re-engagement automation UI (tab in Leads module).
  File: features/organization-owner/components/modules/LeadAutomationPanel.tsx
  "use client" component, sub-tab in Leads module.

  Props: { dashboard: OrganizationOwnerDashboard; hasFeature: boolean }

  Layout:
  - "Run Automation Now" button → calls runAutomationRules, shows result toast
  - "Add Rule" button → opens drawer:
    - Rule name input
    - Trigger type select: "Inactive for X days", "Status unchanged for X hours", "New lead"
    - Trigger value: number input
    - Action type select: "Send Email", "Send SMS", "Send WhatsApp", "Create Task", "Change Status"
    - Action config (depends on action type):
      - Email: subject + body textarea with {{name}} placeholder support
      - SMS/WhatsApp: message textarea
      - Create Task: title + due in X days
      - Change Status: target status dropdown
  - Rules list: Name, Trigger, Action, Status (active/inactive toggle), Last Triggered, Actions (edit/delete)
  - Execution log (optional): show last N automation runs with results

Step 9: Create pipeline Kanban view (tab in Leads module).
  File: features/organization-owner/components/modules/LeadPipelinePanel.tsx
  "use client" component, sub-tab in Leads module.

  Props: { dashboard: OrganizationOwnerDashboard; hasFeature: boolean }

  Layout:
  - Pipeline summary bar at top:
    - Total leads, Conversion rate %, Avg days to convert, Forecast (X conversions expected)
  - Kanban board: one column per status stage
    - Columns: New → Contacted → Trial Scheduled → Trial Attended → Negotiation → Won | Lost
    - Each column: header with stage name + count, scrollable list of lead cards
    - Lead card shows: name, phone, source badge, lead score (color-coded dot), last contacted
    - Drag-and-drop: drag a lead card from one column to another → updates status
      (Use HTML5 drag-and-drop API or a simple click-to-move dropdown)
    - Click card → opens detail drawer (same as existing Leads module)
  - Lead score color: green (70+), yellow (40-69), red (0-39)
  - Source filter to filter the pipeline
  - "Refresh Scores" button to recalculate all lead scores

  If drag-and-drop is too complex, use a simpler approach: dropdown on each card to "Move to" next stage.
  The key value is the visual pipeline grouping, not the drag interaction.

Step 10: Integrate all new tabs into Leads module.
  File: features/organization-owner/components/modules/LeadsModule.tsx

  Add sub-tab bar at the top of the existing Leads module:
  Tab 1: "All Leads" — existing table view (always visible)
  Tab 2: "Pipeline" — LeadPipelinePanel (gated on advanced_crm_lead_pipeline)
  Tab 3: "Tasks" — LeadFollowUpPanel (gated on lead_followup_reminders)
  Tab 4: "Automation" — LeadAutomationPanel (gated on re_engagement_automation)

  Import the three new panel components.
  Use entitlement checks to conditionally show tabs.

Step 11: Add lead score recalculation on status change.
  File: features/organization-owner/actions/lead-actions.ts

  In updateLeadStatus:
  - After updating status, call calculateLeadScore for the lead
  - Also update lead.last_contacted_at = now() on any status change
  These run in parallel with the main update using Promise.all.

Step 12: Validation.
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Verification checklist — Follow-up Tasks:
  - Leads module shows "Tasks" sub-tab for Growth/Enterprise plans
  - "Tasks" tab hidden for Starter plan
  - Create task with lead, title, due date
  - Task appears in overdue/upcoming sections correctly
  - Complete task marks it done (checkbox)
  - Edit task updates details
  - Delete task removes it
  - Overdue tasks show red badge with count
  Verification checklist — Automation:
  - Leads module shows "Automation" tab for Enterprise plan only
  - Automation tab hidden for Growth and Starter plans
  - Create rule with trigger and action
  - Rule appears in list with correct details
  - Activate/deactivate toggle works
  - "Run Automation Now" executes rules and shows result count
  - Inactive leads triggered → status changed or task created
  - Email action sends via Resend
  Verification checklist — Pipeline:
  - Leads module shows "Pipeline" tab for Enterprise plan only
  - Pipeline tab hidden for Growth and Starter plans
  - Kanban columns show leads grouped by status
  - Lead count per column matches actual data
  - Lead card shows name, phone, source, score dot
  - Score dots are color-coded (green/yellow/red)
  - Moving a lead to next stage updates status
  - Pipeline summary bar shows correct metrics
  - Conversion forecast shows reasonable estimate
  - "Refresh Scores" recalculates all lead scores
  General:
  - All actions gated via requireOrgFeatureAccess (no hardcoded plan checks)
  - Existing lead list/search/convert still works — no regression
  - typecheck/lint/build all pass

---

Files to Create:
  supabase/migrations/YYYYMMDD_create_advanced_crm.sql
  features/organization-owner/components/modules/LeadFollowUpPanel.tsx
  features/organization-owner/components/modules/LeadAutomationPanel.tsx
  features/organization-owner/components/modules/LeadPipelinePanel.tsx

Files to Modify:
  features/organization-owner/actions/lead-actions.ts (add tasks, automation, scoring, pipeline actions)
  features/organization-owner/components/modules/LeadsModule.tsx (add 3 sub-tabs)

Supabase parallel patterns (use throughout):
  // Fetch lead + tasks + rules in parallel
  const [leadRes, tasksRes, rulesRes] = await Promise.all([
    supabase.from("leads").select("*").eq("id", leadId).single(),
    supabase.from("lead_tasks").select("*").eq("lead_id", leadId).order("due_date"),
    supabase.from("lead_automation_rules").select("*").eq("organization_id", orgId).eq("is_active", true),
  ]);

  // Pipeline: fetch all status groups in one query
  const { data: leads } = await supabase.from("leads")
    .select("*")
    .eq("organization_id", orgId)
    .order("lead_score", { ascending: false })
    .order("created_at", { ascending: false });
  // Then group by status in JS (faster than multiple queries).

  // When updating lead status + score + last_contacted in parallel:
  const [statusUpdate, scoreUpdate] = await Promise.all([
    supabase.from("leads").update({ status: newStatus, last_contacted_at: now }).eq("id", leadId),
    calculateLeadScore(leadId), // internal function
  ]);

Key design decisions:
  - lead_tasks: separate table for flexibility (tasks survive lead deletion? No — CASCADE delete).
  - lead_automation_rules: declarative config (trigger → action) for easy CRUD.
  - runAutomationRules: designed for cron + manual trigger. Idempotent via last_triggered_at.
  - Pipeline view: group leads by status in JS (not query per status). Simple and fast.
  - Lead scoring: heuristic-based (status + source + recency + tasks). Configurable later.
  - Conversion forecast: simple moving average — accurate enough for a CRM dashboard.
  - Resend API: uses existing Resend integration from .env.local (RESEND_API_KEY, RESEND_FROM_EMAIL).
  - All server actions gated with requireOrgFeatureAccess using the correct feature key.
