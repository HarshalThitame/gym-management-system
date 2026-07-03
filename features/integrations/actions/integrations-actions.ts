"use server";

import { revalidatePath } from "next/cache";
import { requireGymAdminScope } from "@/features/admin/lib/access";
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
} from "../services/integrations-service";
import {
  getGoogleCalendarAuthUrl,
  type CalendarIntegrationRow,
  testGoogleCalendarConnection,
} from "../services/google-calendar-service";
import {
  testMsg91Sms,
  testMsg91WhatsApp,
  validateMsg91SmsConfig,
  validateMsg91WhatsAppConfig,
} from "../services/msg91-service";
import {
  getRazorpayHealthStatus,
  validateRazorpayEnvironmentConfig,
} from "@/features/billing/razorpay/razorpay-health";
import { getRazorpayConfig } from "@/features/billing/razorpay/razorpay-config";

export type IntegrationActionResult = {
  status: "success" | "error";
  message: string;
};

export type IntegrationDashboardItem = {
  provider: IntegrationProviderId;
  title: string;
  description: string;
  category: "payments" | "calendar" | "whatsapp" | "sms";
  managedBy: "admin_hub" | "env";
  status: IntegrationConnectionStatus;
  statusLabel: string;
  actionLabel: string;
  errorMessage: string | null;
  lastActivityAt: string | null;
  configSummary: Record<string, string | boolean | null>;
  latestLogMessage: string | null;
  latestLogStatus: string | null;
  latestLogAt: string | null;
  deepLink: string | null;
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

type IntegrationDb = Awaited<ReturnType<typeof createSupabaseServerClient>>;

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

async function getSupabaseDb(): Promise<IntegrationDb> {
  return createSupabaseServerClient();
}

async function getAdminIntegrationContext() {
  const scope = await requireGymAdminScope("/admin/integrations");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId || !scope.userId) {
    throw new Error("Admin integration context is incomplete.");
  }

  return {
    organizationId,
    userId: scope.userId,
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

async function syncRazorpayIntegrationRecord(organizationId: string, userId: string, status: IntegrationConnectionStatus, message: string | null) {
  return upsertProviderIntegration({
    organizationId,
    provider: "razorpay",
    label: "Razorpay",
    createdBy: userId,
    config: {
      environment: getRazorpayHealthStatus().environment,
    },
    status,
    errorMessage: message,
    lastSyncAt: new Date().toISOString(),
  });
}

async function buildLatestLog(integrationId: string | null) {
  if (!integrationId) {
    return {
      latestLogMessage: null,
      latestLogStatus: null,
      latestLogAt: null,
    };
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
  return {
    ...base,
    ...log,
  };
}

export async function getIntegrationsAction() {
  const { organizationId } = await getAdminIntegrationContext();
  return getIntegrations(organizationId);
}

export async function getIntegrationDashboardAction(): Promise<IntegrationDashboardData> {
  const { organizationId, userId } = await getAdminIntegrationContext();
  const integrations = await getIntegrations(organizationId);
  const byProvider = new Map(integrations.map((row) => [row.provider, row] as const));

  const smsStatus = getMaskedIntegrationStatus(byProvider.get("msg91_sms") ?? null);
  const whatsappStatus = getMaskedIntegrationStatus(byProvider.get("msg91_whatsapp") ?? null);
  const calendarMirror = await syncGoogleCalendarIntegrationRecord(organizationId, userId);
  const calendarStatus = getMaskedIntegrationStatus(calendarMirror);

  const razorpayHealth = getRazorpayHealthStatus();
  const razorpayValidation = validateRazorpayEnvironmentConfig();
  const razorpayStatusValue: IntegrationConnectionStatus = razorpayValidation.valid ? "connected" : "error";
  const razorpayRecord = await syncRazorpayIntegrationRecord(
    organizationId,
    userId,
    razorpayStatusValue,
    razorpayValidation.errors[0] ?? null,
  );
  const razorpayStatus = getMaskedIntegrationStatus(razorpayRecord);

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
        description: "Local payment gateway health and webhook readiness.",
        category: "payments",
        managedBy: "env",
        status: razorpayStatus?.status ?? "error",
        statusLabel: razorpayValidation.valid
          ? `Connected (${razorpayHealth.environment ?? "configured"})`
          : "Needs attention",
        actionLabel: "Validate",
        errorMessage: razorpayValidation.errors[0] ?? null,
        lastActivityAt: razorpayStatus?.lastActivityAt ?? null,
        configSummary: {
          environment: razorpayHealth.environment,
          publicKey: razorpayHealth.hasKeyId ? "Configured" : "Missing",
          webhookSecret: razorpayHealth.hasWebhookSecret,
        },
        deepLink: "/admin/payments",
      }, razorpayLog),
      toDashboardItem({
        provider: "google_calendar",
        title: "Google Calendar",
        description: "OAuth-based calendar sync for class scheduling.",
        category: "calendar",
        managedBy: "admin_hub",
        status: calendarStatus?.status ?? "disconnected",
        statusLabel: mapStatusLabel(calendarStatus?.status ?? "disconnected"),
        actionLabel: calendarStatus?.status === "connected" ? "Test calendar" : "Connect Google",
        errorMessage: calendarStatus?.errorMessage ?? null,
        lastActivityAt: calendarStatus?.lastActivityAt ?? null,
        configSummary: calendarStatus?.maskedConfig ?? {},
        deepLink: null,
      }, calendarLog),
      toDashboardItem({
        provider: "msg91_whatsapp",
        title: "MSG91 WhatsApp",
        description: "Template-based WhatsApp delivery using your approved MSG91 setup.",
        category: "whatsapp",
        managedBy: "admin_hub",
        status: whatsappStatus?.status ?? "disconnected",
        statusLabel: mapStatusLabel(whatsappStatus?.status ?? "disconnected"),
        actionLabel: "Save and test",
        errorMessage: whatsappStatus?.errorMessage ?? null,
        lastActivityAt: whatsappStatus?.lastActivityAt ?? null,
        configSummary: whatsappStatus?.maskedConfig ?? {},
        deepLink: "/admin/communications",
      }, whatsappLog),
      toDashboardItem({
        provider: "msg91_sms",
        title: "MSG91 SMS",
        description: "DLT/flow-based SMS delivery for campaigns and operational alerts.",
        category: "sms",
        managedBy: "admin_hub",
        status: smsStatus?.status ?? "disconnected",
        statusLabel: mapStatusLabel(smsStatus?.status ?? "disconnected"),
        actionLabel: "Save and test",
        errorMessage: smsStatus?.errorMessage ?? null,
        lastActivityAt: smsStatus?.lastActivityAt ?? null,
        configSummary: smsStatus?.maskedConfig ?? {},
        deepLink: "/admin/communications",
      }, smsLog),
    ],
  };
}

export async function saveMsg91SmsIntegrationAction(formData: FormData): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getAdminIntegrationContext();
  const authKey = String(formData.get("authKey") ?? "").trim();
  const flowId = String(formData.get("flowId") ?? "").trim();
  const senderId = String(formData.get("senderId") ?? "").trim();
  const testMobile = String(formData.get("testMobile") ?? "").trim();

  const validation = await validateMsg91SmsConfig({ authKey, flowId, senderId });
  if (!validation.valid) {
    return { status: "error", message: validation.errors[0] ?? "Invalid MSG91 SMS configuration." };
  }

  await upsertProviderIntegration({
    organizationId,
    provider: "msg91_sms",
    label: "MSG91 SMS",
    createdBy: userId,
    credentials: {
      authKey,
    },
    config: {
      flowId,
      senderId,
      shortUrl: "0",
      testMobile,
    },
    status: "disconnected",
    errorMessage: null,
  });

  await writeAuditLog({
    actorId: userId,
    action: "integration.msg91_sms.saved",
    entityType: "integration",
    metadata: { provider: "msg91_sms" },
  });

  revalidatePath("/admin/integrations");
  return { status: "success", message: "MSG91 SMS configuration saved." };
}

export async function testMsg91SmsIntegrationAction(formData: FormData): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getAdminIntegrationContext();
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
    variables: {
      VAR1: "Apex MSG91 SMS integration test",
    },
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

  revalidatePath("/admin/integrations");
  return {
    status: result.ok ? "success" : "error",
    message: result.ok ? "MSG91 SMS test sent successfully." : result.message,
  };
}

export async function saveMsg91WhatsAppIntegrationAction(formData: FormData): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getAdminIntegrationContext();
  const authKey = String(formData.get("authKey") ?? "").trim();
  const integratedNumber = String(formData.get("integratedNumber") ?? "").trim();
  const namespace = String(formData.get("namespace") ?? "").trim();
  const templateName = String(formData.get("templateName") ?? "").trim();
  const languageCode = String(formData.get("languageCode") ?? "en").trim() || "en";
  const testMobile = String(formData.get("testMobile") ?? "").trim();

  const validation = await validateMsg91WhatsAppConfig({
    authKey,
    integratedNumber,
    namespace,
    templateName,
    languageCode,
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
    config: {
      integratedNumber,
      namespace,
      templateName,
      languageCode,
      testMobile,
    },
    status: "disconnected",
    errorMessage: null,
  });

  await writeAuditLog({
    actorId: userId,
    action: "integration.msg91_whatsapp.saved",
    entityType: "integration",
    metadata: { provider: "msg91_whatsapp" },
  });

  revalidatePath("/admin/integrations");
  return { status: "success", message: "MSG91 WhatsApp configuration saved." };
}

export async function testMsg91WhatsAppIntegrationAction(formData: FormData): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getAdminIntegrationContext();
  const authKey = String(formData.get("authKey") ?? "").trim();
  const integratedNumber = String(formData.get("integratedNumber") ?? "").trim();
  const namespace = String(formData.get("namespace") ?? "").trim();
  const templateName = String(formData.get("templateName") ?? "").trim();
  const languageCode = String(formData.get("languageCode") ?? "en").trim() || "en";
  const testMobile = String(formData.get("testMobile") ?? "").trim();

  const validation = await validateMsg91WhatsAppConfig({
    authKey,
    integratedNumber,
    namespace,
    templateName,
    languageCode,
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
    bodyVariables: {
      body_1: "Apex MSG91 WhatsApp integration test",
    },
  });

  const record = await upsertProviderIntegration({
    organizationId,
    provider: "msg91_whatsapp",
    label: "MSG91 WhatsApp",
    createdBy: userId,
    credentials: { authKey },
    config: {
      integratedNumber,
      namespace,
      templateName,
      languageCode,
      testMobile,
    },
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

  revalidatePath("/admin/integrations");
  return {
    status: result.ok ? "success" : "error",
    message: result.ok ? "MSG91 WhatsApp test sent successfully." : result.message,
  };
}

export async function disconnectProviderIntegrationAction(provider: IntegrationProviderId): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getAdminIntegrationContext();
  const integration = await getIntegrationByProvider(organizationId, provider);

  if (!integration) {
    return { status: "error", message: "Integration record not found." };
  }

  await disconnectIntegration(integration.id);
  await writeAuditLog({
    actorId: userId,
    action: "integration.disconnected",
    entityType: "integration",
    entityId: integration.id,
    metadata: { provider },
  });

  revalidatePath("/admin/integrations");
  return { status: "success", message: "Integration disconnected." };
}

export async function getGoogleCalendarAuthUrlAction(): Promise<string> {
  const { organizationId, userId } = await getAdminIntegrationContext();
  return getGoogleCalendarAuthUrl({ organizationId, userId });
}

export async function saveGoogleCalendarConfigAction(formData: FormData): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getAdminIntegrationContext();
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

    if (error) {
      return { status: "error", message: error.message };
    }
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

    if (error) {
      return { status: "error", message: error.message };
    }
  }

  await syncGoogleCalendarIntegrationRecord(organizationId, userId);
  revalidatePath("/admin/integrations");
  return { status: "success", message: "Google Calendar configuration saved." };
}

export async function disconnectGoogleCalendarIntegrationAction(): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getAdminIntegrationContext();
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

  if (error) {
    return { status: "error", message: error.message };
  }

  const record = await syncGoogleCalendarIntegrationRecord(organizationId, userId);
  await createIntegrationLog({
    integration_id: record.id,
    action: "google_calendar.disconnect",
    status: "success",
  });

  revalidatePath("/admin/integrations");
  return { status: "success", message: "Google Calendar disconnected." };
}

export async function testGoogleCalendarIntegrationAction(): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getAdminIntegrationContext();
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
      request_data: {
        calendarId: calendarIntegration.calendar_id ?? "primary",
      },
    });

    revalidatePath("/admin/integrations");
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
    revalidatePath("/admin/integrations");
    return { status: "error", message };
  }
}

export async function testRazorpayIntegrationAction(): Promise<IntegrationActionResult> {
  const { organizationId, userId } = await getAdminIntegrationContext();

  try {
    const config = getRazorpayConfig();
    const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/payments?count=1", {
      headers: {
        authorization: `Basic ${auth}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Razorpay validation failed with status ${response.status}.`);
    }

    const record = await syncRazorpayIntegrationRecord(organizationId, userId, "connected", null);
    await createIntegrationLog({
      integration_id: record.id,
      action: "razorpay.test",
      status: "success",
    });
    revalidatePath("/admin/integrations");
    return { status: "success", message: "Razorpay credentials validated successfully." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Razorpay validation failed.";
    const record = await syncRazorpayIntegrationRecord(organizationId, userId, "error", message);
    await createIntegrationLog({
      integration_id: record.id,
      action: "razorpay.test",
      status: "error",
      error_message: message,
    });
    revalidatePath("/admin/integrations");
    return { status: "error", message };
  }
}
