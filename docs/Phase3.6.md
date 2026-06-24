Continue from docs/Phase3.6.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 3.6 — Network-Wide Campaign Manager for Organization Owner panel.

Short overview:
  The currently Communications module supports single-gym, single-channel campaigns with
  basic draft/send/completed lifecycle. The Enterprise plan includes network_wide_campaign_manager
  — the ability to run one campaign across multiple branches simultaneously with advanced
  member segment targeting (by status, tags, activity level) and multi-channel delivery
  (email + WhatsApp + SMS within one campaign). This phase extends the existing campaign
  system with multi-branch targeting, a member segment builder, multi-channel orchestration,
  and a campaign analytics dashboard showing delivery stats and engagement metrics.

  Supabase: https://bobqiyhljubfrzmhqnqq.supabase.co (see .env.local for keys)
  Use Promise.all for all independent Supabase queries.

Reference: docs/ENTERPRISE_PRODUCTION_PLAN.md Phase 3 Session 17.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

Step 1: Read existing files to understand current campaign system.
  - features/organization-owner/components/modules/CommunicationsModule.tsx (full file —
    KPIs by status, channel distribution chart, campaign list, create/edit drawer, send action)
  - features/organization-owner/actions/communication-actions.ts (saveCampaignAction —
    single gym_id, single campaign_type, segment_key; sendCampaignAction — sets status to running)
  - features/organization-owner/services/module-data-resolver.ts (communications resolver)
  - types/database.ts (campaigns table type, notifications table type, members table)
  - features/entitlement/feature-registry.ts (network_wide_campaign_manager in FEATURE_KEYS)

Step 2: Understand current campaign data model.
  campaigns table: id, gym_id, name, campaign_type (email|whatsapp|sms), category,
  segment_key, status (draft|scheduled|running|completed), scheduled_for, created_at.
  Current limitations: single gym_id, single campaign_type, vague segment_key.

Step 3: Create migration for network-wide campaign support.
  File: supabase/migrations/YYYYMMDD_network_wide_campaigns.sql

  ALTER TABLE campaigns:
    -- Allow multi-gym targeting
    ADD COLUMN IF NOT EXISTS target_gym_ids uuid[] DEFAULT '{}'
    -- Allow multi-channel (override single campaign_type)
    ADD COLUMN IF NOT EXISTS channels text[] DEFAULT '{}'
      -- example: '{"email","whatsapp","sms"}'
    -- Member segment criteria as jsonb
    ADD COLUMN IF NOT EXISTS segment_filters jsonb DEFAULT '{}'::jsonb
      -- example: {"status":["active"],"tags":["premium"],"inactive_days":30,"branch_ids":["uuid1","uuid2"]}
    -- Stats
    ADD COLUMN IF NOT EXISTS sent_count integer DEFAULT 0
    ADD COLUMN IF NOT EXISTS delivered_count integer DEFAULT 0
    ADD COLUMN IF NOT EXISTS opened_count integer DEFAULT 0
    ADD COLUMN IF NOT EXISTS clicked_count integer DEFAULT 0
    ADD COLUMN IF NOT EXISTS failed_count integer DEFAULT 0

  Table: campaign_deliveries (per-recipient tracking)
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    member_id uuid REFERENCES members(id) ON DELETE SET NULL
    channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms'))
    recipient text NOT NULL  -- email address or phone number
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced'))
    sent_at timestamptz
    delivered_at timestamptz
    opened_at timestamptz
    error_message text
    metadata jsonb DEFAULT '{}'::jsonb
    created_at timestamptz DEFAULT now()

  Indexes: on (campaign_id), on (member_id), on (organization_id), on (channel, status).
  Enable RLS.

Step 4: Create network-wide campaign server actions.
  File: features/organization-owner/actions/campaign-actions.ts (rename from existing
  communication-actions or create new file for advanced features)

  Export (add to existing communication-actions.ts):
  -- Multi-branch campaign management --
  - saveNetworkCampaign(organizationId, data: { campaignId?, name, channels[], targetGymIds[], segmentFilters?, messageBody?, scheduledFor? })
    Returns campaign
    Gate: requireOrgFeatureAccess(organizationId, "network_wide_campaign_manager")
    If targetGymIds is empty and single gym_id provided, maintains backward compat.
    Validation: at least one channel, at least one target gym.

  -- Member resolution for targeting --
  - resolveCampaignRecipients(organizationId, targetGymIds: string[], segmentFilters: SegmentFilters)
    Returns { members: MemberRecipient[]; total: number }
    MemberRecipient = { id, full_name, email, phone, gym_id, status, tags }
    Gate: requireOrgFeatureAccess(organizationId, "network_wide_campaign_manager")

    Queries members across target gyms, applies segment filters:
    - status filter: WHERE status IN (segmentFilters.status)
    - tag filter: WHERE tags && segmentFilters.tags (overlap check on text[])
    - inactive filter: WHERE last_check_in < now() - interval
    This returns the exact member list the campaign will target.

  -- Campaign execution --
  - executeNetworkCampaign(organizationId, campaignId)
    Gate: requireOrgFeatureAccess(organizationId, "network_wide_campaign_manager")
    1. Resolve recipients via resolveCampaignRecipients
    2. For each recipient and each channel, create campaign_deliveries row
    3. For email: send via Resend (RESEND_API_KEY from .env.local, RESEND_FROM_EMAIL)
    4. For SMS/WhatsApp: create pending deliveries (actual sending via cron or external API)
    5. Update campaign.status = "running", campaign.sent_count
    6. Run all independent channel sends in Promise.all
    Returns { sent: number; failed: number; deliveries: string[] }

  -- Campaign analytics --
  - getCampaignAnalytics(organizationId, campaignId)
    Returns {
      campaign: campaign row,
      deliveries: { total: number, sent: number, delivered: number, opened: number,
        clicked: number, failed: number, bounced: number },
      byChannel: { email: DeliveryStats, whatsapp: DeliveryStats, sms: DeliveryStats },
      byStatus: delivery status breakdown,
      engagementRate: number  -- (opened + clicked) / delivered * 100
    }
    Gate: requireOrgFeatureAccess(organizationId, "network_wide_campaign_manager")

  - getOrganizationCampaignStats(organizationId)
    Returns aggregate stats across all campaigns: total sent, avg engagement rate, etc.
    Gate: requireOrgFeatureAccess(organizationId, "network_wide_campaign_manager")

  Parallel DB pattern for getCampaignAnalytics:
    const [campaignRes, deliveriesRes, byChannelRes, byStatusRes] = await Promise.all([
      supabase.from("campaigns").select("*").eq("id", campaignId).single(),
      supabase.from("campaign_deliveries").select("status").eq("campaign_id", campaignId),
      supabase.from("campaign_deliveries").select("channel, status")
        .eq("campaign_id", campaignId),
      supabase.from("campaign_deliveries").select("status, count(*)")
        .eq("campaign_id", campaignId),
    ]);

Step 5: Update existing saveCampaignAction for backward compat.
  File: features/organization-owner/actions/communication-actions.ts

  In saveCampaignAction:
  - If org has network_wide_campaign_manager feature:
    - Accept additional form fields: channels (comma-separated), targetGymIds (comma-separated),
      segmentFilters (JSON string), messageBody
    - Parse and validate these fields
    - Store in the new campaign columns
  - If org doesn't have the feature:
    - Preserve existing single-gym, single-channel behavior
  - This keeps backward compatibility — existing campaigns still work.

Step 6: Create network-wide campaign UI components.
  File: features/organization-owner/components/modules/NetworkCampaignPanel.tsx
  "use client" component, rendered as a new tab in Communications module.

  Props: { dashboard: OrganizationOwnerDashboard; hasFeature: boolean }

  Layout — Campaign Builder Tab:
  - Campaign name input
  - Channel multi-select checkboxes: Email, WhatsApp, SMS (at least one required)
  - Target gyms: multi-select of org's gyms/branches (fetch from dashboard.gyms)
  - Message content per channel:
    - Email: subject + body (textarea, supports {{name}} placeholder)
    - SMS: message body (textarea, 160 char count)
    - WhatsApp: message body (textarea, template selector if WABA integrated)
  - Segment builder (collapsible section):
    - Member status: multi-select "Active", "Expired", "Frozen", "Trial"
    - Tags: multi-select from org's member tags
    - Inactive days: "Members inactive for more than X days"
    - Membership plan: filter by plan type
    - "Preview Recipients" button → calls resolveCampaignRecipients → shows count + sample list
  - Schedule: "Send now" or date/time picker for scheduled send
  - "Save as Draft" and "Send Campaign" buttons

  Layout — Campaign List Tab (existing campaign table, enhanced):
  - Shows all campaigns organized by gym (if single) or "Network-wide" badge
  - Multi-gym campaigns show "X branches" badge
  - Multi-channel campaigns show channel icons: email icon, WhatsApp icon, SMS icon
  - New columns: Sent, Delivered, Opened (if campaign is running/completed)

  Layout — Analytics Tab:
  - Campaign selector dropdown (pick a sent campaign)
  - Stats grid: Sent, Delivered, Opened, Clicked, Failed, Bounced
  - Engagement rate gauge/meter
  - Channel breakdown: 3 stat cards (email stats, WhatsApp stats, SMS stats)
  - Delivery status pie chart (Recharts): sent vs delivered vs failed
  - Recent deliveries table: Recipient, Channel, Status, Sent At

Step 7: Integrate new panel into Communications module.
  File: features/organization-owner/components/modules/CommunicationsModule.tsx

  Add sub-tab: "Network Campaigns" — NetworkCampaignPanel
  Keep the existing "Campaigns" tab as the default view (existing functionality).
  Gated: only show "Network Campaigns" tab if org has network_wide_campaign_manager.
  Use entitlement provider: const hasFeature = useHasFeature("network_wide_campaign_manager");

  Import NetworkCampaignPanel.

Step 8: Create a simple Resend email sender utility (if not exists).
  File: features/communications/lib/message-sender.ts
  Export sendEmail(to, subject, body), sendSms(to, message), sendWhatsApp(to, message).
  Use Resend for email (RESEND_API_KEY from .env.local).
  SMS and WhatsApp: stub for now (log to console, create delivery as "pending").
  This isolates channel logic from campaign orchestration.

Step 9: Validation.
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Verification checklist:
  Campaign Builder:
  - Communications module shows "Network Campaigns" tab for Enterprise plan
  - "Network Campaigns" tab hidden for Growth and Starter plans
  - Create campaign with multiple gyms selected
  - Multi-channel selection: email + WhatsApp + SMS all checkable
  - Segment filters: status, tags, inactive days filterable
  - "Preview Recipients" shows count and sample member list
  - Save as draft works
  - Send campaign executes and creates deliveries
  Analytics:
  - Analytics tab shows stats for sent campaigns
  - Delivered/opened/clicked counts visible
  - Channel breakdown shows per-channel stats
  - Delivery pie chart renders
  - Engagement rate calculated correctly
  Existing:
  - Single-gym, single-channel campaigns still work (backward compat)
  - Existing saveCampaignAction unchanged for non-network campaigns
  - Communications module KPIs still accurate
  Edge Cases:
  - Empty target gyms → validation error
  - Empty channels → validation error
  - No members match segment → show "0 recipients" warning before send
  - Failed email delivery → marked as "failed" in deliveries, don't block others
  - Scheduled campaign → sets status "scheduled" with scheduled_for date
  General:
  - All actions gated via requireOrgFeatureAccess (no hardcoded plan checks)
  - Resend API key from .env.local (RESEND_API_KEY, RESEND_FROM_EMAIL)
  - existing single-campaign flow preserved — no regression
  - typecheck/lint/build all pass

---

Files to Create:
  supabase/migrations/YYYYMMDD_network_wide_campaigns.sql
  features/organization-owner/components/modules/NetworkCampaignPanel.tsx
  features/communications/lib/message-sender.ts

Files to Modify:
  features/organization-owner/actions/communication-actions.ts (add network campaign actions + backward compat)
  features/organization-owner/components/modules/CommunicationsModule.tsx (add Network Campaigns tab)

Supabase parallel patterns (use throughout):
  // Resolve recipients: fetch gyms + members in parallel
  const [gymsRes, membersRes] = await Promise.all([
    supabase.from("gyms").select("id, name").eq("organization_id", orgId).in("id", targetGymIds),
    supabase.from("members").select("id, full_name, email, phone, status, tags, gym_id")
      .eq("organization_id", orgId).in("gym_id", targetGymIds)
      .in("status", segmentFilters.status ?? ["active"]),
  ]);

  // Execute campaign: fetch campaign + recipients in parallel, then process
  const [campaignRes, deliveriesBase] = await Promise.all([
    supabase.from("campaigns").select("*").eq("id", campaignId).single(),
    // base query; actual insert happens after recipient resolution
    supabase.from("campaign_deliveries").select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId),
  ]);

  // Analytics: fetch campaign + all delivery stats in parallel
  const [campaign, deliveries, byChannel] = await Promise.all([
    supabase.from("campaigns").select("*").eq("id", campaignId).single(),
    supabase.from("campaign_deliveries").select("status").eq("campaign_id", campaignId),
    supabase.from("campaign_deliveries").select("channel, status").eq("campaign_id", campaignId),
  ]);
  // Then aggregate in JS — faster than multiple COUNT queries.

Key design decisions:
  - Campaigns table is extended (ALTER TABLE), not replaced. Backward compatible.
  - target_gym_ids is a uuid[]. If empty/legacy, gym_id is the sole target.
  - channels is text[]. If empty/legacy, campaign_type is the sole channel.
  - segment_filters is jsonb — flexible, no schema migration per new filter type.
  - campaign_deliveries is a separate table for per-recipient tracking (supports analytics).
  - Message sending via Resend for email; SMS/WhatsApp stubbed (marked as pending delivery
    until external API integration is built).
  - NetworkCampaignPanel is a sub-tab of Communications module. Existing campaign tab
    remains the default for simpler single-channel campaigns.
  - All server actions gated with requireOrgFeatureAccess(orgId, "network_wide_campaign_manager").
