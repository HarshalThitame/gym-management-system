Continue from docs/Phase3.7.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 3.7 — Member NPS Surveys for Organization Owner panel.

Short overview:
  The Enterprise plan includes member_nps_surveys — a standalone NPS (Net Promoter Score)
  survey system for measuring member satisfaction. Currently a basic NPS score exists in
  the support ticket feedback system (post-ticket CSAT/NPS). This phase builds a dedicated
  survey builder where Org Owners create surveys with custom questions, define auto-trigger
  rules (after joining, after class, after X days), send surveys via email/WhatsApp, and
  view an NPS dashboard with promoter/detractor/passive breakdown and trend analysis.
  This is separate from the support feedback system — member_nps_surveys targets the
  general member base, not just ticket submitters.

  Supabase: https://bobqiyhljubfrzmhqnqq.supabase.co (see .env.local for keys)
  Use Promise.all for all independent Supabase queries.

Reference: docs/ENTERPRISE_PRODUCTION_PLAN.md Phase 3 Session 18.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

Step 1: Read existing files to understand patterns.
  - features/organization-owner/components/modules/CommunicationsModule.tsx (tab pattern)
  - features/communications/components/communication-forms.tsx (campaign forms)
  - features/support/services/support-analytics-service.ts (existing NPS calculation from
    support_customer_feedback — reference the NPS category logic)
  - features/entitlement/feature-registry.ts (member_nps_surveys in FEATURE_KEYS)

Step 2: Create migration for NPS survey system.
  File: supabase/migrations/YYYYMMDD_create_nps_surveys.sql

  Table: nps_surveys
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    name text NOT NULL
    description text
    question text NOT NULL DEFAULT 'How likely are you to recommend our gym to a friend or colleague?'
    thank_you_message text DEFAULT 'Thank you for your feedback!'
    trigger_type text NOT NULL CHECK (trigger_type IN ('manual', 'after_join', 'after_class', 'after_renewal', 'days_since_join', 'scheduled'))
    trigger_days integer DEFAULT 0  -- days after trigger event (e.g., 30 days after joining)
    target_segment jsonb DEFAULT '{}'::jsonb  -- filter which members receive this survey
      -- { "status": ["active"], "gym_ids": ["uuid1"], "plan_types": ["monthly"] }
    channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'whatsapp', 'sms', 'in_app'))
    is_active boolean DEFAULT true
    sent_count integer DEFAULT 0
    response_count integer DEFAULT 0
    last_sent_at timestamptz
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()

  Index: on (organization_id, is_active), on (trigger_type).
  Enable RLS.

  Table: nps_responses
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    survey_id uuid NOT NULL REFERENCES nps_surveys(id) ON DELETE CASCADE
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE
    score integer NOT NULL CHECK (score >= 0 AND score <= 10)
    nps_category text NOT NULL CHECK (nps_category IN ('promoter', 'passive', 'detractor'))
    feedback text  -- optional open-ended comment
    channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms', 'in_app', 'manual'))
    responded_at timestamptz DEFAULT now()
    UNIQUE (survey_id, member_id)  -- one response per survey per member

  Indexes: on (organization_id, survey_id), on (member_id), on (nps_category), on (responded_at).
  Enable RLS.

  Table: nps_trigger_logs (track when auto-surveys fire)
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    survey_id uuid NOT NULL REFERENCES nps_surveys(id) ON DELETE CASCADE
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE
    trigger_type text NOT NULL
    sent_at timestamptz DEFAULT now()
    delivery_status text DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed'))
    error_message text
    created_at timestamptz DEFAULT now()

  Index: on (survey_id, member_id), on (sent_at).

Step 3: Create NPS server actions.
  File: features/organization-owner/actions/nps-actions.ts
  Mark as "use server".

  Export:
  -- Survey CRUD --
  - getSurveys(organizationId) → NPSSurvey[]
    Gate: requireOrgFeatureAccess(organizationId, "member_nps_surveys")

  - getSurvey(organizationId, surveyId) → NPSSurvey with response count
    Gate: requireOrgFeatureAccess(organizationId, "member_nps_surveys")

  - createSurvey(organizationId, data: { name, description?, question?, thankYouMessage?, triggerType, triggerDays?, targetSegment?, channel?, isActive? })
    Returns NPSSurvey
    Gate: requireOrgFeatureAccess(organizationId, "member_nps_surveys")

  - updateSurvey(organizationId, surveyId, data)
    Returns NPSSurvey
    Gate: requireOrgFeatureAccess(organizationId, "member_nps_surveys")

  - deleteSurvey(organizationId, surveyId) → void
    Gate: requireOrgFeatureAccess(organizationId, "member_nps_surveys")

  -- Response handling --
  - submitNPSResponse(surveyId, memberId, score, feedback?, channel?)
    Creates nps_responses row. Calculates nps_category: 9-10=promoter, 7-8=passive, 0-6=detractor.
    Increments survey.response_count.
    No feature gate (public endpoint for member to submit). Validate member exists.
    Returns { success: boolean; category: string; message: string }

  -- Analytics --
  - getNPSDashboard(organizationId, filters?: { surveyId?, dateFrom?, dateTo? })
    Returns {
      overallNPS: number,  // percentage: promoters% - detractors%
      totalResponses: number,
      promoters: { count: number; percentage: number },
      passives: { count: number; percentage: number },
      detractors: { count: number; percentage: number },
      trend: { month: string; nps: number; responses: number }[],
      bySurvey: { surveyId: string; surveyName: string; nps: number; responses: number }[],
      recentResponses: NPSResponse[],
      feedbackWordCloud: { word: string; count: number }[]  // from feedback text
    }
    Gate: requireOrgFeatureAccess(organizationId, "member_nps_surveys")

    NPS formula: ((promoters - detractors) / totalResponses) * 100

  -- Auto-trigger (for cron or manual execution) --
  - processAutoSurveys(organizationId)
    Gate: requireOrgFeatureAccess(organizationId, "member_nps_surveys")
    For each active survey with trigger_type != 'manual':
      1. Resolve target members based on trigger_type + trigger_days + target_segment:
         - after_join: members where created_at <= now() - trigger_days
         - after_renewal: members with renewal date <= now() - trigger_days
         - days_since_join: members where created_at between now()-trigger_days-1 and now()-trigger_days
      2. For each matching member: check if they already have a response for this survey
      3. For new recipients: create nps_trigger_log, send survey via channel
      4. Update survey.sent_count
    Returns { processed: number; sent: number; skipped: number }

  Parallel DB pattern for getNPSDashboard:
    const [responsesRes, trendRes, bySurveyRes, recentRes] = await Promise.all([
      supabase.from("nps_responses").select("score, nps_category")
        .eq("organization_id", orgId),
      supabase.from("nps_responses")
        .select("responded_at, score")
        .eq("organization_id", orgId)
        .gte("responded_at", dateFrom).lte("responded_at", dateTo)
        .order("responded_at"),
      supabase.from("nps_responses")
        .select("survey_id, nps_surveys!inner(name), score")
        .eq("organization_id", orgId),
      supabase.from("nps_responses")
        .select("id, survey_id, member_id, score, nps_category, feedback, responded_at, members!inner(full_name)")
        .eq("organization_id", orgId)
        .order("responded_at", { ascending: false }).limit(20),
    ]);
    // Compute NPS, promoter/detractor/passive breakdown, trends, and bySurvey in JS.
    // This avoids complex SQL aggregations and is faster with moderate data sizes.

    NPS calc in JS:
      const promoters = scores.filter(s => s >= 9).length;
      const detractors = scores.filter(s => s <= 6).length;
      const nps = ((promoters - detractors) / total) * 100;

Step 4: Create NPS survey UI component.
  File: features/organization-owner/components/modules/NPSSurveyPanel.tsx
  "use client" component, rendered as a new sub-tab in Communications module.

  Props: { dashboard: OrganizationOwnerDashboard; hasFeature: boolean }

  Layout — Surveys Tab:
  - "Create Survey" button → opens drawer:
    - Survey name input
    - Description textarea
    - Question textarea (default: standard NPS question)
    - Thank you message textarea
    - Trigger type select:
      - "Manual" — send manually
      - "After joining" — auto-send X days after member joins
      - "After renewal" — auto-send X days after membership renewal
      - "Days since join" — auto-send at specific day milestone
      - "Scheduled" — send on a recurring schedule
    - Trigger days: number input (shown for after_join, days_since_join triggers)
    - Target segment (collapsible): status filter, gym filter, plan type filter
    - Channel select: Email, WhatsApp, SMS, In-App
    - Active toggle
  - Survey list table: Name, Trigger, Channel, Sent, Responses, NPS Score, Active toggle, Actions (Send Now, Edit, Delete)
  - "Send Now" button on manual surveys → calls processAutoSurveys for this survey
  - Click row → Dashboard Tab for this survey

  Layout — Dashboard Tab:
  - Survey selector dropdown (or shows data for selected survey from list)
  - NPS Score card: large number with color (green >50, yellow 0-50, red <0)
  - Three stat cards side by side:
    - Promoters: count + % (green)
    - Passives: count + % (yellow)
    - Detractors: count + % (red)
  - Trend line chart (Recharts): month-by-month NPS score with response count
  - By-survey comparison bar chart (if viewing org-wide): NPS per survey
  - Recent responses table: Member Name, Score (color-coded dot), Category badge, Feedback, Date
  - CSV export of all responses

Step 5: Create member-facing NPS response page.
  File: app/(member)/member/survey/[surveyId]/page.tsx
  A simple page members land on when clicking the survey link from email/WhatsApp.

  Shows:
  - Survey question
  - 0-10 score selector (radio buttons styled as numbers)
  - Optional feedback textarea
  - Submit button → calls submitNPSResponse
  - On submit: show thank you message from survey config
  - Must be authenticated (member role). If not, redirect to login.
  - If member already responded: show "You've already submitted your feedback. Thank you!"

  This page is NOT gated (public to members with the link). The survey link contains
  the surveyId and memberId as query params.

Step 6: Integrate into Communications module.
  File: features/organization-owner/components/modules/CommunicationsModule.tsx

  Add sub-tab: "NPS Surveys" — NPSSurveyPanel
  Gated: only show if org has member_nps_surveys feature.
  Use entitlement provider: const hasFeature = useHasFeature("member_nps_surveys");

  Import NPSSurveyPanel.

Step 7: Validation.
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Verification checklist:
  Survey Builder:
  - Communications module shows "NPS Surveys" tab for Enterprise plan
  - "NPS Surveys" tab hidden for Growth and Starter plans
  - Create survey with all fields
  - Edit survey updates correctly
  - Delete survey removes it and its responses
  - Trigger type selection shows relevant sub-fields
  Responses:
  - Member landing page at /member/survey/[id] renders question
  - Score selection 0-10 works
  - Submit records response with correct nps_category
  - Re-submission blocked (unique constraint)
  - Thank you message shown after submit
  Analytics:
  - NPS score calculated correctly: (promoters - detractors) / total * 100
  - Score >50 shows green, 0-50 yellow, <0 red
  - Promoter/passive/detractor counts correct
  - Trend chart shows month-by-month NPS
  - By-survey comparison shows correct per-survey NPS
  - Recent responses show correct member data
  Auto-Trigger:
  - processAutoSurveys finds matching members based on trigger config
  - Already-responded members skipped
  - New members get trigger_log created
  - survey.sent_count increments
  Edge Cases:
  - Member with no email → skipped in auto-trigger (channel requires contact info)
  - Survey with 0 responses → NPS shows "N/A" not NaN
  - Deleted survey → responses cascade-deleted (ON DELETE CASCADE)
  - Same member, same survey: cannot respond twice (UNIQUE constraint)
  General:
  - All admin actions gated via requireOrgFeatureAccess (no hardcoded plan checks)
  - Member response page NOT gated (public member endpoint)
  - typecheck/lint/build all pass

---

Files to Create:
  supabase/migrations/YYYYMMDD_create_nps_surveys.sql
  features/organization-owner/actions/nps-actions.ts
  features/organization-owner/components/modules/NPSSurveyPanel.tsx
  app/(member)/member/survey/[surveyId]/page.tsx

Files to Modify:
  features/organization-owner/components/modules/CommunicationsModule.tsx (add NPS Surveys tab)

Supabase parallel patterns (use throughout):
  // Dashboard: fetch responses + trend + bySurvey + recent in parallel
  const [responses, trend, bySurvey, recent] = await Promise.all([
    supabase.from("nps_responses").select("score, nps_category").eq("organization_id", orgId),
    supabase.from("nps_responses").select("responded_at, score").eq("organization_id", orgId)
      .gte("responded_at", dateFrom).lte("responded_at", dateTo).order("responded_at"),
    supabase.from("nps_responses").select("survey_id, nps_surveys!inner(name), score")
      .eq("organization_id", orgId),
    supabase.from("nps_responses").select("id, survey_id, member_id, score, nps_category, feedback, responded_at, members!inner(full_name)")
      .eq("organization_id", orgId).order("responded_at", { ascending: false }).limit(20),
  ]);

  // Auto-trigger: fetch survey + matching members in parallel
  const [surveyRes, membersRes] = await Promise.all([
    supabase.from("nps_surveys").select("*").eq("id", surveyId).single(),
    supabase.from("members").select("id, full_name, email, phone, created_at")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .lte("created_at", triggerDate),
  ]);

  // NPS calculation in JS (avoid complex SQL aggregations):
  // scores = [9,8,5,10,7,6,...]
  // promoters = scores.filter(s => s >= 9).length
  // detractors = scores.filter(s => s <= 6).length
  // nps = ((promoters - detractors) / scores.length) * 100
  // npsCategory = nps > 50 ? 'green' : nps > 0 ? 'yellow' : 'red'

Key design decisions:
  - NPS surveys are a sub-tab of Communications module (alongside Campaigns, Network Campaigns).
  - Standard NPS formula: score 0-10, promoters 9-10, passives 7-8, detractors 0-6.
  - Member response page is a public route under /member/survey/[id] — NOT gated.
  - Auto-trigger is designed for cron but also manually triggerable from UI.
  - nps_trigger_logs track every auto-send attempt for audit and deduplication.
  - Survey deletion cascades to responses (ON DELETE CASCADE).
  - All analytics computed in JS from raw score data — simple, testable, fast.
  - All server actions gated with requireOrgFeatureAccess(orgId, "member_nps_surveys").
