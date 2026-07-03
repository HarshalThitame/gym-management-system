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
  title: string;
  description: string;
  category: "payments" | "calendar" | "whatsapp" | "sms";
  status: IntegrationConnectionStatus;
  statusLabel: string;
  actionLabel: string;
  errorMessage: string | null;
  lastActivityAt: string | null;
  configSummary: Record<string, string | boolean | null>;
  latestLogMessage: string | null;
  latestLogStatus: string | null;
  latestLogAt: string | null;
  whoConnected: string | null;
};

export type IntegrationDashboardData = {
  organizationId: string;
  items: IntegrationDashboardItem[];
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

export async function getOrgIntegrationsAction(): Promise<IntegrationDashboardData> {
  const { organizationId, userId } = await getOrgIntegrationContext("/organization/integrations");
  const integrations = await getIntegrations(organizationId);
  const byProvider = new Map(integrations.map((row) => [row.provider, row] as const));

  const smsStatus = getMaskedIntegrationStatus(byProvider.get("msg91_sms") ?? null);
  const whatsappStatus = getMaskedIntegrationStatus(byProvider.get("msg91_whatsapp") ?? null);
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

  return {
    organizationId,
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
