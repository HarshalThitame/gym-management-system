import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

function makeWebhookDb(options: {
  integrationRow: Record<string, unknown>;
  leadRow: Record<string, unknown>;
  updatedLeadRow: Record<string, unknown>;
  mappingRow?: Record<string, unknown> | null;
}) {
  let webhookInserted = false;
  let currentMapping = options.mappingRow ?? null;

  const integrationQuery = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: options.integrationRow, error: null }),
  };

  const crmWebhookEventsSelect = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(async () => (
      webhookInserted
        ? { data: { id: "event-1", status: "received", processed_at: null }, error: null }
        : { data: null, error: null }
    )),
  };

  const crmWebhookEventsInsertSelect = {
    maybeSingle: vi.fn().mockImplementation(async () => {
      webhookInserted = true;
      return { data: { id: "event-1", status: "received", processed_at: null }, error: null };
    }),
  };

  const crmWebhookEvents = {
    select: vi.fn().mockReturnValue(crmWebhookEventsSelect),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(crmWebhookEventsInsertSelect),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  };

  const crmSyncMappings = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(async () => ({ data: currentMapping, error: null })),
    }),
  };

  const crmLeadsSelect = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: options.leadRow, error: null }),
  };

  const crmLeadsUpdate = {
    eq: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: options.updatedLeadRow, error: null }),
      }),
    }),
  };

  const db = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "integrations") return { select: vi.fn().mockReturnValue(integrationQuery) };
      if (table === "crm_webhook_events") return crmWebhookEvents;
      if (table === "crm_sync_mappings") return crmSyncMappings;
      if (table === "crm_leads") {
        return {
          select: vi.fn().mockReturnValue(crmLeadsSelect),
          update: vi.fn().mockReturnValue(crmLeadsUpdate),
        };
      }
      if (table === "crm_lead_statuses") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === "crm_lead_sources") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return {
    db,
    setMapping(row: Record<string, unknown> | null) {
      currentMapping = row;
    },
    crmWebhookEvents,
  };
}

describe("crm webhook service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("processes a HubSpot webhook and ignores the same event on replay", async () => {
    const createIntegrationLog = vi.fn().mockResolvedValue(undefined);
    const updateIntegrationConfig = vi.fn().mockResolvedValue(undefined);
    const upsertCrmSyncMapping = vi.fn().mockResolvedValue({ id: "mapping-1" });

    vi.doMock("@/features/integrations/services/integrations-service", async () => {
      const actual = await vi.importActual<typeof import("@/features/integrations/services/integrations-service")>(
        "@/features/integrations/services/integrations-service",
      );
      return {
        ...actual,
        createIntegrationLog,
        updateIntegrationConfig,
      };
    });

    vi.doMock("@/features/integrations/services/crm-sync-service", async () => {
      const actual = await vi.importActual<typeof import("@/features/integrations/services/crm-sync-service")>(
        "@/features/integrations/services/crm-sync-service",
      );
      return {
        ...actual,
        upsertCrmSyncMapping,
      };
    });

    const mockDb = makeWebhookDb({
      integrationRow: {
        id: "integration-1",
        organization_id: "org-1",
        provider: "hubspot",
        status: "connected",
        credentials: {
          accessToken: "hubspot-token",
          clientSecret: "hubspot-secret",
        },
        config: {
          syncLeads: true,
          syncContacts: true,
        },
      },
      mappingRow: { entity_id: "lead-1" },
      leadRow: {
        id: "lead-1",
        organization_id: "org-1",
        first_name: "Old",
        last_name: "Lead",
        email: "old@example.com",
        phone: "5550000",
        notes: null,
        referral_source: null,
        status_id: "status-1",
        source_id: "source-1",
        metadata: { external_crm: { provider: "hubspot" } },
        converted_at: null,
        lost_at: null,
        updated_at: "2026-07-06T10:00:00.000Z",
      },
      updatedLeadRow: {
        id: "lead-1",
        organization_id: "org-1",
        first_name: "Jane",
        last_name: "Doe",
        email: "jane@example.com",
        phone: "5550000",
        notes: null,
        referral_source: "hubspot",
        status_id: "status-1",
        source_id: "source-1",
        metadata: { external_crm: { provider: "hubspot" } },
        converted_at: null,
        lost_at: null,
        updated_at: "2026-07-06T10:05:00.000Z",
      },
    });

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue(mockDb.db),
    }));
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn().mockResolvedValue(mockDb.db),
    }));

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/crm/v3/objects/contacts/321")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "321",
            properties: {
              firstname: "Jane",
              lastname: "Doe",
              email: "jane@example.com",
              phone: "5550000",
              lifecyclestage: "customer",
              hs_lead_status: "qualified",
            },
          }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { processCrmWebhookRequest } = await import("@/features/integrations/services/crm-webhook-service");
    const rawBody = JSON.stringify([
      {
        eventId: "11",
        objectId: "321",
        subscriptionType: "contact.creation",
        occurredAt: 1720000000000,
      },
    ]);
    const hubspotSignature = createHash("sha256").update(`hubspot-secret${rawBody}`).digest("hex");

    const request = new Request("http://localhost/api/webhooks/crm/hubspot/integration-1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hubspot-signature": hubspotSignature,
      },
      body: rawBody,
    });

    const first = await processCrmWebhookRequest({
      provider: "hubspot",
      integrationId: "integration-1",
      request,
      rawBody,
    });

    expect(first).toMatchObject({
      provider: "hubspot",
      integrationId: "integration-1",
      totalEvents: 1,
      processed: 1,
      duplicates: 0,
      failed: 0,
    });
    expect(updateIntegrationConfig).toHaveBeenCalledWith("integration-1", expect.objectContaining({
      status: "connected",
      errorMessage: null,
    }));
    expect(upsertCrmSyncMapping).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-1",
      integrationId: "integration-1",
      entityId: "lead-1",
      externalObjectType: "contact",
      externalId: "321",
      syncStatus: "synced",
    }));

    const second = await processCrmWebhookRequest({
      provider: "hubspot",
      integrationId: "integration-1",
      request,
      rawBody,
    });

    expect(second).toMatchObject({
      provider: "hubspot",
      integrationId: "integration-1",
      totalEvents: 1,
      processed: 0,
      duplicates: 1,
      failed: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the Zoho regional API base and rejects invalid webhook secrets", async () => {
    const createIntegrationLog = vi.fn().mockResolvedValue(undefined);
    const updateIntegrationConfig = vi.fn().mockResolvedValue(undefined);
    const upsertCrmSyncMapping = vi.fn().mockResolvedValue({ id: "mapping-1" });

    vi.doMock("@/features/integrations/services/integrations-service", async () => {
      const actual = await vi.importActual<typeof import("@/features/integrations/services/integrations-service")>(
        "@/features/integrations/services/integrations-service",
      );
      return {
        ...actual,
        createIntegrationLog,
        updateIntegrationConfig,
      };
    });
    vi.doMock("@/features/integrations/services/crm-sync-service", async () => {
      const actual = await vi.importActual<typeof import("@/features/integrations/services/crm-sync-service")>(
        "@/features/integrations/services/crm-sync-service",
      );
      return {
        ...actual,
        upsertCrmSyncMapping,
      };
    });

    const mockDb = makeWebhookDb({
      integrationRow: {
        id: "integration-2",
        organization_id: "org-2",
        provider: "zoho_crm",
        status: "connected",
        credentials: {
          accessToken: "zoho-token",
          clientId: "client-id",
          clientSecret: "client-secret",
          webhookSecret: "zoho-secret",
        },
        config: {
          accountsDomain: "accounts.zoho.eu",
          syncLeads: true,
          syncContacts: true,
        },
      },
      mappingRow: { entity_id: "lead-2" },
      leadRow: {
        id: "lead-2",
        organization_id: "org-2",
        first_name: "Old",
        last_name: "Lead",
        email: "old@example.com",
        phone: "5550001",
        notes: null,
        referral_source: null,
        status_id: "status-1",
        source_id: "source-1",
        metadata: { external_crm: { provider: "zoho_crm" } },
        converted_at: null,
        lost_at: null,
        updated_at: "2026-07-06T11:00:00.000Z",
      },
      updatedLeadRow: {
        id: "lead-2",
        organization_id: "org-2",
        first_name: "Zoe",
        last_name: "CRM",
        email: "zoe@example.eu",
        phone: "5550001",
        notes: null,
        referral_source: "zoho_crm",
        status_id: "status-1",
        source_id: "source-1",
        metadata: { external_crm: { provider: "zoho_crm" } },
        converted_at: null,
        lost_at: null,
        updated_at: "2026-07-06T11:05:00.000Z",
      },
    });

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: vi.fn().mockReturnValue(mockDb.db),
    }));
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn().mockResolvedValue(mockDb.db),
    }));

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("https://www.zohoapis.eu/crm/v8/Leads/777")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              id: "777",
              First_Name: "Zoe",
              Last_Name: "CRM",
              Email: "zoe@example.eu",
              Phone: "5550001",
              Lead_Status: "Converted",
              Lead_Source: "Zoho",
            }],
          }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { processCrmWebhookRequest } = await import("@/features/integrations/services/crm-webhook-service");
    const { resolveZohoCrmApiBase } = await import("@/features/integrations/services/crm-sync-service");
    expect(resolveZohoCrmApiBase("accounts.zoho.eu")).toBe("https://www.zohoapis.eu/crm/v8");

    const rawBody = JSON.stringify([
      {
        id: "777",
        action: "create",
        module: "Leads",
        data: [{ id: "777" }],
      },
    ]);

    const request = new Request("http://localhost/api/webhooks/crm/zoho_crm/integration-2", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-crm-webhook-secret": "zoho-secret",
      },
      body: rawBody,
    });

    const result = await processCrmWebhookRequest({
      provider: "zoho_crm",
      integrationId: "integration-2",
      request,
      rawBody,
    });

    expect(result).toMatchObject({
      provider: "zoho_crm",
      integrationId: "integration-2",
      processed: 1,
      duplicates: 0,
      failed: 0,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.zohoapis.eu/crm/v8/Leads/777",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Zoho-oauthtoken zoho-token",
        }),
      }),
    );

    const invalidRequest = new Request("http://localhost/api/webhooks/crm/zoho_crm/integration-2", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-crm-webhook-secret": "wrong-secret",
      },
      body: rawBody,
    });

    await expect(processCrmWebhookRequest({
      provider: "zoho_crm",
      integrationId: "integration-2",
      request: invalidRequest,
      rawBody,
    })).rejects.toThrow("Invalid Zoho webhook secret.");
  });
});
