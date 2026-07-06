import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import {
  createIntegrationLog,
  updateIntegrationConfig,
  type IntegrationRow,
} from "./integrations-service";
import {
  type CrmEventType,
  type CrmLeadRow,
  type CrmProviderId,
  getCrmProviderLabel,
  resolveZohoCrmApiBase,
  upsertCrmSyncMapping,
} from "./crm-sync-service";

type CrmWebhookEventRow = {
  id: string;
  organization_id: string;
  integration_id: string;
  provider: CrmProviderId;
  event_id: string;
  external_object_type: string;
  external_object_id: string;
  event_type: string;
  payload: Json;
  status: "received" | "processed" | "ignored" | "duplicate" | "failed";
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type HubSpotWebhookEvent = {
  eventId?: number | string;
  portalId?: number | string;
  subscriptionType?: string;
  objectId?: number | string;
  occurredAt?: number;
  changeFlag?: string;
  changeSource?: string;
  propertyName?: string;
  propertyValue?: string;
  appId?: number | string;
};

type ZohoWebhookPayload = Record<string, unknown> & {
  id?: string | number;
  action?: string;
  operation?: string;
  module?: string;
  data?: Array<Record<string, unknown>>;
  record?: Record<string, unknown>;
};

type ExternalContactSnapshot = {
  externalObjectId: string;
  externalObjectType: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  sourceCode: string | null;
  statusCode: string | null;
  lifecycleState: string | null;
  isConverted: boolean;
  isLost: boolean;
  metadata: Record<string, unknown>;
};

type CrmWebhookResult = {
  provider: CrmProviderId;
  integrationId: string;
  totalEvents: number;
  processed: number;
  ignored: number;
  duplicates: number;
  failed: number;
};

function adminDb() {
  return createAdminClient() as unknown as {
    from: (table: string) => {
      select: (...args: unknown[]) => any;
      insert: (...args: unknown[]) => any;
      update: (...args: unknown[]) => any;
      delete: (...args: unknown[]) => any;
    };
  };
}

function coerceObject(value: Json | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringifyText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function jsonToArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return [value as Record<string, unknown>];
  }
  return [];
}

function maskEventId(value: string) {
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
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

function toLowerCaseText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getIntegrationCredentialValue(integration: IntegrationRow, key: string) {
  const credentials = coerceObject(integration.credentials);
  const config = coerceObject(integration.config);
  const credentialValue = stringifyText(credentials[key]);
  if (credentialValue) return credentialValue;
  return stringifyText(config[key]);
}

async function loadIntegrationById(integrationId: string) {
  const db = adminDb();
  const { data, error } = await db
    .from("integrations")
    .select("*")
    .eq("id", integrationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as IntegrationRow | null;
}

function getWebhookSecretHeader(request: Request) {
  return request.headers.get("x-crm-webhook-secret")
    ?? request.headers.get("x-zoho-webhook-secret")
    ?? request.headers.get("x-webhook-secret");
}

function normalizeHubSpotRequestUri(request: Request) {
  const url = new URL(request.url);
  const decodedPath = url.pathname
    .replace(/%3A/gi, ":")
    .replace(/%2F/gi, "/")
    .replace(/%3F/gi, "?")
    .replace(/%40/gi, "@")
    .replace(/%21/gi, "!")
    .replace(/%24/gi, "$")
    .replace(/%27/gi, "'")
    .replace(/%28/gi, "(")
    .replace(/%29/gi, ")")
    .replace(/%2A/gi, "*")
    .replace(/%2C/gi, ",")
    .replace(/%3B/gi, ";");
  return `${decodedPath}${url.search}`;
}

function verifyHubSpotSignatureV3(request: Request, rawBody: string, clientSecret: string) {
  const timestamp = request.headers.get("x-hubspot-request-timestamp");
  const signature = request.headers.get("x-hubspot-signature-v3");
  if (!timestamp || !signature) {
    return { ok: false, reason: "Missing HubSpot v3 signature headers." };
  }

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60_000) {
    return { ok: false, reason: "HubSpot request timestamp is stale." };
  }

  const source = `${request.method}${normalizeHubSpotRequestUri(request)}${rawBody}${timestamp}`;
  const expected = createHmac("sha256", clientSecret).update(source).digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return { ok: false, reason: "Invalid HubSpot v3 signature." };
  }

  return { ok: true as const };
}

function verifyHubSpotSignatureV1(rawBody: string, clientSecret: string, signature: string | null) {
  if (!signature) {
    return { ok: false, reason: "Missing HubSpot signature." };
  }

  const expected = sha256Hex(`${clientSecret}${rawBody}`);
  if (expected !== signature) {
    return { ok: false, reason: "Invalid HubSpot signature." };
  }

  return { ok: true as const };
}

function verifyZohoSignature(request: Request, integration: IntegrationRow) {
  const configuredSecret = getIntegrationCredentialValue(integration, "webhookSecret");
  if (!configuredSecret) {
    return { ok: false, reason: "Zoho webhook secret is not configured." };
  }

  const received = getWebhookSecretHeader(request);
  if (!received) {
    return { ok: false, reason: "Missing Zoho webhook secret header." };
  }

  const expected = Buffer.from(configuredSecret);
  const actual = Buffer.from(received);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: "Invalid Zoho webhook secret." };
  }

  return { ok: true as const };
}

function normalizeHubSpotEvent(event: HubSpotWebhookEvent, rawBody: Record<string, unknown>): { eventId: string; eventType: CrmEventType; externalObjectId: string; payload: Record<string, unknown> } | null {
  const objectId = stringifyText(event.objectId);
  if (!objectId) return null;

  const subscriptionType = stringifyText(event.subscriptionType).toLowerCase();
  let eventType: CrmEventType = "lead.updated";
  if (subscriptionType.includes("creation")) eventType = "lead.created";
  else if (subscriptionType.includes("deletion") || subscriptionType.includes("privacydeletion")) eventType = "lead.lost";
  else if (subscriptionType.includes("propertychange")) eventType = "lead.updated";

  const eventId = stringifyText(event.eventId) || `${subscriptionType}:${objectId}:${stringifyText(event.occurredAt) || sha256Hex(JSON.stringify(rawBody)).slice(0, 16)}`;

  return {
    eventId,
    eventType,
    externalObjectId: objectId,
    payload: {
      ...rawBody,
      normalized: true,
    },
  };
}

function extractZohoRecord(payload: ZohoWebhookPayload) {
  const candidates = [
    ...(Array.isArray(payload.data) ? payload.data : []),
    payload.record,
    payload,
  ].filter(Boolean) as Record<string, unknown>[];
  return candidates[0] ?? null;
}

function normalizeZohoEvent(payload: ZohoWebhookPayload): { eventId: string; eventType: CrmEventType; externalObjectId: string; payload: Record<string, unknown> } | null {
  const record = extractZohoRecord(payload);
  if (!record) return null;

  const objectId = stringifyText(record.id ?? payload.id);
  if (!objectId) return null;

  const action = toLowerCaseText(payload.action || payload.operation || record.action || record.operation);
  let eventType: CrmEventType = "lead.updated";
  if (action.includes("create")) eventType = "lead.created";
  else if (action.includes("delete")) eventType = "lead.lost";

  const eventId = stringifyText(payload.id ?? record.id) || `${action || eventType}:${objectId}:${sha256Hex(JSON.stringify(payload)).slice(0, 16)}`;

  return {
    eventId,
    eventType,
    externalObjectId: objectId,
    payload: {
      ...payload,
      normalized: true,
    },
  };
}

async function fetchHubSpotContactSnapshot(integration: IntegrationRow, externalObjectId: string, rawPayload: Record<string, unknown>): Promise<ExternalContactSnapshot> {
  const accessToken = getIntegrationCredentialValue(integration, "accessToken");
  if (!accessToken) {
    throw new Error("HubSpot access token is missing.");
  }

  const response = await fetch(
    `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(externalObjectId)}?properties=firstname,lastname,email,phone,lifecyclestage,hs_lead_status`,
    {
      method: "GET",
      headers: hubSpotHeaders(accessToken),
      cache: "no-store",
    },
  );

  const responseData = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new Error(`HubSpot contact fetch failed: ${extractMessage(responseData, "Unknown error")}`);
  }

  const properties = responseData && typeof responseData === "object" ? (responseData.properties as Record<string, unknown> | undefined) ?? {} : {};
  return {
    externalObjectId,
    externalObjectType: "contact",
    firstName: stringifyText(properties.firstname, "Lead") || "Lead",
    lastName: stringifyText(properties.lastname) || null,
    email: stringifyText(properties.email) || null,
    phone: stringifyText(properties.phone) || null,
    notes: null,
    sourceCode: "hubspot",
    statusCode: stringifyText(properties.hs_lead_status) || null,
    lifecycleState: stringifyText(properties.lifecyclestage) || null,
    isConverted: toLowerCaseText(properties.lifecyclestage) === "customer",
    isLost: false,
    metadata: {
      provider: "hubspot",
      rawPayload,
      hubspot: responseData,
    },
  };
}

async function fetchZohoLeadSnapshot(integration: IntegrationRow, externalObjectId: string, rawPayload: Record<string, unknown>): Promise<ExternalContactSnapshot> {
  const accessToken = await resolveZohoAccessToken(integration);
  const accountsDomain = stringifyText(coerceObject(integration.config).accountsDomain, "accounts.zoho.com");
  const response = await fetch(`${resolveZohoCrmApiBase(accountsDomain)}/Leads/${encodeURIComponent(externalObjectId)}`, {
    method: "GET",
    headers: zohoHeaders(accessToken),
    cache: "no-store",
  });

  const responseData = await response.json().catch(() => null) as { data?: Array<Record<string, unknown>> } | null;
  if (!response.ok) {
    throw new Error(`Zoho CRM lead fetch failed: ${extractMessage(responseData, "Unknown error")}`);
  }

  const record = responseData?.data?.[0] ?? {};
  return {
    externalObjectId,
    externalObjectType: "lead",
    firstName: stringifyText(record.First_Name ?? record.first_name, "Lead") || "Lead",
    lastName: stringifyText(record.Last_Name ?? record.last_name) || null,
    email: stringifyText(record.Email ?? record.email) || null,
    phone: stringifyText(record.Phone ?? record.phone) || null,
    notes: stringifyText(record.Description ?? record.description) || null,
    sourceCode: stringifyText(record.Lead_Source ?? record.lead_source) || "zoho_crm",
    statusCode: stringifyText(record.Lead_Status ?? record.lead_status) || null,
    lifecycleState: stringifyText(record.Lead_Status ?? record.lead_status) || null,
    isConverted: toLowerCaseText(record.Lead_Status ?? record.lead_status) === "converted",
    isLost: toLowerCaseText(record.Lead_Status ?? record.lead_status) === "lost",
    metadata: {
      provider: "zoho_crm",
      accountsDomain,
      rawPayload,
      zoho: responseData,
    },
  };
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
    if (accessToken) return accessToken;
    throw new Error("Zoho access token is missing.");
  }

  const accountsDomain = stringifyText(config.accountsDomain, "accounts.zoho.com");
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

async function getDefaultLeadStatusId() {
  const db = adminDb();
  const { data, error } = await db
    .from("crm_lead_statuses")
    .select("id, code, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1);

  if (error) throw new Error(error.message);
  const first = (data ?? [])[0] as { id?: string } | undefined;
  if (first?.id) return first.id;
  return null;
}

async function getDefaultLeadSourceId() {
  const db = adminDb();
  const { data, error } = await db
    .from("crm_lead_sources")
    .select("id, code, is_active, name")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(1);

  if (error) throw new Error(error.message);
  const first = (data ?? [])[0] as { id?: string } | undefined;
  if (first?.id) return first.id;
  return null;
}

async function loadLeadById(leadId: string, organizationId: string) {
  const db = adminDb();
  const { data, error } = await db
    .from("crm_leads")
    .select("*")
    .eq("id", leadId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CrmLeadRow | null;
}

async function loadLeadByExternalId(integrationId: string, externalObjectId: string) {
  const db = adminDb();
  const { data, error } = await db
    .from("crm_sync_mappings")
    .select("*")
    .eq("integration_id", integrationId)
    .eq("external_id", externalObjectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { entity_id: string } | null;
}

async function findLeadByEmailOrPhone(organizationId: string, snapshot: ExternalContactSnapshot) {
  const db = adminDb();
  if (snapshot.email) {
    const { data } = await db
      .from("crm_leads")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("email", snapshot.email)
      .maybeSingle();
    if (data) return data as CrmLeadRow;
  }
  if (snapshot.phone) {
    const { data } = await db
      .from("crm_leads")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("phone", snapshot.phone)
      .maybeSingle();
    if (data) return data as CrmLeadRow;
  }
  return null;
}

async function applySnapshotToLead(args: {
  integration: IntegrationRow;
  snapshot: ExternalContactSnapshot;
  organizationId: string;
  eventType: CrmEventType;
  eventPayload: Record<string, unknown>;
}) {
  const db = adminDb();
  const existingMapping = await loadLeadByExternalId(args.integration.id, args.snapshot.externalObjectId);
  const defaultStatusId = await getDefaultLeadStatusId();
  const defaultSourceId = await getDefaultLeadSourceId();

  let lead: CrmLeadRow | null = null;
  if (existingMapping?.entity_id) {
    lead = await loadLeadById(existingMapping.entity_id, args.organizationId);
  }
  if (!lead) {
    lead = await findLeadByEmailOrPhone(args.organizationId, args.snapshot);
  }

  const terminalConverted = args.snapshot.isConverted || args.eventType === "lead.converted";
  const terminalLost = args.snapshot.isLost || args.eventType === "lead.lost";

  if (!lead) {
    const insertPayload = {
      organization_id: args.organizationId,
      gym_id: null,
      branch_id: null,
      first_name: args.snapshot.firstName,
      last_name: args.snapshot.lastName,
      email: args.snapshot.email,
      phone: args.snapshot.phone,
      notes: args.snapshot.notes,
      referral_source: args.snapshot.sourceCode ?? null,
      status_id: defaultStatusId,
      source_id: defaultSourceId,
      metadata: {
        external_crm: {
          provider: args.integration.provider,
          external_object_id: args.snapshot.externalObjectId,
          event_type: args.eventType,
          last_synced_at: new Date().toISOString(),
          payload: args.eventPayload,
          snapshot: args.snapshot,
        },
      } as unknown as Json,
    };

    const { data, error } = await db
      .from("crm_leads")
      .insert(insertPayload as never)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    lead = data as CrmLeadRow | null;
  }

  if (!lead) {
    throw new Error("Failed to create or load CRM lead.");
  }

  const currentMetadata = coerceObject(lead.metadata);
  const currentExternal = coerceObject(currentMetadata.external_crm as Json | null | undefined);
  const currentIsConverted = Boolean(lead.converted_at);
  const currentIsLost = Boolean(lead.lost_at);
  const incomingUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    metadata: {
      ...currentMetadata,
      external_crm: {
        ...currentExternal,
        provider: args.integration.provider,
        external_object_id: args.snapshot.externalObjectId,
        last_synced_at: new Date().toISOString(),
        last_event_type: args.eventType,
        payload: args.eventPayload,
        snapshot: args.snapshot,
      },
    } as unknown as Json,
  };

  if (!lead.first_name?.trim() && args.snapshot.firstName.trim()) {
    incomingUpdates.first_name = args.snapshot.firstName;
  }
  if ((!lead.last_name || !lead.last_name.trim()) && args.snapshot.lastName) {
    incomingUpdates.last_name = args.snapshot.lastName;
  }
  if ((!lead.email || !lead.email.trim()) && args.snapshot.email) {
    incomingUpdates.email = args.snapshot.email;
  }
  if ((!lead.phone || !lead.phone.trim()) && args.snapshot.phone) {
    incomingUpdates.phone = args.snapshot.phone;
  }
  if ((!lead.notes || !lead.notes.trim()) && args.snapshot.notes) {
    incomingUpdates.notes = args.snapshot.notes;
  }
  if (!lead.referral_source && args.snapshot.sourceCode) {
    incomingUpdates.referral_source = args.snapshot.sourceCode;
  }

  if (terminalConverted && !currentIsConverted) {
    incomingUpdates.converted_at = new Date().toISOString();
    incomingUpdates.lost_at = null;
  } else if (terminalLost && !currentIsLost) {
    incomingUpdates.lost_at = new Date().toISOString();
    incomingUpdates.lost_reason = args.snapshot.notes ?? "CRM marked the lead as lost.";
  } else if (!currentIsConverted && !currentIsLost && args.snapshot.statusCode) {
    const statusId = await resolveLeadStatusIdFromCode(args.snapshot.statusCode);
    if (statusId) {
      incomingUpdates.status_id = statusId;
    }
  }

  if (!lead.source_id && defaultSourceId) {
    incomingUpdates.source_id = defaultSourceId;
  }
  if (!lead.status_id && defaultStatusId) {
    incomingUpdates.status_id = defaultStatusId;
  }

  const { data: updated, error } = await db
    .from("crm_leads")
    .update(incomingUpdates as never)
    .eq("id", lead.id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);

  const finalLead = updated as CrmLeadRow | null;
  if (!finalLead) {
    throw new Error("CRM lead update failed.");
  }

  await upsertCrmSyncMapping({
    organizationId: args.organizationId,
    integrationId: args.integration.id,
    entityType: "crm_leads",
    entityId: finalLead.id,
    externalObjectType: args.snapshot.externalObjectType,
    externalId: args.snapshot.externalObjectId,
    payloadHash: sha256Hex(JSON.stringify(args.eventPayload)),
    syncStatus: "synced",
  });

  return finalLead;
}

async function resolveLeadStatusIdFromCode(code: string) {
  const normalized = toLowerCaseText(code);
  if (!normalized) return null;

  const db = adminDb();
  const { data, error } = await db
    .from("crm_lead_statuses")
    .select("id, code, is_active")
    .eq("is_active", true)
    .eq("code", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.id) return data.id as string;

  const aliases: Record<string, string> = {
    customer: "converted",
    closedwon: "converted",
    won: "converted",
    qualified: "qualified",
    negotiating: "negotiation",
    negotiation: "negotiation",
    proposal: "proposal",
    contactmade: "contacted",
    contacted: "contacted",
    new: "new",
    lead: "new",
    lost: "lost",
    dead: "lost",
    disqualified: "lost",
  };
  const alias = aliases[normalized.replace(/[^a-z]/g, "")];
  if (!alias) return null;

  const { data: fallback } = await db
    .from("crm_lead_statuses")
    .select("id, code, is_active")
    .eq("is_active", true)
    .eq("code", alias)
    .maybeSingle();
  return fallback?.id ?? null;
}

async function recordWebhookEvent(input: {
  organizationId: string;
  integrationId: string;
  provider: CrmProviderId;
  eventId: string;
  externalObjectType: string;
  externalObjectId: string;
  eventType: string;
  payload: Json;
}) {
  const db = adminDb();
  const existing = await db
    .from("crm_webhook_events")
    .select("id, status, processed_at")
    .eq("integration_id", input.integrationId)
    .eq("event_id", input.eventId)
    .maybeSingle();

  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    return { duplicate: true, row: existing.data as CrmWebhookEventRow };
  }

  const { data, error } = await db
    .from("crm_webhook_events")
    .insert({
      organization_id: input.organizationId,
      integration_id: input.integrationId,
      provider: input.provider,
      event_id: input.eventId,
      external_object_type: input.externalObjectType,
      external_object_id: input.externalObjectId,
      event_type: input.eventType,
      payload: input.payload,
      status: "received",
    } as never)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { duplicate: false, row: data as CrmWebhookEventRow };
}

async function finalizeWebhookEvent(eventRow: CrmWebhookEventRow, status: CrmWebhookEventRow["status"], errorMessage: string | null = null) {
  const db = adminDb();
  await db
    .from("crm_webhook_events")
    .update({
      status,
      processed_at: status === "processed" || status === "ignored" ? new Date().toISOString() : null,
      error_message: errorMessage,
    } as never)
    .eq("id", eventRow.id);
}

export async function processCrmWebhookRequest(input: {
  provider: CrmProviderId;
  integrationId: string;
  request: Request;
  rawBody: string;
}): Promise<CrmWebhookResult> {
  const integration = await loadIntegrationById(input.integrationId);
  if (!integration) {
    throw new Error("CRM integration not found.");
  }
  if (integration.provider !== input.provider) {
    throw new Error("CRM provider does not match the integration record.");
  }

  const providerLabel = getCrmProviderLabel(input.provider);
  const providerCredentials = coerceObject(integration.credentials);

  if (input.provider === "hubspot") {
    const clientSecret = stringifyText(providerCredentials.clientSecret);
    if (!clientSecret) {
      throw new Error("HubSpot client secret is not configured.");
    }
    const v3 = input.request.headers.get("x-hubspot-signature-v3");
    const v1 = input.request.headers.get("x-hubspot-signature");
    const verified = v3
      ? verifyHubSpotSignatureV3(input.request, input.rawBody, clientSecret)
      : verifyHubSpotSignatureV1(input.rawBody, clientSecret, v1);
    if (!verified.ok) {
      throw new Error(verified.reason);
    }
  } else {
    const verified = verifyZohoSignature(input.request, integration);
    if (!verified.ok) {
      throw new Error(verified.reason);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawBody);
  } catch {
    throw new Error("Invalid CRM webhook payload.");
  }
  const normalizedEvents = input.provider === "hubspot"
    ? jsonToArray(parsed)
        .map((entry) => normalizeHubSpotEvent(entry as HubSpotWebhookEvent, entry))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    : jsonToArray(parsed)
        .map((entry) => normalizeZohoEvent(entry as ZohoWebhookPayload))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (!normalizedEvents.length) {
    return {
      provider: input.provider,
      integrationId: input.integrationId,
      totalEvents: 0,
      processed: 0,
      ignored: 0,
      duplicates: 0,
      failed: 0,
    };
  }

  const stats = { processed: 0, ignored: 0, duplicates: 0, failed: 0 };

  for (const event of normalizedEvents) {
    const record = await recordWebhookEvent({
      organizationId: integration.organization_id,
      integrationId: input.integrationId,
      provider: input.provider,
      eventId: event.eventId,
      externalObjectType: "lead",
      externalObjectId: event.externalObjectId,
      eventType: event.eventType,
      payload: event.payload as Json,
    });

    if (record.duplicate) {
      stats.duplicates += 1;
      continue;
    }

    const eventRow = record.row;
    try {
      let snapshot: ExternalContactSnapshot;
      if (input.provider === "hubspot") {
        snapshot = await fetchHubSpotContactSnapshot(integration, event.externalObjectId, event.payload);
      } else {
        snapshot = await fetchZohoLeadSnapshot(integration, event.externalObjectId, event.payload);
      }

      await applySnapshotToLead({
        integration,
        snapshot,
        organizationId: integration.organization_id,
        eventType: event.eventType,
        eventPayload: event.payload,
      });

      await finalizeWebhookEvent(eventRow, "processed", null);
      await createIntegrationLog({
        integration_id: integration.id,
        action: `crm.${input.provider}.webhook.${event.eventType}`,
        status: "success",
        request_data: {
          provider: input.provider,
          eventId: maskEventId(event.eventId),
          externalObjectId: event.externalObjectId,
        } as Json,
      });
      stats.processed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : `${providerLabel} webhook processing failed.`;
      await finalizeWebhookEvent(eventRow, "failed", message);
      await createIntegrationLog({
        integration_id: integration.id,
        action: `crm.${input.provider}.webhook.${event.eventType}`,
        status: "error",
        request_data: {
          provider: input.provider,
          eventId: maskEventId(event.eventId),
          externalObjectId: event.externalObjectId,
        } as Json,
        error_message: message,
      });
      stats.failed += 1;
    }
  }

  if (stats.processed > 0) {
    await updateIntegrationConfig(integration.id, {
      status: "connected",
      lastSyncAt: new Date().toISOString(),
      errorMessage: null,
    });
  }

  return {
    provider: input.provider,
    integrationId: input.integrationId,
    totalEvents: normalizedEvents.length,
    ...stats,
  };
}

function extractMessage(responseData: unknown, fallback: string) {
  if (!responseData || typeof responseData !== "object") return fallback;
  const record = responseData as Record<string, unknown>;
  const message = [record.message, record.error, record.error_description].find((value) => typeof value === "string" && value.trim().length > 0);
  return typeof message === "string" ? message : fallback;
}
