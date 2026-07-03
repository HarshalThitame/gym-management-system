import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";

export type IntegrationRow = Database["public"]["Tables"]["integrations"]["Row"];
export type IntegrationInsert = Database["public"]["Tables"]["integrations"]["Insert"];
export type IntegrationUpdate = Database["public"]["Tables"]["integrations"]["Update"];
export type IntegrationLogRow = Database["public"]["Tables"]["integration_logs"]["Row"];
export type IntegrationLogInsert = Database["public"]["Tables"]["integration_logs"]["Insert"];

export type IntegrationProviderId =
  | "razorpay"
  | "google_calendar"
  | "msg91_sms"
  | "msg91_whatsapp";

export type IntegrationConnectionStatus = "connected" | "disconnected" | "error" | "expired";

export type Msg91SmsConfig = {
  authKey: string;
  flowId: string;
  senderId?: string;
  shortUrl?: "0" | "1";
  testMobile?: string;
};

export type Msg91WhatsAppConfig = {
  authKey: string;
  integratedNumber: string;
  namespace: string;
  templateName: string;
  languageCode?: string;
  testMobile?: string;
};

export type GoogleCalendarConfig = {
  calendarId?: string | null;
  syncClasses?: boolean;
  syncPtSessions?: boolean;
};

export type MaskedIntegrationStatus = {
  provider: IntegrationProviderId;
  record: IntegrationRow | null;
  status: IntegrationConnectionStatus;
  label: string;
  errorMessage: string | null;
  lastActivityAt: string | null;
  maskedConfig: Record<string, string | boolean | null>;
};

function getServerDb() {
  return createSupabaseServerClient();
}

function getAdminDb() {
  return createAdminClient();
}

function coerceObject(value: Json | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function maskSecret(value: string | null | undefined, visibleTail: number = 4) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= visibleTail) return "•".repeat(trimmed.length);
  return `${"•".repeat(Math.max(4, trimmed.length - visibleTail))}${trimmed.slice(-visibleTail)}`;
}

export async function getIntegrations(organizationId: string) {
  const supabase = await getServerDb();
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getIntegrationByProvider(
  organizationId: string,
  provider: IntegrationProviderId,
) {
  const supabase = await getServerDb();
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function connectIntegration(input: IntegrationInsert) {
  const adminDb = getAdminDb();
  const { data, error } = await adminDb
    .from("integrations")
    .upsert(input, {
      onConflict: "organization_id,provider",
      ignoreDuplicates: false,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function disconnectIntegration(id: string) {
  const adminDb = getAdminDb();
  const { error } = await adminDb.from("integrations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateIntegrationConfig(
  id: string,
  update: {
    config?: Record<string, unknown>;
    credentials?: Record<string, unknown>;
    status?: IntegrationConnectionStatus;
    errorMessage?: string | null;
    lastSyncAt?: string | null;
    label?: string;
  },
) {
  const adminDb = getAdminDb();
  const payload: IntegrationUpdate = {
    updated_at: new Date().toISOString(),
  };

  if (update.config) payload.config = update.config as Json;
  if (update.credentials) payload.credentials = update.credentials as Json;
  if (update.status) payload.status = update.status;
  if (update.errorMessage !== undefined) payload.error_message = update.errorMessage;
  if (update.lastSyncAt !== undefined) payload.last_sync_at = update.lastSyncAt;
  if (update.label !== undefined) payload.label = update.label;

  const { data, error } = await adminDb
    .from("integrations")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function upsertProviderIntegration(input: {
  organizationId: string;
  provider: IntegrationProviderId;
  label: string;
  createdBy: string;
  credentials?: Record<string, unknown>;
  config?: Record<string, unknown>;
  status?: IntegrationConnectionStatus;
  errorMessage?: string | null;
  lastSyncAt?: string | null;
}) {
  const existing = await getIntegrationByProvider(input.organizationId, input.provider);

  if (!existing) {
    return connectIntegration({
      organization_id: input.organizationId,
      provider: input.provider,
      label: input.label,
      created_by: input.createdBy,
      credentials: (input.credentials ?? {}) as Json,
      config: (input.config ?? {}) as Json,
      status: input.status ?? "disconnected",
      error_message: input.errorMessage ?? null,
      last_sync_at: input.lastSyncAt ?? null,
    });
  }

  return updateIntegrationConfig(existing.id, {
    credentials: input.credentials,
    config: input.config,
    status: input.status,
    errorMessage: input.errorMessage,
    lastSyncAt: input.lastSyncAt,
    label: input.label,
  });
}

export async function createIntegrationLog(input: IntegrationLogInsert) {
  const adminDb = getAdminDb();
  const { data, error } = await adminDb
    .from("integration_logs")
    .insert(input)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getIntegrationLogs(integrationId: string) {
  const supabase = await getServerDb();
  const { data, error } = await supabase
    .from("integration_logs")
    .select("*")
    .eq("integration_id", integrationId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getLatestIntegrationLog(integrationId: string) {
  const supabase = await getServerDb();
  const { data, error } = await supabase
    .from("integration_logs")
    .select("*")
    .eq("integration_id", integrationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export function getMaskedIntegrationStatus(record: IntegrationRow | null): MaskedIntegrationStatus | null {
  if (!record) return null;

  const credentials = coerceObject(record.credentials);
  const config = coerceObject(record.config);

  switch (record.provider as IntegrationProviderId) {
    case "msg91_sms":
      return {
        provider: "msg91_sms",
        record,
        status: record.status as IntegrationConnectionStatus,
        label: record.label ?? "MSG91 SMS",
        errorMessage: record.error_message,
        lastActivityAt: record.last_sync_at ?? record.updated_at,
        maskedConfig: {
          authKey: maskSecret(typeof credentials.authKey === "string" ? credentials.authKey : null),
          flowId: typeof config.flowId === "string" ? config.flowId : null,
          senderId: typeof config.senderId === "string" ? config.senderId : null,
          testMobile: typeof config.testMobile === "string" ? config.testMobile : null,
        },
      };
    case "msg91_whatsapp":
      return {
        provider: "msg91_whatsapp",
        record,
        status: record.status as IntegrationConnectionStatus,
        label: record.label ?? "MSG91 WhatsApp",
        errorMessage: record.error_message,
        lastActivityAt: record.last_sync_at ?? record.updated_at,
        maskedConfig: {
          authKey: maskSecret(typeof credentials.authKey === "string" ? credentials.authKey : null),
          integratedNumber: typeof config.integratedNumber === "string" ? config.integratedNumber : null,
          templateName: typeof config.templateName === "string" ? config.templateName : null,
          namespace: typeof config.namespace === "string" ? maskSecret(config.namespace, 6) : null,
          testMobile: typeof config.testMobile === "string" ? config.testMobile : null,
        },
      };
    case "razorpay":
      return {
        provider: "razorpay",
        record,
        status: record.status as IntegrationConnectionStatus,
        label: record.label ?? "Razorpay",
        errorMessage: record.error_message,
        lastActivityAt: record.last_sync_at ?? record.updated_at,
        maskedConfig: {
          keyId: maskSecret(typeof credentials.keyId === "string" ? credentials.keyId : null, 8),
          environment: typeof config.environment === "string" ? config.environment : null,
          webhookSecret: typeof credentials.webhookSecret === "string" ? "Configured" : null,
        },
      };
    case "google_calendar":
      return {
        provider: "google_calendar",
        record,
        status: record.status as IntegrationConnectionStatus,
        label: record.label ?? "Google Calendar",
        errorMessage: record.error_message,
        lastActivityAt: record.last_sync_at ?? record.updated_at,
        maskedConfig: {
          calendarId: typeof config.calendarId === "string" ? config.calendarId : null,
          syncClasses: typeof config.syncClasses === "boolean" ? config.syncClasses : null,
          syncPtSessions: typeof config.syncPtSessions === "boolean" ? config.syncPtSessions : null,
        },
      };
    default:
      return null;
  }
}
