"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import {
  createIntegrationLog,
  disconnectIntegration,
  getIntegrationByProvider,
  getIntegrations,
  getLatestIntegrationLog,
  getMaskedIntegrationStatus,
  type IntegrationConnectionStatus,
  type IntegrationProviderId,
  upsertProviderIntegration,
} from "@/features/integrations/services/integrations-service";
import {
  getGoogleOAuthConfigurationStatus,
  getGoogleCalendarAuthUrl,
  type CalendarIntegrationRow,
  testGoogleCalendarConnection,
} from "@/features/integrations/services/google-calendar-service";
import {
  testMsg91Sms,
  testMsg91WhatsApp,
  validateMsg91SmsConfig,
  validateMsg91WhatsAppConfig,
} from "@/features/integrations/services/msg91-service";
import {
  getCrmFieldMappingSummary,
  getCrmIntegrationByProvider,
  getCrmProviderCategory,
  getCrmProviderDescription,
  getCrmProviderLabel,
  enqueueCrmLeadSyncForOrganization,
  getCrmSyncJobs,
  getCrmSyncMappings,
  getCrmWebhookEvents,
  getRecentCrmLeads,
  retryCrmSyncJob,
  saveCrmIntegrationConnection,
  testCrmConnection,
  type CrmProviderId,
} from "@/features/integrations/services/crm-sync-service";
import { getOrgOwnerContext } from "./action-utils";

type DbClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type IntegrationActionResult = {
  status: "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
  redirectUrl?: string;
};

export type IntegrationDashboardItem = {
  provider: IntegrationProviderId;
  integrationId?: string | null;
  title: string;
  description: string;
  category: "payments" | "calendar" | "whatsapp" | "sms" | "crm";
  status: IntegrationConnectionStatus;
  statusLabel: string;
  actionLabel: string;
  errorMessage: string | null;
  lastActivityAt: string | null;
  configSummary: Record<string, string | boolean | null | Record<string, string>>;
  latestLogMessage: string | null;
  latestLogStatus: string | null;
  latestLogAt: string | null;
  whoConnected: string | null;
  webhookUrl?: string | null;
};

export type IntegrationDashboardData = {
  organizationId: string;
  items: IntegrationDashboardItem[];
  crmDetails: Partial<Record<CrmProviderId, CrmIntegrationDetail>>;
};

export type CrmIntegrationJob = {
  id: string;
  entityId: string;
  eventType: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  externalId: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  runAfter: string;
};

export type CrmIntegrationMapping = {
  id: string;
  entityId: string;
  externalId: string;
  externalObjectType: string;
  syncStatus: string;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export type CrmIntegrationWebhookEvent = {
  id: string;
  eventId: string;
  externalObjectId: string;
  eventType: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
};

export type CrmIntegrationLead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  source: string | null;
  updatedAt: string;
};

export type CrmIntegrationDetail = {
  provider: CrmProviderId;
  integrationId: string | null;
  title: string;
  status: IntegrationConnectionStatus;
  statusLabel: string;
  errorMessage: string | null;
  lastActivityAt: string | null;
  health: {
    connected: boolean;
    stale: boolean;
    pendingJobs: number;
    failedJobs: number;
    processedJobs: number;
    webhookFailures: number;
    mappedLeads: number;
  };
  fieldMappings: ReturnType<typeof getCrmFieldMappingSummary>;
  recentJobs: CrmIntegrationJob[];
  recentMappings: CrmIntegrationMapping[];
  recentWebhookEvents: CrmIntegrationWebhookEvent[];
  recentLeads: CrmIntegrationLead[];
};

type CalendarIntegrationRecord = {
  id: string;
  organization_id: string;
  provider: string;
  connected_by: string | null;
  calendar_id: string | null;
  sync_enabled: boolean | null;
  sync_classes: boolean | null;
  sync_pt_sessions: boolean | null;
  last_synced_at: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  updated_at: string | null;
};

function mapStatusLabel(status: IntegrationConnectionStatus) {
  switch (status) {
    case "connected":
      return "Connected";
    case "error":
      return "Needs attention";
    case "expired":
      return "Reconnect required";
    default:
      return "Not connected";
  }
}

async function getSupabaseDb(): Promise<DbClient> {
  return createSupabaseServerClient();
}

type OrgActionContext = {
  organizationId: string;
  userId: string;
};

type CrmFormParseResult =
  | {
      ok: true;
      values: {
        label?: string;
        credentials: Record<string, unknown>;
        config: Record<string, unknown>;
      };
    }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string>;
    };

async function getOrgIntegrationContext(nextPath: string): Promise<OrgActionContext> {
  const ctx = await getOrgOwnerContext(nextPath);
  if (!ctx.userId) {
    throw new Error("User not authenticated.");
  }
  return {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  };
}

function parseCrmFormData(provider: CrmProviderId, formData: FormData): CrmFormParseResult {
  const fieldMappings = {
    firstNameField: String(formData.get("firstNameField") ?? "").trim(),
    lastNameField: String(formData.get("lastNameField") ?? "").trim(),
    emailField: String(formData.get("emailField") ?? "").trim(),
    phoneField: String(formData.get("phoneField") ?? "").trim(),
    notesField: String(formData.get("notesField") ?? "").trim(),
    sourceField: String(formData.get("sourceField") ?? "").trim(),
    statusField: String(formData.get("statusField") ?? "").trim(),
  };

  if (provider === "hubspot") {
    const accessToken = String(formData.get("accessToken") ?? "").trim();
    const clientSecret = String(formData.get("clientSecret") ?? "").trim();
    const portalId = String(formData.get("portalId") ?? "").trim();
    const label = String(formData.get("label") ?? "HubSpot CRM").trim() || "HubSpot CRM";
    const testEmail = String(formData.get("testEmail") ?? "").trim();
    const syncLeads = String(formData.get("syncLeads") ?? "true") === "true";
    const syncContacts = String(formData.get("syncContacts") ?? "true") === "true";

    if (!accessToken) {
      return { ok: false, message: "HubSpot access token is required.", fieldErrors: { accessToken: "Access token is required." } };
    }
    if (!clientSecret) {
      return { ok: false, message: "HubSpot client secret is required for webhook verification.", fieldErrors: { clientSecret: "Client secret is required." } };
    }

    return {
      ok: true,
      values: {
        label,
        credentials: { accessToken, clientSecret },
        config: {
          portalId: portalId || null,
          syncLeads,
          syncContacts,
          testEmail: testEmail || null,
          fieldMappings: {
            firstNameField: fieldMappings.firstNameField || "firstname",
            lastNameField: fieldMappings.lastNameField || "lastname",
            emailField: fieldMappings.emailField || "email",
            phoneField: fieldMappings.phoneField || "phone",
            notesField: fieldMappings.notesField || "hs_lead_status",
            sourceField: fieldMappings.sourceField || "lifecyclestage",
            statusField: fieldMappings.statusField || "hs_lead_status",
          },
        },
      },
    };
  }

  const clientId = String(formData.get("clientId") ?? "").trim();
  const clientSecret = String(formData.get("clientSecret") ?? "").trim();
  const webhookSecret = String(formData.get("webhookSecret") ?? "").trim();
  const refreshToken = String(formData.get("refreshToken") ?? "").trim();
  const accessToken = String(formData.get("accessToken") ?? "").trim();
  const accountsDomain = String(formData.get("accountsDomain") ?? "accounts.zoho.com").trim() || "accounts.zoho.com";
  const label = String(formData.get("label") ?? "Zoho CRM").trim() || "Zoho CRM";
  const testEmail = String(formData.get("testEmail") ?? "").trim();
  const syncLeads = String(formData.get("syncLeads") ?? "true") === "true";
  const syncContacts = String(formData.get("syncContacts") ?? "true") === "true";

  if (!accessToken && (!clientId || !clientSecret || !refreshToken)) {
    return {
      ok: false,
      message: "Zoho requires either an access token or a full OAuth refresh token set.",
      fieldErrors: {
        accessToken: "Provide an access token or OAuth refresh token data.",
        refreshToken: "Provide refresh token, client ID, and client secret.",
      },
    };
  }
  if (!webhookSecret) {
    return {
      ok: false,
      message: "Zoho webhook secret is required for inbound verification.",
      fieldErrors: {
        webhookSecret: "Webhook secret is required.",
      },
    };
  }

  return {
    ok: true,
    values: {
      label,
      credentials: {
        accessToken: accessToken || null,
        refreshToken: refreshToken || null,
        clientId: clientId || null,
        clientSecret: clientSecret || null,
        webhookSecret,
      },
      config: {
        accountsDomain,
        syncLeads,
        syncContacts,
        testEmail: testEmail || null,
        fieldMappings: {
          firstNameField: fieldMappings.firstNameField || "First_Name",
          lastNameField: fieldMappings.lastNameField || "Last_Name",
          emailField: fieldMappings.emailField || "Email",
          phoneField: fieldMappings.phoneField || "Phone",
          notesField: fieldMappings.notesField || "Description",
          sourceField: fieldMappings.sourceField || "Lead_Source",
          statusField: fieldMappings.statusField || "Lead_Status",
        },
      },
    },
  };
}

async function getCalendarIntegrationRecord(organizationId: string) {
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("calendar_integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("provider", "google")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as CalendarIntegrationRecord | null;
}

async function syncGoogleCalendarIntegrationRecord(organizationId: string, userId: string) {
  const calendarIntegration = await getCalendarIntegrationRecord(organizationId);
  const status: IntegrationConnectionStatus =
    calendarIntegration?.sync_enabled && calendarIntegration.access_token
      ? "connected"
      : calendarIntegration?.refresh_token
        ? "expired"
        : "disconnected";

  const record = await upsertProviderIntegration({
    organizationId,
    provider: "google_calendar",
    label: "Google Calendar",
    createdBy: userId,
    config: {
      calendarId: calendarIntegration?.calendar_id ?? "primary",
      syncClasses: calendarIntegration?.sync_classes ?? true,
      syncPtSessions: calendarIntegration?.sync_pt_sessions ?? false,
    },
    status,
    errorMessage: null,
    lastSyncAt: calendarIntegration?.last_synced_at ?? null,
  });

  return record;
}

async function buildLatestLog(integrationId: string | null) {
  if (!integrationId) {
    return { latestLogMessage: null, latestLogStatus: null, latestLogAt: null };
  }

  const latestLog = await getLatestIntegrationLog(integrationId);
  return {
    latestLogMessage: latestLog?.error_message ?? latestLog?.action ?? null,
    latestLogStatus: latestLog?.status ?? null,
    latestLogAt: latestLog?.created_at ?? null,
  };
}

function toDashboardItem(
  base: Omit<IntegrationDashboardItem, "latestLogMessage" | "latestLogStatus" | "latestLogAt">,
  log: { latestLogMessage: string | null; latestLogStatus: string | null; latestLogAt: string | null },
): IntegrationDashboardItem {
  return { ...base, ...log };
}

function isStale(lastActivityAt: string | null) {
  if (!lastActivityAt) return true;
  const elapsedMs = Date.now() - new Date(lastActivityAt).getTime();
  return Number.isFinite(elapsedMs) ? elapsedMs > 24 * 60 * 60_000 : true;
}

function mapCrmJob(job: {
  id: string;
  entity_id: string;
  event_type: string;
  status: string;
  attempts: number;
  max_attempts: number;
  external_id: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  run_after: string;
}): CrmIntegrationJob {
  return {
    id: job.id,
    entityId: job.entity_id,
    eventType: job.event_type,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.max_attempts,
    externalId: job.external_id,
    lastError: job.last_error,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    runAfter: job.run_after,
  };
}

function mapCrmMapping(mapping: {
  id: string;
  entity_id: string;
  external_id: string;
  external_object_type: string;
  sync_status: string;
  last_synced_at: string | null;
  last_error: string | null;
}): CrmIntegrationMapping {
  return {
    id: mapping.id,
    entityId: mapping.entity_id,
    externalId: mapping.external_id,
    externalObjectType: mapping.external_object_type,
    syncStatus: mapping.sync_status,
    lastSyncedAt: mapping.last_synced_at,
    lastError: mapping.last_error,
  };
}

function mapCrmWebhookEvent(event: {
  id: string;
  event_id: string;
  external_object_id: string;
  event_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}): CrmIntegrationWebhookEvent {
  return {
    id: event.id,
    eventId: event.event_id,
    externalObjectId: event.external_object_id,
    eventType: event.event_type,
    status: event.status,
    errorMessage: event.error_message,
    createdAt: event.created_at,
    processedAt: event.processed_at,
  };
}

function mapCrmLead(lead: Awaited<ReturnType<typeof getRecentCrmLeads>>[number]): CrmIntegrationLead {
  const name = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || lead.first_name || "Lead";
  return {
    id: lead.id,
    name,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    status: lead.status?.name ?? null,
    source: lead.source?.name ?? null,
    updatedAt: lead.updated_at,
  };
}

async function buildCrmIntegrationDetail(organizationId: string, provider: CrmProviderId) {
  const integration = await getCrmIntegrationByProvider(organizationId, provider);
  if (!integration) return null;

  const [jobs, mappings, webhookEvents, leads] = await Promise.all([
    getCrmSyncJobs(organizationId, 25),
    getCrmSyncMappings(organizationId),
    getCrmWebhookEvents(organizationId, integration.id, 25).catch(() => []),
    getRecentCrmLeads(organizationId, 8),
  ]);

  const providerJobs = jobs.filter((job) => job.integration_id === integration.id);
  const providerMappings = mappings.filter((mapping) => mapping.integration_id === integration.id);
  const providerWebhookEvents = webhookEvents.filter((event) => event.provider === provider);
  const pendingJobs = providerJobs.filter((job) => job.status === "pending" || job.status === "retry").length;
  const failedJobs = providerJobs.filter((job) => job.status === "dead_letter").length;
  const processedJobs = providerJobs.filter((job) => job.status === "succeeded").length;
  const webhookFailures = providerWebhookEvents.filter((event) => event.status === "failed").length;
  const lastActivityAt = integration.last_sync_at ?? integration.updated_at ?? null;

  return {
    provider,
    integrationId: integration.id,
    title: integration.label ?? getCrmProviderLabel(provider),
    status: integration.status as IntegrationConnectionStatus,
    statusLabel: mapStatusLabel(integration.status as IntegrationConnectionStatus),
    errorMessage: integration.error_message,
    lastActivityAt,
    health: {
      connected: integration.status === "connected",
      stale: isStale(lastActivityAt),
      pendingJobs,
      failedJobs,
      processedJobs,
      webhookFailures,
      mappedLeads: providerMappings.length,
    },
    fieldMappings: getCrmFieldMappingSummary(provider, integration),
    recentJobs: providerJobs.slice(0, 10).map(mapCrmJob),
    recentMappings: providerMappings.slice(0, 10).map(mapCrmMapping),
    recentWebhookEvents: providerWebhookEvents.slice(0, 10).map(mapCrmWebhookEvent),
    recentLeads: leads.map(mapCrmLead),
  } satisfies CrmIntegrationDetail;
}

export async function getOrgIntegrationsAction(): Promise<IntegrationDashboardData> {
  const { organizationId, userId } = await getOrgIntegrationContext("/organization/integrations");
  const integrations = await getIntegrations(organizationId);
  const byProvider = new Map(integrations.map((row) => [row.provider, row] as const));

  const smsStatus = getMaskedIntegrationStatus(byProvider.get("msg91_sms") ?? null);
  const whatsappStatus = getMaskedIntegrationStatus(byProvider.get("msg91_whatsapp") ?? null);
  const hubspotRecord = byProvider.get("hubspot") ?? null;
  const zohoRecord = byProvider.get("zoho_crm") ?? null;
  const hubspotStatus = getMaskedIntegrationStatus(hubspotRecord);
  const zohoStatus = getMaskedIntegrationStatus(zohoRecord);
  const razorpayRecord = byProvider.get("razorpay");
  const razorpayStatus = getMaskedIntegrationStatus(razorpayRecord ?? null);
  const calendarMirror = await syncGoogleCalendarIntegrationRecord(organizationId, userId);
  const calendarStatus = getMaskedIntegrationStatus(calendarMirror);
  const googleOauthStatus = getGoogleOAuthConfigurationStatus();

  let razorpayConnectionInfo: { whoConnected: string | null } = { whoConnected: null };
  if (razorpayRecord) {
    const { data: profile } = await (await getSupabaseDb())
      .from("profiles")
      .select("full_name")
      .eq("id", razorpayRecord.created_by)
      .maybeSingle();
    razorpayConnectionInfo = { whoConnected: (profile as { full_name?: string } | null)?.full_name ?? razorpayRecord.created_by };
  }

  const [smsLog, whatsappLog, calendarLog, razorpayLog] = await Promise.all([
    buildLatestLog(smsStatus?.record?.id ?? null),
    buildLatestLog(whatsappStatus?.record?.id ?? null),
    buildLatestLog(calendarStatus?.record?.id ?? null),
    buildLatestLog(razorpayStatus?.record?.id ?? null),
  ]);
  const [hubspotLog, zohoLog] = await Promise.all([
    buildLatestLog(hubspotStatus?.record?.id ?? null),
    buildLatestLog(zohoStatus?.record?.id ?? null),
  ]);
  const [hubspotDetail, zohoDetail] = await Promise.all([
    buildCrmIntegrationDetail(organizationId, "hubspot"),
    buildCrmIntegrationDetail(organizationId, "zoho_crm"),
  ]);

  return {
    organizationId,
    crmDetails: {
      hubspot: hubspotDetail ?? undefined,
      zoho_crm: zohoDetail ?? undefined,
    },
    items: [
      toDashboardItem({
        provider: "razorpay",
        title: "Razorpay",
        description: "Your organization's payment gateway for collecting member payments, subscriptions, and fees.",
        category: "payments",
        status: razorpayStatus?.status ?? "disconnected",
        statusLabel: mapStatusLabel(razorpayStatus?.status ?? "disconnected"),
        actionLabel: razorpayStatus?.status === "connected" ? "Validate" : "Connect Razorpay",
        errorMessage: razorpayStatus?.errorMessage ?? null,
        lastActivityAt: razorpayStatus?.lastActivityAt ?? null,
        configSummary: razorpayStatus?.maskedConfig ?? {},
        whoConnected: razorpayConnectionInfo.whoConnected,
      }, razorpayLog),
      toDashboardItem({
        provider: "google_calendar",
        title: "Google Calendar",
        description: "OAuth-based calendar sync for class scheduling across your organization.",
        category: "calendar",
        status: !googleOauthStatus.configured ? "error" : calendarStatus?.status ?? "disconnected",
        statusLabel: !googleOauthStatus.configured
          ? "Platform setup required"
          : mapStatusLabel(calendarStatus?.status ?? "disconnected"),
        actionLabel: !googleOauthStatus.configured
          ? "Platform blocked"
          : calendarStatus?.status === "connected" ? "Test calendar" : "Connect Google",
        errorMessage: calendarStatus?.errorMessage ?? googleOauthStatus.message ?? null,
        lastActivityAt: calendarStatus?.lastActivityAt ?? null,
        configSummary: calendarStatus?.maskedConfig ?? {},
        whoConnected: null,
      }, calendarLog),
      toDashboardItem({
        provider: "msg91_whatsapp",
        title: "MSG91 WhatsApp",
        description: "Template-based WhatsApp delivery for campaigns, reminders, and member updates.",
        category: "whatsapp",
        status: whatsappStatus?.status ?? "disconnected",
        statusLabel: mapStatusLabel(whatsappStatus?.status ?? "disconnected"),
        actionLabel: "Save and test",
        errorMessage: whatsappStatus?.errorMessage ?? null,
        lastActivityAt: whatsappStatus?.lastActivityAt ?? null,
        configSummary: whatsappStatus?.maskedConfig ?? {},
        whoConnected: null,
      }, whatsappLog),
      toDashboardItem({
        provider: "msg91_sms",
        title: "MSG91 SMS",
        description: "India-first SMS delivery using approved MSG91 flow templates and DLT-aware routing.",
        category: "sms",
        status: smsStatus?.status ?? "disconnected",
        statusLabel: mapStatusLabel(smsStatus?.status ?? "disconnected"),
        actionLabel: "Save and test",
        errorMessage: smsStatus?.errorMessage ?? null,
        lastActivityAt: smsStatus?.lastActivityAt ?? null,
        configSummary: smsStatus?.maskedConfig ?? {},
        whoConnected: null,
      }, smsLog),
      toDashboardItem({
        provider: "hubspot",
        integrationId: hubspotStatus?.record?.id ?? null,
        title: "HubSpot CRM",
        description: getCrmProviderDescription("hubspot"),
        category: getCrmProviderCategory("hubspot"),
        status: hubspotStatus?.status ?? "disconnected",
        statusLabel: mapStatusLabel(hubspotStatus?.status ?? "disconnected"),
        actionLabel: hubspotStatus?.status === "connected" ? "Test CRM" : "Connect HubSpot",
        errorMessage: hubspotStatus?.errorMessage ?? null,
        lastActivityAt: hubspotStatus?.lastActivityAt ?? null,
        configSummary: {
          ...(hubspotStatus?.maskedConfig ?? {}),
          fieldMappings: getCrmFieldMappingSummary("hubspot", hubspotStatus?.record ?? null),
        },
        whoConnected: null,
        webhookUrl: hubspotStatus?.record?.id ? `/api/webhooks/crm/hubspot/${hubspotStatus.record.id}` : null,
      }, hubspotLog),
      toDashboardItem({
        provider: "zoho_crm",
        integrationId: zohoStatus?.record?.id ?? null,
        title: "Zoho CRM",
        description: getCrmProviderDescription("zoho_crm"),
        category: getCrmProviderCategory("zoho_crm"),
        status: zohoStatus?.status ?? "disconnected",
        statusLabel: mapStatusLabel(zohoStatus?.status ?? "disconnected"),
        actionLabel: zohoStatus?.status === "connected" ? "Test CRM" : "Connect Zoho",
        errorMessage: zohoStatus?.errorMessage ?? null,
        lastActivityAt: zohoStatus?.lastActivityAt ?? null,
        configSummary: {
          ...(zohoStatus?.maskedConfig ?? {}),
          fieldMappings: getCrmFieldMappingSummary("zoho_crm", zohoStatus?.record ?? null),
        },
        whoConnected: null,
        webhookUrl: zohoStatus?.record?.id ? `/api/webhooks/crm/zoho_crm/${zohoStatus.record.id}` : null,
      }, zohoLog),
    ],
  };
}

export async function saveOrgRazorpayIntegrationAction(formData: FormData): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getOrgIntegrationContext("/organization/integrations");

  const keyId = String(formData.get("keyId") ?? "").trim();
  const keySecret = String(formData.get("keySecret") ?? "").trim();
  const webhookSecret = String(formData.get("webhookSecret") ?? "").trim();
  const label = String(formData.get("label") ?? "Razorpay").trim() || "Razorpay";

  const fieldErrors: Record<string, string> = {};
  if (!keyId) fieldErrors.keyId = "Razorpay Key ID is required.";
  if (!keySecret) fieldErrors.keySecret = "Razorpay Key Secret is required.";
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Please fill in all required fields.", fieldErrors };
  }

  const env = keyId.startsWith("rzp_live_") ? "live" : "test";
  const expectedPrefix = env === "live" ? "rzp_live_" : "rzp_test_";
  if (!keyId.startsWith(expectedPrefix)) {
    return { status: "error", message: `Key ID does not look like a ${env} mode key. Expected prefix: ${expectedPrefix}`, fieldErrors: { keyId: `Must start with ${expectedPrefix}` } };
  }

  await upsertProviderIntegration({
    organizationId,
    provider: "razorpay",
    label,
    createdBy: userId,
    credentials: { keyId, keySecret, webhookSecret },
    config: { environment: env },
    status: "disconnected",
    errorMessage: null,
  });

  await writeAuditLog({
    actorId: userId,
    action: "organization_owner.integration.razorpay.saved",
    entityType: "integration",
    metadata: { provider: "razorpay" },
  });

  revalidatePath("/organization/integrations");
  return { status: "success", message: "Razorpay credentials saved." };
}

export async function testOrgRazorpayIntegrationAction(): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getOrgIntegrationContext("/organization/integrations");

  const integration = await getIntegrationByProvider(organizationId, "razorpay");
  if (!integration) {
    return { status: "error", message: "Razorpay is not configured. Save your credentials first." };
  }

  const credentials = integration.credentials as Record<string, unknown> | null;
  const keyId = typeof credentials?.keyId === "string" ? credentials.keyId : "";
  const keySecret = typeof credentials?.keySecret === "string" ? credentials.keySecret : "";

  if (!keyId || !keySecret) {
    return { status: "error", message: "Razorpay credentials are incomplete. Please reconfigure." };
  }

  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/payments?count=1", {
      headers: { authorization: `Basic ${auth}` },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Razorpay validation failed with status ${response.status}.`);
    }

    await upsertProviderIntegration({
      organizationId,
      provider: "razorpay",
      label: integration.label ?? "Razorpay",
      createdBy: userId,
      credentials: integration.credentials as Record<string, unknown>,
      config: integration.config as Record<string, unknown>,
      status: "connected",
      errorMessage: null,
      lastSyncAt: new Date().toISOString(),
    });

    const record = await getIntegrationByProvider(organizationId, "razorpay");
    if (record) {
      await createIntegrationLog({
        integration_id: record.id,
        action: "razorpay.test",
        status: "success",
      });
    }

    revalidatePath("/organization/integrations");
    return { status: "success", message: "Razorpay credentials validated successfully." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Razorpay validation failed.";

    await upsertProviderIntegration({
      organizationId,
      provider: "razorpay",
      label: integration.label ?? "Razorpay",
      createdBy: userId,
      credentials: integration.credentials as Record<string, unknown>,
      config: integration.config as Record<string, unknown>,
      status: "error",
      errorMessage: message,
      lastSyncAt: new Date().toISOString(),
    });

    const record = await getIntegrationByProvider(organizationId, "razorpay");
    if (record) {
      await createIntegrationLog({
        integration_id: record.id,
        action: "razorpay.test",
        status: "error",
        error_message: message,
      });
    }

    revalidatePath("/organization/integrations");
    return { status: "error", message };
  }
}

export async function disconnectOrgRazorpayIntegrationAction(): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getOrgIntegrationContext("/organization/integrations");

  const integration = await getIntegrationByProvider(organizationId, "razorpay");
  if (!integration) {
    return { status: "error", message: "Razorpay integration not found." };
  }

  await disconnectIntegration(integration.id);
  await writeAuditLog({
    actorId: userId,
    action: "organization_owner.integration.razorpay.disconnected",
    entityType: "integration",
    entityId: integration.id,
    metadata: { provider: "razorpay" },
  });

  revalidatePath("/organization/integrations");
  return { status: "success", message: "Razorpay disconnected." };
}

export async function saveOrgMsg91SmsIntegrationAction(formData: FormData): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getOrgIntegrationContext("/organization/integrations");
  const authKey = String(formData.get("authKey") ?? "").trim();
  const flowId = String(formData.get("flowId") ?? "").trim();
  const senderId = String(formData.get("senderId") ?? "").trim();
  const testMobile = String(formData.get("testMobile") ?? "").trim();

  const validation = await validateMsg91SmsConfig({ authKey, flowId, senderId });
  if (!validation.valid) {
    return { status: "error", message: validation.errors[0] ?? "Invalid MSG91 SMS configuration.", fieldErrors: { authKey: !authKey.trim() ? "Required" : "", flowId: !flowId.trim() ? "Required" : "" } };
  }

  await upsertProviderIntegration({
    organizationId,
    provider: "msg91_sms",
    label: "MSG91 SMS",
    createdBy: userId,
    credentials: { authKey },
    config: { flowId, senderId, shortUrl: "0", testMobile },
    status: "disconnected",
    errorMessage: null,
  });

  await writeAuditLog({
    actorId: userId,
    action: "organization_owner.integration.msg91_sms.saved",
    entityType: "integration",
    metadata: { provider: "msg91_sms" },
  });

  revalidatePath("/organization/integrations");
  return { status: "success", message: "MSG91 SMS configuration saved." };
}

export async function testOrgMsg91SmsIntegrationAction(formData: FormData): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getOrgIntegrationContext("/organization/integrations");
  const authKey = String(formData.get("authKey") ?? "").trim();
  const flowId = String(formData.get("flowId") ?? "").trim();
  const senderId = String(formData.get("senderId") ?? "").trim();
  const testMobile = String(formData.get("testMobile") ?? "").trim();

  const validation = await validateMsg91SmsConfig({ authKey, flowId, senderId });
  if (!validation.valid || !testMobile) {
    return { status: "error", message: validation.errors[0] ?? "A test mobile number is required." };
  }

  const result = await testMsg91Sms({
    authKey,
    flowId,
    senderId,
    mobile: testMobile,
    variables: { VAR1: "Org MSG91 SMS integration test" },
  });

  const record = await upsertProviderIntegration({
    organizationId,
    provider: "msg91_sms",
    label: "MSG91 SMS",
    createdBy: userId,
    credentials: { authKey },
    config: { flowId, senderId, shortUrl: "0", testMobile },
    status: result.ok ? "connected" : "error",
    errorMessage: result.ok ? null : result.message,
    lastSyncAt: new Date().toISOString(),
  });

  await createIntegrationLog({
    integration_id: record.id,
    action: "msg91_sms.test",
    status: result.ok ? "success" : "error",
    request_data: { flowId, senderId, testMobile },
    response_data: (result.responseData ?? null) as Json,
    error_message: result.ok ? null : result.message,
  });

  revalidatePath("/organization/integrations");
  return {
    status: result.ok ? "success" : "error",
    message: result.ok ? "MSG91 SMS test sent successfully." : result.message,
  };
}

export async function saveOrgMsg91WhatsAppIntegrationAction(formData: FormData): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getOrgIntegrationContext("/organization/integrations");
  const authKey = String(formData.get("authKey") ?? "").trim();
  const integratedNumber = String(formData.get("integratedNumber") ?? "").trim();
  const namespace = String(formData.get("namespace") ?? "").trim();
  const templateName = String(formData.get("templateName") ?? "").trim();
  const languageCode = String(formData.get("languageCode") ?? "en").trim() || "en";
  const testMobile = String(formData.get("testMobile") ?? "").trim();

  const validation = await validateMsg91WhatsAppConfig({
    authKey, integratedNumber, namespace, templateName, languageCode,
  });

  if (!validation.valid) {
    return { status: "error", message: validation.errors[0] ?? "Invalid MSG91 WhatsApp configuration." };
  }

  await upsertProviderIntegration({
    organizationId,
    provider: "msg91_whatsapp",
    label: "MSG91 WhatsApp",
    createdBy: userId,
    credentials: { authKey },
    config: { integratedNumber, namespace, templateName, languageCode, testMobile },
    status: "disconnected",
    errorMessage: null,
  });

  await writeAuditLog({
    actorId: userId,
    action: "organization_owner.integration.msg91_whatsapp.saved",
    entityType: "integration",
    metadata: { provider: "msg91_whatsapp" },
  });

  revalidatePath("/organization/integrations");
  return { status: "success", message: "MSG91 WhatsApp configuration saved." };
}

export async function testOrgMsg91WhatsAppIntegrationAction(formData: FormData): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getOrgIntegrationContext("/organization/integrations");
  const authKey = String(formData.get("authKey") ?? "").trim();
  const integratedNumber = String(formData.get("integratedNumber") ?? "").trim();
  const namespace = String(formData.get("namespace") ?? "").trim();
  const templateName = String(formData.get("templateName") ?? "").trim();
  const languageCode = String(formData.get("languageCode") ?? "en").trim() || "en";
  const testMobile = String(formData.get("testMobile") ?? "").trim();

  const validation = await validateMsg91WhatsAppConfig({
    authKey, integratedNumber, namespace, templateName, languageCode,
  });

  if (!validation.valid || !testMobile) {
    return { status: "error", message: validation.errors[0] ?? "A WhatsApp test mobile number is required." };
  }

  const result = await testMsg91WhatsApp({
    authKey,
    integratedNumber,
    recipientNumber: testMobile,
    namespace,
    templateName,
    languageCode,
    bodyVariables: { body_1: "Org MSG91 WhatsApp integration test" },
  });

  const record = await upsertProviderIntegration({
    organizationId,
    provider: "msg91_whatsapp",
    label: "MSG91 WhatsApp",
    createdBy: userId,
    credentials: { authKey },
    config: { integratedNumber, namespace, templateName, languageCode, testMobile },
    status: result.ok ? "connected" : "error",
    errorMessage: result.ok ? null : result.message,
    lastSyncAt: new Date().toISOString(),
  });

  await createIntegrationLog({
    integration_id: record.id,
    action: "msg91_whatsapp.test",
    status: result.ok ? "success" : "error",
    request_data: { integratedNumber, namespace, templateName, languageCode, testMobile },
    response_data: (result.responseData ?? null) as Json,
    error_message: result.ok ? null : result.message,
  });

  revalidatePath("/organization/integrations");
  return {
    status: result.ok ? "success" : "error",
    message: result.ok ? "MSG91 WhatsApp test sent successfully." : result.message,
  };
}

export async function disconnectOrgProviderIntegrationAction(provider: IntegrationProviderId): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getOrgIntegrationContext("/organization/integrations");
  const integration = await getIntegrationByProvider(organizationId, provider);

  if (!integration) {
    return { status: "error", message: "Integration record not found." };
  }

  await disconnectIntegration(integration.id);
  await writeAuditLog({
    actorId: userId,
    action: "organization_owner.integration.disconnected",
    entityType: "integration",
    entityId: integration.id,
    metadata: { provider },
  });

  revalidatePath("/organization/integrations");
  return { status: "success", message: "Integration disconnected." };
}

export async function saveOrgCrmIntegrationAction(
  provider: CrmProviderId,
  formData: FormData,
): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getOrgIntegrationContext("/organization/integrations");
  const parsed = parseCrmFormData(provider, formData);
  if (!parsed.ok) {
    return { status: "error", message: parsed.message, fieldErrors: parsed.fieldErrors };
  }

  const record = await saveCrmIntegrationConnection({
    organizationId,
    createdBy: userId,
    provider,
    label: parsed.values.label,
    credentials: parsed.values.credentials,
    config: parsed.values.config,
  });

  await createIntegrationLog({
    integration_id: record.id,
    action: `crm.${provider}.saved`,
    status: "success",
    request_data: {
      provider,
      label: parsed.values.label,
      config: parsed.values.config,
      credentialsConfigured: true,
      webhookConfigured: provider === "hubspot"
        ? Boolean(parsed.values.credentials.clientSecret)
        : Boolean(parsed.values.credentials.webhookSecret),
    } as Json,
  });

  await writeAuditLog({
    actorId: userId,
    action: `organization_owner.integration.${provider}.saved`,
    entityType: "integration",
    entityId: record.id,
    metadata: { provider },
  });

  revalidatePath("/organization/integrations");
  return { status: "success", message: `${getCrmProviderLabel(provider)} configuration saved.` };
}

export async function testOrgCrmIntegrationAction(
  provider: CrmProviderId,
  formData: FormData,
): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getOrgIntegrationContext("/organization/integrations");
  const parsed = parseCrmFormData(provider, formData);
  if (!parsed.ok) {
    return { status: "error", message: parsed.message, fieldErrors: parsed.fieldErrors };
  }

  const saved = await saveCrmIntegrationConnection({
    organizationId,
    createdBy: userId,
    provider,
    label: parsed.values.label,
    credentials: parsed.values.credentials,
    config: parsed.values.config,
  });

  try {
    const result = await testCrmConnection(provider, saved);
    await upsertProviderIntegration({
      organizationId,
      provider,
      label: parsed.values.label ?? getCrmProviderLabel(provider),
      createdBy: userId,
      credentials: parsed.values.credentials,
      config: parsed.values.config,
      status: "connected",
      errorMessage: null,
      lastSyncAt: new Date().toISOString(),
    });
    await createIntegrationLog({
      integration_id: saved.id,
      action: `crm.${provider}.test`,
      status: "success",
      request_data: {
        provider,
        label: parsed.values.label,
        config: parsed.values.config,
        credentialsConfigured: true,
        webhookConfigured: provider === "hubspot"
          ? Boolean(parsed.values.credentials.clientSecret)
          : Boolean(parsed.values.credentials.webhookSecret),
      } as Json,
      response_data: (result.responseData ?? null) as Json,
    });
    revalidatePath("/organization/integrations");
    return { status: "success", message: `${getCrmProviderLabel(provider)} connection verified.` };
  } catch (err) {
    const message = err instanceof Error ? err.message : `${getCrmProviderLabel(provider)} test failed.`;
    await upsertProviderIntegration({
      organizationId,
      provider,
      label: parsed.values.label ?? getCrmProviderLabel(provider),
      createdBy: userId,
      credentials: parsed.values.credentials,
      config: parsed.values.config,
      status: "error",
      errorMessage: message,
    });
    await createIntegrationLog({
      integration_id: saved.id,
      action: `crm.${provider}.test`,
      status: "error",
      request_data: {
        provider,
        label: parsed.values.label,
        config: parsed.values.config,
        credentialsConfigured: true,
        webhookConfigured: provider === "hubspot"
          ? Boolean(parsed.values.credentials.clientSecret)
          : Boolean(parsed.values.credentials.webhookSecret),
      } as Json,
      error_message: message,
    });
    revalidatePath("/organization/integrations");
    return { status: "error", message };
  }
}

export async function retryOrgCrmSyncJobAction(jobId: string): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getOrgIntegrationContext("/organization/integrations");
  try {
    await retryCrmSyncJob({ organizationId, jobId });
    await writeAuditLog({
      actorId: userId,
      action: "organization_owner.integration.crm_job.retried",
      entityType: "integration",
      metadata: { jobId },
    });
    revalidatePath("/organization/integrations");
    return { status: "success", message: "CRM sync job queued for retry." };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to retry CRM sync job." };
  }
}

export async function backfillOrgCrmLeadsAction(limit = 10): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getOrgIntegrationContext("/organization/integrations");
  const leads = await getRecentCrmLeads(organizationId, Math.min(Math.max(limit, 1), 25));
  let queued = 0;
  for (const lead of leads) {
    const result = await enqueueCrmLeadSyncForOrganization({
      organizationId,
      leadId: lead.id,
      eventType: "lead.updated",
    });
    queued += result.queued;
  }

  await writeAuditLog({
    actorId: userId,
    action: "organization_owner.integration.crm_backfill",
    entityType: "integration",
    metadata: { leads: leads.length, queued },
  });

  revalidatePath("/organization/integrations");
  return { status: "success", message: `Queued ${queued} CRM sync job(s) from ${leads.length} lead(s).` };
}

export async function getOrgGoogleCalendarAuthUrlAction(): Promise<IntegrationActionResult & { authUrl?: string }> {
  const { organizationId, userId } = await getOrgIntegrationContext("/organization/integrations");

  const oauthStatus = getGoogleOAuthConfigurationStatus();
  if (!oauthStatus.configured) {
    return { status: "error", message: oauthStatus.message ?? "Google Calendar OAuth is not configured." };
  }

  return {
    status: "success",
    message: "Google OAuth opened in a new window.",
    authUrl: getGoogleCalendarAuthUrl({ organizationId, userId }),
  };
}

export async function saveOrgGoogleCalendarConfigAction(formData: FormData): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getOrgIntegrationContext("/organization/integrations");
  const calendarId = String(formData.get("calendarId") ?? "primary").trim() || "primary";
  const syncClasses = String(formData.get("syncClasses") ?? "true") === "true";
  const syncPtSessions = String(formData.get("syncPtSessions") ?? "false") === "true";

  const supabase = await getSupabaseDb();
  const existing = await getCalendarIntegrationRecord(organizationId);

  if (existing) {
    const { error } = await supabase
      .from("calendar_integrations")
      .update({
        calendar_id: calendarId,
        sync_classes: syncClasses,
        sync_pt_sessions: syncPtSessions,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) return { status: "error", message: error.message };
  } else {
    const { error } = await supabase
      .from("calendar_integrations")
      .insert({
        organization_id: organizationId,
        provider: "google",
        calendar_id: calendarId,
        sync_enabled: false,
        sync_classes: syncClasses,
        sync_pt_sessions: syncPtSessions,
        connected_by: userId,
      });

    if (error) return { status: "error", message: error.message };
  }

  await syncGoogleCalendarIntegrationRecord(organizationId, userId);
  revalidatePath("/organization/integrations");
  return { status: "success", message: "Google Calendar configuration saved." };
}

export async function disconnectOrgGoogleCalendarIntegrationAction(): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getOrgIntegrationContext("/organization/integrations");
  const supabase = await getSupabaseDb();
  const existing = await getCalendarIntegrationRecord(organizationId);

  if (!existing) {
    return { status: "error", message: "Google Calendar is not configured." };
  }

  const { error } = await supabase
    .from("calendar_integrations")
    .update({
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      sync_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (error) return { status: "error", message: error.message };

  const record = await syncGoogleCalendarIntegrationRecord(organizationId, userId);
  await createIntegrationLog({
    integration_id: record.id,
    action: "google_calendar.disconnect",
    status: "success",
  });

  revalidatePath("/organization/integrations");
  return { status: "success", message: "Google Calendar disconnected." };
}

export async function testOrgGoogleCalendarIntegrationAction(): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getOrgIntegrationContext("/organization/integrations");
  const calendarIntegration = await getCalendarIntegrationRecord(organizationId);

  if (!calendarIntegration) {
    return { status: "error", message: "Google Calendar is not configured." };
  }

  const record = await syncGoogleCalendarIntegrationRecord(organizationId, userId);
  try {
    await testGoogleCalendarConnection(calendarIntegration as CalendarIntegrationRow);
    await createIntegrationLog({
      integration_id: record.id,
      action: "google_calendar.test",
      status: "success",
      request_data: { calendarId: calendarIntegration.calendar_id ?? "primary" },
    });

    revalidatePath("/organization/integrations");
    return { status: "success", message: "Google Calendar connection verified." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google Calendar test failed.";
    await upsertProviderIntegration({
      organizationId,
      provider: "google_calendar",
      label: "Google Calendar",
      createdBy: userId,
      config: {
        calendarId: calendarIntegration.calendar_id ?? "primary",
        syncClasses: calendarIntegration.sync_classes ?? true,
        syncPtSessions: calendarIntegration.sync_pt_sessions ?? false,
      },
      status: "error",
      errorMessage: message,
    });
    await createIntegrationLog({
      integration_id: record.id,
      action: "google_calendar.test",
      status: "error",
      error_message: message,
    });
    revalidatePath("/organization/integrations");
    return { status: "error", message };
  }
}
