import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import {
  createIntegrationLog,
  getIntegrationByProvider,
  getMaskedIntegrationStatus,
  updateIntegrationConfig,
  upsertProviderIntegration,
  type IntegrationRow,
} from "./integrations-service";

export type CrmProviderId = "hubspot" | "zoho_crm";
export type CrmEventType = "lead.created" | "lead.updated" | "lead.converted" | "lead.lost";
export type CrmEntityType = "crm_leads";

export type CrmLeadRow = Database["public"]["Tables"]["crm_leads"]["Row"] & {
  status?: Database["public"]["Tables"]["crm_lead_statuses"]["Row"] | null;
  source?: Database["public"]["Tables"]["crm_lead_sources"]["Row"] | null;
};

export type HubSpotCrmConfig = {
  accessToken: string;
  portalId?: string | null;
  syncLeads?: boolean;
  syncContacts?: boolean;
  testEmail?: string | null;
};

export type ZohoCrmConfig = {
  accessToken?: string | null;
  refreshToken?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  accountsDomain?: string | null;
  tokenExpiresAt?: string | null;
  syncLeads?: boolean;
  syncContacts?: boolean;
  testEmail?: string | null;
};

export type CrmFieldMappingConfig = {
  firstNameField: string;
  lastNameField: string;
  emailField: string;
  phoneField: string;
  notesField: string;
  sourceField: string;
  statusField: string;
};

export type CrmIntegrationFieldMappingSummary = {
  firstNameField: string;
  lastNameField: string;
  emailField: string;
  phoneField: string;
  notesField: string;
  sourceField: string;
  statusField: string;
};

type CrmIntegrationInput = {
  organizationId: string;
  createdBy: string;
};

type CrmSyncJobRow = {
  id: string;
  organization_id: string;
  integration_id: string;
  provider: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  idempotency_key: string;
  payload: Json;
  status: "pending" | "processing" | "succeeded" | "retry" | "dead_letter";
  attempts: number;
  max_attempts: number;
  run_after: string;
  external_id: string | null;
  response_data: Json | null;
  last_error: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

type CrmSyncMappingRow = {
  id: string;
  organization_id: string;
  integration_id: string;
  entity_type: string;
  entity_id: string;
  external_object_type: string;
  external_id: string;
  sync_status: "synced" | "pending" | "error" | "ignored";
  last_payload_hash: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type IntegrationDb = ReturnType<typeof createAdminClient>;

const HUBSPOT_API_BASE = "https://api.hubapi.com";
const DEFAULT_ZOHO_ACCOUNTS_DOMAIN = "accounts.zoho.com";
const DEFAULT_ZOHO_CRM_API_BASE = "https://www.zohoapis.com/crm/v8";

export function resolveZohoCrmApiBase(accountsDomain?: string | null) {
  const domain = stringifyText(accountsDomain, DEFAULT_ZOHO_ACCOUNTS_DOMAIN).toLowerCase();
  if (domain.includes("zoho.in")) return "https://www.zohoapis.in/crm/v8";
  if (domain.includes("zoho.eu")) return "https://www.zohoapis.eu/crm/v8";
  if (domain.includes("zoho.com.au")) return "https://www.zohoapis.com.au/crm/v8";
  if (domain.includes("zoho.jp")) return "https://www.zohoapis.jp/crm/v8";
  if (domain.includes("zoho.com.cn")) return "https://www.zohoapis.com.cn/crm/v8";
  return DEFAULT_ZOHO_CRM_API_BASE;
}

function db() {
  return createAdminClient() as IntegrationDb & {
    from: (table: string) => {
      select: (...args: unknown[]) => any;
      insert: (...args: unknown[]) => any;
      update: (...args: unknown[]) => any;
      upsert: (...args: unknown[]) => any;
      delete: (...args: unknown[]) => any;
    };
  };
}

function supabase() {
  return createSupabaseServerClient() as Promise<IntegrationDb & {
    from: (table: string) => {
      select: (...args: unknown[]) => any;
      insert: (...args: unknown[]) => any;
      update: (...args: unknown[]) => any;
      upsert: (...args: unknown[]) => any;
      delete: (...args: unknown[]) => any;
    };
  }>;
}

function coerceObject(value: Json | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
}

function stringifyText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function sanitizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizePhone(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function getLeadDisplayName(lead: CrmLeadRow) {
  const first = lead.first_name?.trim() ?? "";
  const last = lead.last_name?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  return full.length > 0 ? full : first || "Lead";
}

function getLeadSummary(lead: CrmLeadRow) {
  return {
    leadId: lead.id,
    name: getLeadDisplayName(lead),
    firstName: lead.first_name,
    lastName: lead.last_name,
    email: sanitizeEmail(lead.email),
    phone: sanitizePhone(lead.phone),
    notes: lead.notes ?? null,
    status: lead.status?.name ?? null,
    statusCode: lead.status?.code ?? null,
    source: lead.source?.name ?? null,
    sourceCode: lead.source?.code ?? null,
    referralSource: lead.referral_source ?? null,
    budgetRange: lead.budget_range ?? null,
    interestedIn: lead.interested_in ?? [],
    convertedAt: lead.converted_at ?? null,
    lostAt: lead.lost_at ?? null,
    followUpDate: lead.follow_up_date ?? null,
    updatedAt: lead.updated_at,
  };
}

export function getCrmProviderLabel(provider: CrmProviderId) {
  return provider === "hubspot" ? "HubSpot CRM" : "Zoho CRM";
}

export function getCrmProviderDescription(provider: CrmProviderId) {
  return provider === "hubspot"
    ? "Private-app contact sync for HubSpot contacts and pipeline visibility."
    : "OAuth-backed lead sync for Zoho CRM leads with refresh-token recovery.";
}

export function getCrmProviderCategory(provider: CrmProviderId): "crm" {
  void provider;
  return "crm";
}

export function getCrmProviderConfigSummary(provider: CrmProviderId, record: IntegrationRow | null) {
  if (!record) return {};
  const credentials = coerceObject(record.credentials);
  const config = coerceObject(record.config);

  if (provider === "hubspot") {
    return {
      accessToken: stringifyText(typeof credentials.accessToken === "string" ? maskToken(credentials.accessToken) : null),
      portalId: stringifyText(config.portalId),
      syncLeads: toBoolean(config.syncLeads, true),
      syncContacts: toBoolean(config.syncContacts, true),
      testEmail: stringifyText(config.testEmail),
      fieldMappings: getCrmFieldMappingSummary(provider, record),
    };
  }

  return {
    accessToken: stringifyText(typeof credentials.accessToken === "string" ? maskToken(credentials.accessToken) : null),
    refreshToken: stringifyText(typeof credentials.refreshToken === "string" ? maskToken(credentials.refreshToken, 6) : null),
    clientId: stringifyText(typeof credentials.clientId === "string" ? maskToken(credentials.clientId, 6) : null),
    accountsDomain: stringifyText(config.accountsDomain, DEFAULT_ZOHO_ACCOUNTS_DOMAIN),
    syncLeads: toBoolean(config.syncLeads, true),
    syncContacts: toBoolean(config.syncContacts, true),
    testEmail: stringifyText(config.testEmail),
    fieldMappings: getCrmFieldMappingSummary(provider, record),
  };
}

export function getCrmFieldMappingSummary(provider: CrmProviderId, record: IntegrationRow | null) {
  const mappings = getCrmFieldMappings(provider, record);
  return {
    firstNameField: mappings.firstNameField,
    lastNameField: mappings.lastNameField,
    emailField: mappings.emailField,
    phoneField: mappings.phoneField,
    notesField: mappings.notesField,
    sourceField: mappings.sourceField,
    statusField: mappings.statusField,
  };
}

export function getCrmFieldMappings(provider: CrmProviderId, record: IntegrationRow | null) {
  const config = record ? coerceObject(record.config) : {};
  const raw = coerceObject(config.fieldMappings as Json | null | undefined);
  if (provider === "hubspot") {
    return {
      firstNameField: stringifyText(raw.firstNameField, "firstname"),
      lastNameField: stringifyText(raw.lastNameField, "lastname"),
      emailField: stringifyText(raw.emailField, "email"),
      phoneField: stringifyText(raw.phoneField, "phone"),
      notesField: stringifyText(raw.notesField, "hs_lead_status"),
      sourceField: stringifyText(raw.sourceField, "lifecyclestage"),
      statusField: stringifyText(raw.statusField, "hs_lead_status"),
    };
  }

  return {
    firstNameField: stringifyText(raw.firstNameField, "First_Name"),
    lastNameField: stringifyText(raw.lastNameField, "Last_Name"),
    emailField: stringifyText(raw.emailField, "Email"),
    phoneField: stringifyText(raw.phoneField, "Phone"),
    notesField: stringifyText(raw.notesField, "Description"),
    sourceField: stringifyText(raw.sourceField, "Lead_Source"),
    statusField: stringifyText(raw.statusField, "Lead_Status"),
  };
}

export function maskToken(value: string | null | undefined, visibleTail = 4) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= visibleTail) return "•".repeat(trimmed.length);
  return `${"•".repeat(Math.max(4, trimmed.length - visibleTail))}${trimmed.slice(-visibleTail)}`;
}

export async function saveCrmIntegrationConnection(input: CrmIntegrationInput & {
  provider: CrmProviderId;
  label?: string;
  credentials: Record<string, unknown>;
  config: Record<string, unknown>;
}) {
  const label = input.label?.trim() || getCrmProviderLabel(input.provider);
  return upsertProviderIntegration({
    organizationId: input.organizationId,
    provider: input.provider,
    label,
    createdBy: input.createdBy,
    credentials: input.credentials,
    config: input.config,
    status: "disconnected",
    errorMessage: null,
  });
}

export async function disconnectCrmIntegration(organizationId: string, provider: CrmProviderId) {
  const integration = await getIntegrationByProvider(organizationId, provider);
  if (!integration) {
    return null;
  }
  await db().from("integrations").delete().eq("id", integration.id);
  return integration;
}

export async function getCrmIntegrationByProvider(organizationId: string, provider: CrmProviderId) {
  return getIntegrationByProvider(organizationId, provider);
}

export async function listCrmIntegrations(organizationId: string) {
  const [hubspot, zoho] = await Promise.all([
    getIntegrationByProvider(organizationId, "hubspot"),
    getIntegrationByProvider(organizationId, "zoho_crm"),
  ]);

  return [hubspot, zoho].filter(Boolean) as IntegrationRow[];
}

export async function testCrmConnection(provider: CrmProviderId, record: IntegrationRow) {
  if (provider === "hubspot") {
    return testHubSpotConnection(record);
  }
  return testZohoConnection(record);
}

async function testHubSpotConnection(record: IntegrationRow) {
  const credentials = coerceObject(record.credentials);
  const accessToken = stringifyText(credentials.accessToken);
  if (!accessToken) {
    throw new Error("HubSpot access token is missing.");
  }

  const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts?limit=1`, {
    method: "GET",
    headers: hubSpotHeaders(accessToken),
    cache: "no-store",
  });

  const responseData = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractHubSpotError(responseData, "Failed to verify HubSpot connection."));
  }

  return {
    ok: true,
    status: response.status,
    message: "HubSpot connection verified.",
    responseData,
  };
}

async function testZohoConnection(record: IntegrationRow) {
  const accessToken = await resolveZohoAccessToken(record);
  const accountsDomain = stringifyText(coerceObject(record.config).accountsDomain, DEFAULT_ZOHO_ACCOUNTS_DOMAIN);
  const response = await fetch(`${resolveZohoCrmApiBase(accountsDomain)}/settings/modules`, {
    method: "GET",
    headers: zohoHeaders(accessToken),
    cache: "no-store",
  });

  const responseData = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractZohoError(responseData, "Failed to verify Zoho CRM connection."));
  }

  return {
    ok: true,
    status: response.status,
    message: "Zoho CRM connection verified.",
    responseData,
  };
}

export async function enqueueCrmLeadSyncForOrganization(input: {
  organizationId: string;
  leadId: string;
  eventType: CrmEventType;
}) {
  const integrations = await listCrmIntegrations(input.organizationId);
  const active = integrations.filter((integration) => {
    const config = coerceObject(integration.config);
    const syncLeadsEnabled = config.syncLeads !== false;
    return syncLeadsEnabled && (integration.status === "connected" || integration.status === "expired");
  });
  if (!active.length) {
    return { queued: 0 };
  }

  const lead = await loadCrmLead(input.leadId, input.organizationId);
  if (!lead) {
    return { queued: 0 };
  }

  const payload = getLeadSummary(lead);
  const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const admin = db();

  for (const integration of active) {
    await admin
      .from("crm_sync_jobs")
      .upsert({
        organization_id: input.organizationId,
        integration_id: integration.id,
        provider: integration.provider,
        entity_type: "crm_leads",
        entity_id: input.leadId,
        event_type: input.eventType,
        idempotency_key: `${input.eventType}:${input.leadId}:${lead.updated_at}`,
        payload: {
          lead: payload,
          payloadHash,
        },
        status: "pending",
        attempts: 0,
        max_attempts: 6,
        run_after: new Date().toISOString(),
      } as never, {
        onConflict: "integration_id,idempotency_key",
        ignoreDuplicates: false,
      });
  }

  return { queued: active.length };
}

export async function processPendingCrmSyncJobs(limit = 25) {
  const admin = db();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("crm_sync_jobs")
    .select("*")
    .in("status", ["pending", "retry"])
    .lte("run_after", now)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const jobs = (data ?? []) as CrmSyncJobRow[];
  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    deadLettered: 0,
  };

  for (const job of jobs) {
    results.processed += 1;
    const claimed = await admin
      .from("crm_sync_jobs")
      .update({ status: "processing", attempts: (job.attempts ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", job.id)
      .in("status", ["pending", "retry"])
      .select("*")
      .maybeSingle();

    if (claimed.error || !claimed.data) {
      continue;
    }

    try {
      const integration = await loadIntegrationById(claimed.data.integration_id);
      if (!integration) {
        throw new Error("Integration record not found.");
      }

      const lead = await loadCrmLead(claimed.data.entity_id, claimed.data.organization_id);
      if (!lead) {
        throw new Error("Lead record not found.");
      }

      const result = integration.provider === "hubspot"
        ? await syncLeadToHubSpot(integration, lead)
        : await syncLeadToZoho(integration, lead);

      await upsertCrmSyncMapping({
        organizationId: claimed.data.organization_id,
        integrationId: integration.id,
        entityType: claimed.data.entity_type,
        entityId: claimed.data.entity_id,
        externalObjectType: result.externalObjectType,
        externalId: result.externalId,
        payloadHash: claimed.data.payload && typeof claimed.data.payload === "object"
          ? (claimed.data.payload as Record<string, unknown>).payloadHash as string | undefined
          : undefined,
        errorMessage: null,
        syncStatus: "synced",
      });

      await admin
        .from("crm_sync_jobs")
        .update({
          status: "succeeded",
          external_id: result.externalId,
          response_data: result.responseData as Json,
          last_error: null,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", claimed.data.id);

      await updateIntegrationConfig(integration.id, {
        status: "connected",
        lastSyncAt: new Date().toISOString(),
        errorMessage: null,
      });

      await createIntegrationLog({
        integration_id: integration.id,
        action: `crm.${integration.provider}.${claimed.data.event_type}`,
        status: "success",
        request_data: claimed.data.payload,
        response_data: result.responseData as Json,
        error_message: null,
      });

      results.succeeded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "CRM sync failed.";
      const attempts = claimed.data.attempts ?? 0;
      const maxAttempts = claimed.data.max_attempts ?? 6;
      const shouldDeadLetter = attempts >= maxAttempts;
      const delayMinutes = Math.min(60, Math.max(2, 2 ** Math.max(0, attempts - 1)));

      await admin
        .from("crm_sync_jobs")
        .update({
          status: shouldDeadLetter ? "dead_letter" : "retry",
          attempts,
          last_error: message,
          run_after: shouldDeadLetter ? new Date().toISOString() : new Date(Date.now() + delayMinutes * 60_000).toISOString(),
          processed_at: shouldDeadLetter ? new Date().toISOString() : claimed.data.processed_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", claimed.data.id);

      await createIntegrationLog({
        integration_id: claimed.data.integration_id,
        action: `crm.${claimed.data.provider}.${claimed.data.event_type}`,
        status: shouldDeadLetter ? "error" : "pending",
        request_data: claimed.data.payload,
        response_data: null,
        error_message: message,
      });

      if (shouldDeadLetter) {
        results.deadLettered += 1;
      } else {
        results.failed += 1;
      }
    }
  }

  return results;
}

export async function retryCrmSyncJob(input: { organizationId: string; jobId: string }) {
  const admin = db();
  const { data, error } = await admin
    .from("crm_sync_jobs")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("id", input.jobId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("CRM sync job not found.");

  const job = data as CrmSyncJobRow;
  const { error: updateError } = await admin
    .from("crm_sync_jobs")
    .update({
      status: "retry",
      last_error: null,
      run_after: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("organization_id", input.organizationId);

  if (updateError) throw new Error(updateError.message);
  return job;
}

export async function upsertCrmSyncMapping(input: {
  organizationId: string;
  integrationId: string;
  entityType: string;
  entityId: string;
  externalObjectType: string;
  externalId: string;
  syncStatus: "synced" | "pending" | "error" | "ignored";
  payloadHash?: string;
  errorMessage?: string | null;
}) {
  const admin = db();
  const payload = {
    organization_id: input.organizationId,
    integration_id: input.integrationId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    external_object_type: input.externalObjectType,
    external_id: input.externalId,
    sync_status: input.syncStatus,
    last_payload_hash: input.payloadHash ?? null,
    last_synced_at: input.syncStatus === "synced" ? new Date().toISOString() : null,
    last_error: input.errorMessage ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("crm_sync_mappings")
    .upsert(payload as never, {
      onConflict: "integration_id,entity_type,entity_id",
      ignoreDuplicates: false,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CrmSyncMappingRow;
}

export async function getCrmSyncJobs(organizationId: string, limit = 25) {
  const admin = db();
  const { data, error } = await admin
    .from("crm_sync_jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as CrmSyncJobRow[];
}

export async function getCrmSyncMappings(organizationId: string, leadId?: string) {
  const admin = db();
  let query = admin.from("crm_sync_mappings").select("*").eq("organization_id", organizationId);
  if (leadId) {
    query = query.eq("entity_id", leadId);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CrmSyncMappingRow[];
}

export async function getRecentCrmLeads(organizationId: string, limit = 10) {
  const supabaseClient = await supabase();
  const { data, error } = await supabaseClient
    .from("crm_leads")
    .select(`
      *,
      status:crm_lead_statuses(*),
      source:crm_lead_sources(*)
    `)
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as CrmLeadRow[];
}

export async function getCrmWebhookEvents(organizationId: string, integrationId: string, limit = 25) {
  const admin = db();
  const { data, error } = await admin
    .from("crm_webhook_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("integration_id", integrationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string;
    provider: CrmProviderId;
    event_id: string;
    external_object_type: string;
    external_object_id: string;
    event_type: string;
    status: "received" | "processed" | "ignored" | "duplicate" | "failed";
    error_message: string | null;
    created_at: string;
    processed_at: string | null;
  }>;
}

export function buildCrmSyncHealthSummary(integration: IntegrationRow | null) {
  const masked = getMaskedIntegrationStatus(integration);
  if (!masked) {
    return null;
  }

  return {
    provider: masked.provider,
    status: masked.status,
    label: masked.label,
    errorMessage: masked.errorMessage,
    lastActivityAt: masked.lastActivityAt,
    maskedConfig: masked.maskedConfig,
  };
}

async function loadIntegrationById(integrationId: string) {
  const admin = db();
  const { data, error } = await admin
    .from("integrations")
    .select("*")
    .eq("id", integrationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as IntegrationRow | null;
}

async function loadCrmLead(leadId: string, organizationId: string) {
  const supabaseClient = await supabase();
  const { data, error } = await supabaseClient
    .from("crm_leads")
    .select(`
      *,
      status:crm_lead_statuses(*),
      source:crm_lead_sources(*)
    `)
    .eq("id", leadId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as CrmLeadRow | null;
}

async function syncLeadToHubSpot(integration: IntegrationRow, lead: CrmLeadRow) {
  const credentials = coerceObject(integration.credentials);
  const accessToken = stringifyText(credentials.accessToken);
  if (!accessToken) {
    throw new Error("HubSpot access token is missing.");
  }

  const properties = buildHubSpotContactProperties(lead, integration);
  const existing = await findHubSpotContact(accessToken, lead);

  if (existing?.id) {
    const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${existing.id}`, {
      method: "PATCH",
      headers: hubSpotHeaders(accessToken),
      body: JSON.stringify({ properties }),
      cache: "no-store",
    });

    const responseData = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(extractHubSpotError(responseData, "Failed to update HubSpot contact."));
    }

    return {
      externalObjectType: "contacts",
      externalId: existing.id,
      responseData,
    };
  }

  const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts`, {
    method: "POST",
    headers: hubSpotHeaders(accessToken),
    body: JSON.stringify({ properties }),
    cache: "no-store",
  });
  const responseData = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractHubSpotError(responseData, "Failed to create HubSpot contact."));
  }

  const externalId = typeof responseData?.id === "string" ? responseData.id : null;
  if (!externalId) {
    throw new Error("HubSpot did not return a contact ID.");
  }

  return {
    externalObjectType: "contacts",
    externalId,
    responseData,
  };
}

async function syncLeadToZoho(integration: IntegrationRow, lead: CrmLeadRow) {
  const accessToken = await resolveZohoAccessToken(integration);
  const config = coerceObject(integration.config);
  const apiBase = resolveZohoCrmApiBase(config.accountsDomain);
  const moduleName = "Leads";
  const payload = buildZohoLeadPayload(lead, config, integration);
  const externalId = await findZohoLeadId(accessToken, lead);

  if (externalId) {
    const response = await fetch(`${apiBase}/${moduleName}/${externalId}`, {
      method: "PUT",
      headers: zohoHeaders(accessToken),
      body: JSON.stringify({ data: [payload] }),
      cache: "no-store",
    });

    const responseData = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(extractZohoError(responseData, "Failed to update Zoho CRM lead."));
    }

    return {
      externalObjectType: moduleName,
      externalId,
      responseData,
    };
  }

  const response = await fetch(`${apiBase}/${moduleName}`, {
    method: "POST",
    headers: zohoHeaders(accessToken),
    body: JSON.stringify({ data: [payload] }),
    cache: "no-store",
  });

  const responseData = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractZohoError(responseData, "Failed to create Zoho CRM lead."));
  }

  const createdId = extractZohoRecordId(responseData);
  if (!createdId) {
    throw new Error("Zoho CRM did not return a lead ID.");
  }

  return {
    externalObjectType: moduleName,
    externalId: createdId,
    responseData,
  };
}

function buildHubSpotContactProperties(lead: CrmLeadRow, integration: IntegrationRow) {
  const mappings = getCrmFieldMappings("hubspot", integration);
  const props: Record<string, string> = {
    [mappings.firstNameField]: lead.first_name,
    [mappings.lastNameField]: lead.last_name?.trim() || lead.first_name,
  };

  if (lead.email) props[mappings.emailField] = lead.email;
  if (lead.phone) props[mappings.phoneField] = lead.phone;
  if (lead.notes) props[mappings.notesField] = lead.notes;
  if (lead.source?.name || lead.referral_source) props[mappings.sourceField] = lead.source?.name ?? lead.referral_source ?? "";
  if (lead.converted_at) props[mappings.statusField] = "customer";
  else if (lead.lost_at) props[mappings.statusField] = "lost";
  else props[mappings.statusField] = "lead";

  return props;
}

function buildZohoLeadPayload(lead: CrmLeadRow, config: Record<string, unknown>, integration: IntegrationRow) {
  const mappings = getCrmFieldMappings("zoho_crm", integration);
  const lastName = lead.last_name?.trim() || lead.first_name || "Lead";
  const payload: Record<string, unknown> = {
    [mappings.firstNameField]: lead.first_name,
    [mappings.lastNameField]: lastName,
  };

  if (lead.email) payload[mappings.emailField] = lead.email;
  if (lead.phone) payload[mappings.phoneField] = lead.phone;
  if (lead.notes) payload[mappings.notesField] = lead.notes;
  if (lead.source?.name) payload[mappings.sourceField] = lead.source.name;
  if (lead.status?.name) payload[mappings.statusField] = lead.status.name;
  if (lead.converted_at) payload[mappings.statusField] = "Converted";
  if (lead.lost_at) payload[mappings.statusField] = "Lost";

  const custom = coerceObject(config.fieldMappings as Json | null | undefined);
  if (typeof custom.defaultLifecycleState === "string" && !payload[mappings.statusField]) {
    payload[mappings.statusField] = custom.defaultLifecycleState;
  }

  return payload;
}

function hubSpotHeaders(accessToken: string) {
  return {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
  };
}

function zohoHeaders(accessToken: string) {
  return {
    authorization: `Zoho-oauthtoken ${accessToken}`,
    "content-type": "application/json",
    accept: "application/json",
  };
}

async function findHubSpotContact(accessToken: string, lead: CrmLeadRow) {
  if (lead.email) {
    const response = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${encodeURIComponent(lead.email)}?idProperty=email`, {
      method: "GET",
      headers: hubSpotHeaders(accessToken),
      cache: "no-store",
    });

    if (response.ok) {
      return await response.json().catch(() => null) as { id?: string } | null;
    }
  }

  return null;
}

async function findZohoLeadId(accessToken: string, lead: CrmLeadRow) {
  const criteria = lead.email
    ? `(Email:equals:${escapeZohoCriteria(lead.email)})`
    : lead.phone
      ? `(Phone:equals:${escapeZohoCriteria(lead.phone)})`
      : null;

  if (!criteria) {
    return null;
  }

  const response = await fetch(`${DEFAULT_ZOHO_CRM_API_BASE}/Leads/search?criteria=${encodeURIComponent(criteria)}`, {
    method: "GET",
    headers: zohoHeaders(accessToken),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const responseData = await response.json().catch(() => null) as { data?: Array<{ id?: string }> } | null;
  return responseData?.data?.[0]?.id ?? null;
}

async function resolveZohoAccessToken(integration: IntegrationRow) {
  const credentials = coerceObject(integration.credentials);
  const config = coerceObject(integration.config);
  const accessToken = stringifyText(credentials.accessToken);
  const tokenExpiresAt = stringifyText(config.tokenExpiresAt);

  if (accessToken && (!tokenExpiresAt || new Date(tokenExpiresAt).getTime() - Date.now() > 5 * 60_000)) {
    return accessToken;
  }

  const refreshToken = stringifyText(credentials.refreshToken);
  const clientId = stringifyText(credentials.clientId);
  const clientSecret = stringifyText(credentials.clientSecret);

  if (!refreshToken || !clientId || !clientSecret) {
    if (accessToken) {
      return accessToken;
    }
    throw new Error("Zoho access token is missing.");
  }

  const accountsDomain = stringifyText(config.accountsDomain, DEFAULT_ZOHO_ACCOUNTS_DOMAIN);
  const response = await fetch(`https://${accountsDomain}/oauth/v2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });

  const responseData = await response.json().catch(() => null) as { access_token?: string; expires_in?: number; error?: string; error_description?: string } | null;
  if (!response.ok || !responseData?.access_token) {
    throw new Error(responseData?.error_description || responseData?.error || "Failed to refresh Zoho access token.");
  }

  const expiresIn = Number(responseData.expires_in ?? 3600);
  await updateIntegrationConfig(integration.id, {
    credentials: {
      ...credentials,
      accessToken: responseData.access_token,
    },
    config: {
      ...config,
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    },
    status: "connected",
    errorMessage: null,
    lastSyncAt: new Date().toISOString(),
  });

  return responseData.access_token;
}

function extractHubSpotError(responseData: unknown, fallback: string) {
  const record = responseData && typeof responseData === "object" ? responseData as Record<string, unknown> : null;
  if (record?.message && typeof record.message === "string") {
    return record.message;
  }
  if (record?.error && typeof record.error === "string") {
    return record.error;
  }
  return fallback;
}

function extractZohoError(responseData: unknown, fallback: string) {
  const record = responseData && typeof responseData === "object" ? responseData as Record<string, unknown> : null;
  const candidates = [
    record?.message,
    record?.error,
    record?.details,
  ];
  const message = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  return typeof message === "string" ? message : fallback;
}

function extractZohoRecordId(responseData: unknown) {
  if (!responseData || typeof responseData !== "object") return null;
  const record = responseData as Record<string, unknown>;
  const data = record.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  if (!first || typeof first !== "object") return null;
  const nested = first as Record<string, unknown>;
  const details = nested.details;
  if (details && typeof details === "object") {
    const detailsRecord = details as Record<string, unknown>;
    if (typeof detailsRecord.id === "string") return detailsRecord.id;
  }
  if (typeof nested.id === "string") return nested.id;
  return null;
}

function escapeZohoCriteria(value: string) {
  return value.replace(/[\\()[\]{}]/g, "\\$&");
}
