Continue from docs/Phase3.9.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 3.9 — Google Calendar Sync + Webhook Management for Organization Owner panel.

Short overview:
  This is the final build phase — two independent integration features. Part A
  (google_calendar_sync) enables Org Owners to connect their Google Calendar so
  class schedules auto-sync. Trainers can also connect their own calendars for
  personal schedule sync. Part B (webhooks) builds a webhook management UI where
  Org Owners configure outbound webhook URLs and view event delivery logs. The
  Razorpay inbound webhook handler already exists — this phase adds the outbound
  webhook configuration and management side. Both features are Enterprise-only.

  Supabase: https://bobqiyhljubfrzmhqnqq.supabase.co (see .env.local for keys)
  Use Promise.all for all independent Supabase queries.

Reference: docs/ENTERPRISE_PRODUCTION_PLAN.md Phase 3 Session 20.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

PART A: Google Calendar Sync

Step A1: Understand the scope.
  Google Calendar OAuth2 integration requires:
  - Google Cloud Console project with Calendar API enabled
  - OAuth2 client credentials (client ID, client secret)
  - Redirect URI for OAuth callback
  - Tokens stored per organization (access_token, refresh_token)
  - Class schedule sync: create/update/delete Google Calendar events when
    class_sessions are created/modified/cancelled
  - Trainer personal calendar sync: trainer connects their own Google account

  Since we don't have Google OAuth credentials yet, this phase builds the
  infrastructure with a pluggable calendar provider interface. The actual
  Google API calls are stubbed but structured for easy activation when
  credentials are obtained.

Step A2: Create migration for calendar integration.
  File: supabase/migrations/YYYYMMDD_google_calendar_sync.sql

  Table: calendar_integrations
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    provider text NOT NULL DEFAULT 'google' CHECK (provider IN ('google', 'outlook'))
    connected_by uuid REFERENCES profiles(id)
    access_token text
    refresh_token text
    token_expires_at timestamptz
    calendar_id text  -- Google Calendar ID to sync to
    sync_enabled boolean DEFAULT false
    sync_classes boolean DEFAULT true
    sync_pt_sessions boolean DEFAULT false
    last_synced_at timestamptz
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()
    UNIQUE (organization_id, provider)

  Enable RLS. Note: tokens should be encrypted in production. Use a placeholder for now.

  Table: calendar_sync_logs
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    integration_id uuid REFERENCES calendar_integrations(id) ON DELETE SET NULL
    event_type text NOT NULL CHECK (event_type IN ('create', 'update', 'delete', 'sync_error'))
    class_session_id uuid REFERENCES class_sessions(id) ON DELETE SET NULL
    external_event_id text  -- Google Calendar event ID
    status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending'))
    error_message text
    created_at timestamptz DEFAULT now()

  Indexes: on (organization_id), on (class_session_id), on (created_at).

  -- Trainer calendar connections (optional personal sync)
  Table: trainer_calendar_connections
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    trainer_id uuid NOT NULL REFERENCES trainers(id) ON DELETE CASCADE
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    provider text NOT NULL DEFAULT 'google'
    access_token text
    refresh_token text
    token_expires_at timestamptz
    calendar_id text
    sync_enabled boolean DEFAULT false
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()
    UNIQUE (trainer_id, provider)

  Enable RLS.

Step A3: Create calendar sync server actions.
  File: features/organization-owner/actions/calendar-actions.ts
  Mark as "use server".

  Export:
  -- Integration management --
  - getCalendarIntegration(organizationId) → CalendarIntegration | null
    Gate: requireOrgFeatureAccess(organizationId, "google_calendar_sync")

  - saveCalendarConfig(organizationId, data: { calendarId?, syncEnabled?, syncClasses?, syncPtSessions? })
    Returns CalendarIntegration
    Gate: requireOrgFeatureAccess(organizationId, "google_calendar_sync")

  - disconnectCalendar(organizationId) → void
    Removes tokens, disables sync. Keeps the integration row for history.
    Gate: requireOrgFeatureAccess(organizationId, "google_calendar_sync")

  -- Sync operations --
  - syncClassSessionToCalendar(organizationId, classSessionId)
    Called when a class session is created/updated.
    1. Fetch integration config (sync_enabled, calendar_id)
    2. If sync_disabled or no integration, return early (silent — no throw)
    3. Fetch class session with class name, trainer, gym, date/time
    4. Create/update calendar event (stubbed: logs to calendar_sync_logs)
    5. Store external_event_id on the log
    Gate: no gate (called internally). Uses hasFeatureAccess silently.
    Returns { synced: boolean; externalEventId?: string }

  - deleteCalendarEvent(organizationId, classSessionId)
    Called when a class session is cancelled.
    Gate: no gate (called internally).
    Returns { deleted: boolean }

  - syncAllUpcomingClasses(organizationId)
    Bulk sync: fetches all upcoming class_sessions and syncs each.
    Gate: requireOrgFeatureAccess(organizationId, "google_calendar_sync")
    Returns { synced: number; failed: number; errors: string[] }

  -- Sync logs --
  - getSyncLogs(organizationId, filters?: { dateFrom?, dateTo?, status?, page?, pageSize? })
    Returns { logs: CalendarSyncLog[]; total: number }
    Gate: requireOrgFeatureAccess(organizationId, "google_calendar_sync")

  -- OAuth helpers (stubbed for when credentials are available) --
  - getGoogleAuthUrl(organizationId)
    Returns the Google OAuth consent URL with redirect_uri pointing back.
    Gate: requireOrgFeatureAccess(organizationId, "google_calendar_sync")

  - handleGoogleCallback(organizationId, code: string)
    Exchanges auth code for tokens, stores in calendar_integrations.
    Gate: requireOrgFeatureAccess(organizationId, "google_calendar_sync")

  Parallel DB pattern:
    const [integrationRes, sessionsRes] = await Promise.all([
      supabase.from("calendar_integrations").select("*")
        .eq("organization_id", orgId).eq("provider", "google").maybeSingle(),
      supabase.from("class_sessions").select("id, session_date, starts_at, ends_at, classes!inner(name), primary_trainer_id")
        .gte("session_date", today).in("status", ["scheduled"]),
    ]);

Step A4: Hook into class session lifecycle.
  File: features/organization-owner/actions/class-actions.ts (or features/classes/actions/class-actions.ts)
  After saveClassSessionAction creates/updates a session:
    - Import syncClassSessionToCalendar from calendar-actions
    - Call syncClassSessionToCalendar(orgId, sessionId).catch(() => {}); (fire-and-forget)

  After cancelClassSessionAction:
    - Call deleteCalendarEvent(orgId, sessionId).catch(() => {});

  Wrap in try/catch — calendar sync failure must NEVER block class operations.

Step A5: Create calendar sync UI.
  File: features/organization-owner/components/modules/GoogleCalendarPanel.tsx
  "use client" component, rendered as a sub-tab in the Settings module or Classes module.

  Props: { dashboard: OrganizationOwnerDashboard; hasFeature: boolean }

  Layout — Connection Tab:
  - If not connected: "Connect Google Calendar" button → opens Google OAuth flow
    (stubbed: stores placeholder config for now)
  - If connected:
    - Status: "Connected" green badge with calendar_id shown
    - "Sync Classes" toggle (sync_enabled)
    - "Sync PT Sessions" toggle (sync_pt_sessions)
    - "Sync All Now" button → calls syncAllUpcomingClasses
    - "Disconnect" button with confirmation
    - Last synced timestamp

  Layout — Logs Tab:
  - Filter bar: date range, status filter (success/failed/pending)
  - Data table: Date, Class Session, Event Type (create/update/delete), Status badge, Error (if failed)
  - Summary: total synced, failed count

  Layout — Trainer Connections Tab (optional):
  - Table: Trainer Name, Status (connected/disconnected), Calendar ID, Actions (connect/disconnect)
  - "Connect" per trainer → triggers trainer OAuth (stubbed)

Step A6: Integrate into Settings or Classes module.
  Recommended: Settings module (SettingsModule.tsx) as a new "Integrations" sub-tab.
  File: features/organization-owner/components/modules/SettingsModule.tsx
  Add sub-tab: "Google Calendar" — GoogleCalendarPanel
  Gated: only show if org has google_calendar_sync feature.

  Alternatively: Classes module as a sub-tab. Either works.

---

PART B: Webhook Management

Step B1: Read existing webhook infrastructure.
  - app/api/webhooks/razorpay/route.ts (inbound Razorpay webhook handler — already exists)
  - features/entitlement/feature-registry.ts (webhooks in FEATURE_KEYS)

Step B2: Create migration for outbound webhooks.
  File: supabase/migrations/YYYYMMDD_webhook_management.sql

  Table: webhook_configs
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    name text NOT NULL
    url text NOT NULL
    secret text  -- HMAC secret for signing outgoing payloads
    events text[] NOT NULL DEFAULT '{}'  -- ["member.created", "member.updated", "payment.received", "check_in", "class.booked", ...]
    is_active boolean DEFAULT true
    last_triggered_at timestamptz
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()

  Index on organization_id.
  Enable RLS.

  Table: webhook_delivery_logs
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    webhook_id uuid NOT NULL REFERENCES webhook_configs(id) ON DELETE CASCADE
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    event_type text NOT NULL
    payload jsonb
    response_status integer
    response_body text
    duration_ms integer
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'retrying'))
    error_message text
    attempt_count integer DEFAULT 1
    created_at timestamptz DEFAULT now()

  Indexes: on (webhook_id, created_at), on (organization_id), on (status).

Step B3: Create webhook server actions.
  File: features/organization-owner/actions/webhook-actions.ts
  Mark as "use server".

  Export:
  -- Webhook config CRUD --
  - getWebhooks(organizationId) → WebhookConfig[]
    Gate: requireOrgFeatureAccess(organizationId, "webhooks")

  - getWebhook(organizationId, webhookId) → WebhookConfig
    Gate: requireOrgFeatureAccess(organizationId, "webhooks")

  - createWebhook(organizationId, data: { name, url, secret?, events[] })
    Returns WebhookConfig
    Gate: requireOrgFeatureAccess(organizationId, "webhooks")
    Validation: URL must be valid HTTPS. Auto-generates secret if not provided.

  - updateWebhook(organizationId, webhookId, data)
    Returns WebhookConfig
    Gate: requireOrgFeatureAccess(organizationId, "webhooks")

  - deleteWebhook(organizationId, webhookId) → void
    Gate: requireOrgFeatureAccess(organizationId, "webhooks")

  -- Delivery logs --
  - getWebhookLogs(organizationId, webhookId?, filters?: { status?, dateFrom?, dateTo?, page?, pageSize? })
    Returns { logs: WebhookDeliveryLog[]; total: number }
    Gate: requireOrgFeatureAccess(organizationId, "webhooks")

  - retryWebhookDelivery(organizationId, logId) → WebhookDeliveryLog
    Gate: requireOrgFeatureAccess(organizationId, "webhooks")
    Replays the payload to the webhook URL.

  -- Test --
  - testWebhook(organizationId, webhookId)
    Sends a test payload to the webhook URL.
    Records result in delivery_logs.
    Returns { success: boolean; statusCode: number; responseBody: string; durationMs: number }
    Gate: requireOrgFeatureAccess(organizationId, "webhooks")

  -- Internal: trigger outbound webhooks --
  - triggerWebhooks(organizationId, eventType: string, payload: Record<string, unknown>)
    Called internally by other actions (member create, payment receive, check-in).
    No feature gate (called internally). Uses hasFeatureAccess silently.
    1. Fetch active webhooks with matching events
    2. For each webhook: sign payload with secret, POST to URL, log delivery
    3. Runs in the background — fire-and-forget, never blocks the source action
    Use fetch() with timeout of 10 seconds per webhook.
    All webhook calls run in Promise.all for parallel delivery.

  Parallel DB pattern for triggerWebhooks:
    const { data: webhooks } = await supabase.from("webhook_configs")
      .select("*").eq("organization_id", orgId).eq("is_active", true)
      .contains("events", [eventType]);
    // Then fire all webhook POST requests in parallel:
    await Promise.allSettled(webhooks.map(async (wh) => {
      const start = Date.now();
      try {
        const headers = { "Content-Type": "application/json", "X-Webhook-Signature": signPayload(wh.secret, payload) };
        const res = await fetch(wh.url, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
        await supabase.from("webhook_delivery_logs").insert({
          webhook_id: wh.id, organization_id: orgId, event_type: eventType,
          payload, response_status: res.status, duration_ms: Date.now() - start, status: "success",
        });
      } catch (err) {
        await supabase.from("webhook_delivery_logs").insert({
          webhook_id: wh.id, organization_id: orgId, event_type: eventType,
          payload, duration_ms: Date.now() - start, status: "failed",
          error_message: err instanceof Error ? err.message : "Delivery failed",
        });
      }
    }));

Step B4: Hook webhook triggers into key events.
  Create a centralized trigger file:
  File: features/webhooks/trigger.ts
  Export triggerWebhook(organizationId, eventType, payload) that calls the server action.

  Hook into these events:
  - Member created: member-actions.ts after saveMemberAction
  - Member updated: member-actions.ts after saveMemberAction (update path)
  - Payment received: membership-actions.ts or payment-processing after successful payment
  - Check-in: attendance-actions.ts after successful processCheckIn
  - Class booked: class-actions.ts after bookClassAction
  - Lead created/updated: lead-actions.ts after status change

  Each hook point: import { triggerWebhook } from "@/features/webhooks/trigger";
  triggerWebhook(orgId, "member.created", memberData).catch(() => {});

  Always fire-and-forget — NEVER block the main action on webhook delivery.

Step B5: Create webhook management UI.
  File: features/organization-owner/components/modules/WebhookPanel.tsx
  "use client" component, rendered as a sub-tab in the Settings module.

  Props: { dashboard: OrganizationOwnerDashboard; hasFeature: boolean }

  Layout — Config Tab:
  - "Add Webhook" button → opens drawer:
    - Name input
    - URL input (HTTPS validation)
    - Event type multi-select checkboxes:
      member.created, member.updated, member.deleted,
      payment.received, payment.failed,
      check_in, check_out,
      class.booked, class.cancelled,
      lead.created, lead.updated, lead.converted,
      membership.renewed, membership.expired
    - Webhook secret: auto-generated, shown once, copyable
  - Webhook list: Name, URL, Events (tags), Active toggle, Last Triggered, Actions (Test, Edit, Delete)
  - "Test" button → sends test payload, shows result popup

  Layout — Logs Tab:
  - Webhook selector dropdown (filter by webhook)
  - Date range filter, status filter
  - Data table: Timestamp, Webhook Name, Event Type, Status badge, Response Code, Duration, Error
  - Status badges: success=green, failed=red, pending=yellow, retrying=orange
  - "Retry" button on failed deliveries
  - Summary: success rate %, avg response time

Step B6: Integrate into Settings module.
  File: features/organization-owner/components/modules/SettingsModule.tsx

  Add sub-tab: "Webhooks" — WebhookPanel
  Gated: only show if org has webhooks feature.
  Use entitlement provider: const hasFeature = useHasFeature("webhooks");

  Import WebhookPanel.

---

Final Validation (both parts):
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Google Calendar:
  - Settings/Classes module shows "Google Calendar" tab for Enterprise plan
  - "Google Calendar" tab hidden for Growth and Starter plans
  - Connect button exists (OAuth flow UI ready)
  - Toggle sync on/off
  - "Sync All Now" processes upcoming classes
  - Sync logs show success/failed entries
  - Calendar sync is fire-and-forget (never blocks class operations)
  Webhooks:
  - Settings module shows "Webhooks" tab for Enterprise plan
  - "Webhooks" tab hidden for Growth and Starter plans
  - Create webhook with URL, events, secret
  - Test webhook sends payload and shows result
  - Webhook list shows all configs
  - Delete removes webhook config and delivery logs (CASCADE)
  - Delivery logs show history with status codes
  - Retry button replays failed deliveries
  - Secret is auto-generated and copyable
  - Webhook triggers fire-and-forget from source actions
  Integration:
  - Member creation triggers member.created webhook
  - Payment success triggers payment.received webhook
  - Check-in triggers check_in webhook
  - All triggers are fire-and-forget (never block source action)
  General:
  - All admin actions gated via requireOrgFeatureAccess
  - No hardcoded plan checks
  - typecheck/lint/build all pass

---

Files to Create:
  supabase/migrations/YYYYMMDD_google_calendar_sync.sql
  supabase/migrations/YYYYMMDD_webhook_management.sql
  features/organization-owner/actions/calendar-actions.ts
  features/organization-owner/actions/webhook-actions.ts
  features/organization-owner/components/modules/GoogleCalendarPanel.tsx
  features/organization-owner/components/modules/WebhookPanel.tsx
  features/webhooks/trigger.ts

Files to Modify:
  features/organization-owner/components/modules/SettingsModule.tsx (add Google Calendar + Webhooks tabs)
  features/organization-owner/actions/class-actions.ts (fire calendar sync on create/update/cancel)
  features/organization-owner/actions/member-actions.ts (fire webhook on create/update)
  features/memberships/actions/membership-actions.ts (fire webhook on payment)
  features/attendance/actions/attendance-actions.ts (fire webhook on check-in)
  features/classes/actions/class-actions.ts (fire webhook on class booked)
  features/organization-owner/actions/lead-actions.ts (fire webhook on lead status change)

Supabase parallel patterns (use throughout):
  // Google sync: fetch integration + sessions in parallel
  const [integration, sessions] = await Promise.all([
    supabase.from("calendar_integrations").select("*").eq("organization_id", orgId).maybeSingle(),
    supabase.from("class_sessions").select("id, session_date, starts_at, ends_at, classes(name), primary_trainer_id")
      .gte("session_date", today).in("status", ["scheduled"]),
  ]);

  // Webhook trigger: fetch webhooks + fire all deliveries in parallel
  const { data: webhooks } = await supabase.from("webhook_configs")
    .select("*").eq("organization_id", orgId).eq("is_active", true).contains("events", [eventType]);
  await Promise.allSettled(webhooks.map(wh => deliverWebhook(wh, payload)));

  // Webhook logs: fetch logs + stats in parallel
  const [logs, successCount] = await Promise.all([
    supabase.from("webhook_delivery_logs").select("*").eq("webhook_id", webhookId)
      .order("created_at", { ascending: false }).limit(50),
    supabase.from("webhook_delivery_logs").select("status", { count: "exact", head: true })
      .eq("webhook_id", webhookId).eq("status", "success"),
  ]);

Key design decisions:
  - Google Calendar: OAuth2 flow is stubbed but infrastructure is ready. When credentials
    are obtained, fill in getGoogleAuthUrl and handleGoogleCallback with actual Google API calls.
    The sync_ClassSession_to_calendar function is designed to be provider-agnostic.
  - Calendar sync uses fire-and-forget pattern — NEVER blocks class operations.
  - Webhooks: outbound only (inbound Razorpay webhook already exists and is unchanged).
  - Webhook payloads are JSON. Payload is signed with HMAC-SHA256 using the webhook secret
    (for recipient verification). Signature header: X-Webhook-Signature.
  - Webhook delivery has 10-second timeout per webhook. Uses AbortSignal.timeout.
  - All webhook deliveries logged for audit trail and retry support.
  - Both features are sub-tabs of the Settings module (under "Integrations" section).
  - All server actions gated with requireOrgFeatureAccess using correct feature key.
