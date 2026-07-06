import { afterEach, describe, expect, it, vi } from "vitest";
import { getCrmProviderConfigSummary, maskToken, resolveZohoCrmApiBase, testCrmConnection } from "@/features/integrations/services/crm-sync-service";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("crm-sync-service", () => {
  it("masks tokens safely", () => {
    expect(maskToken("abcd1234")).toBe("••••1234");
    expect(maskToken("abcdef", 2)).toBe("••••ef");
    expect(maskToken(null)).toBeNull();
  });

  it("builds a hubspot config summary", () => {
    const summary = getCrmProviderConfigSummary("hubspot", {
      credentials: { accessToken: "hubspot_token_1234" },
      config: {
        portalId: "123456",
        syncLeads: true,
        syncContacts: false,
        testEmail: "ops@example.com",
        fieldMappings: {
          firstNameField: "firstname",
          lastNameField: "lastname",
          emailField: "email",
          phoneField: "phone",
          notesField: "notes",
          sourceField: "lifecyclestage",
          statusField: "hs_lead_status",
        },
      },
    } as never);

    expect(summary.accessToken).toContain("1234");
    expect(summary.portalId).toBe("123456");
    expect(summary.syncLeads).toBe(true);
    expect(summary.syncContacts).toBe(false);
    expect((summary.fieldMappings as Record<string, string>).firstNameField).toBe("firstname");
  });

  it("builds a zoho config summary", () => {
    const summary = getCrmProviderConfigSummary("zoho_crm", {
      credentials: {
        accessToken: "zoho_access",
        refreshToken: "zoho_refresh",
        clientId: "zoho_client",
      },
      config: {
        accountsDomain: "accounts.zoho.com",
        syncLeads: true,
        syncContacts: true,
        testEmail: "ops@example.com",
      },
    } as never);

    expect(summary.accountsDomain).toBe("accounts.zoho.com");
    expect(summary.syncLeads).toBe(true);
    expect(summary.syncContacts).toBe(true);
  });

  it("resolves zoho regional API bases", () => {
    expect(resolveZohoCrmApiBase("accounts.zoho.com")).toBe("https://www.zohoapis.com/crm/v8");
    expect(resolveZohoCrmApiBase("accounts.zoho.eu")).toBe("https://www.zohoapis.eu/crm/v8");
    expect(resolveZohoCrmApiBase("accounts.zoho.in")).toBe("https://www.zohoapis.in/crm/v8");
  });

  it("verifies a hubspot connection using the contacts endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ total: 0 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await testCrmConnection("hubspot", {
      id: "int_1",
      provider: "hubspot",
      credentials: { accessToken: "hubspot_private_token" },
      config: {},
    } as never);

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/crm/v3/objects/contacts?limit=1"),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer hubspot_private_token",
        }),
      }),
    );
  });

  it("verifies a zoho connection using the modules endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ modules: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await testCrmConnection("zoho_crm", {
      id: "int_2",
      provider: "zoho_crm",
      credentials: {
        accessToken: "zoho_access_token",
        refreshToken: "zoho_refresh_token",
        clientId: "zoho_client_id",
        clientSecret: "zoho_client_secret",
      },
      config: {
        accountsDomain: "accounts.zoho.com",
        tokenExpiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      },
    } as never);

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("https://www.zohoapis.com/crm/v8/settings/modules"),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Zoho-oauthtoken zoho_access_token",
        }),
      }),
    );
  });
});
