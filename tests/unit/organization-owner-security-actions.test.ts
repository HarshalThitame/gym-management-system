import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireOrganizationFeatureAccessMock,
  requireOrgFeatureAccessMock,
  getOrgOwnerContextMock,
  createSupabaseServerClientMock,
  getSupabaseAdminClientMock,
  writeAuditLogMock,
  revalidateOrgModulesMock,
} = vi.hoisted(() => ({
  requireOrganizationFeatureAccessMock: vi.fn(),
  requireOrgFeatureAccessMock: vi.fn(),
  getOrgOwnerContextMock: vi.fn(),
  createSupabaseServerClientMock: vi.fn(),
  getSupabaseAdminClientMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
  revalidateOrgModulesMock: vi.fn(),
}));

vi.mock("@/features/organization-owner/actions/action-utils", () => ({
  getOrgOwnerContext: getOrgOwnerContextMock,
  revalidateOrgModules: revalidateOrgModulesMock,
}));

vi.mock("@/features/entitlement", () => ({
  requireOrganizationFeatureAccess: requireOrganizationFeatureAccessMock,
  requireOrgFeatureAccess: requireOrgFeatureAccessMock,
  entitlementActionCatch: vi.fn((prevState, error, fallbackMessage) => ({
    ...prevState,
    status: "error",
    message: error instanceof Error ? error.message : fallbackMessage,
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: getSupabaseAdminClientMock,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

import { saveBrandingAction } from "@/features/organization-owner/actions/branding-actions";
import { getNetworkCalendar } from "@/features/organization-owner/actions/class-calendar-actions";
import { createCrossGymClassRule } from "@/features/organization-owner/actions/cross-gym-class-actions";
import { getCustomFields } from "@/features/organization-owner/actions/member-field-actions";
import { getAllTrainersWithGyms } from "@/features/organization-owner/actions/trainer-sharing-actions";

describe("organization owner security actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrgOwnerContextMock.mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
      roles: ["organization_owner"],
    });
    requireOrganizationFeatureAccessMock.mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
      isSuperAdmin: false,
    });
    requireOrgFeatureAccessMock.mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
    });
  });

  it("persists branding identity and routing fields instead of dropping them", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        expect(table).toBe("tenant_configs");
        return {
          insert: insertMock,
        };
      }),
    });

    const formData = new FormData();
    formData.set("brandName", "Apex Fitness");
    formData.set("tenantKey", "Apex-Mumbai");
    formData.set("customDomain", "gym.example.com");
    formData.set("logoUrl", "https://cdn.example.com/logo.png");
    formData.set("faviconUrl", "https://cdn.example.com/favicon.ico");
    formData.set("status", "draft");
    formData.set("primaryColor", "#111315");

    const result = await saveBrandingAction({ status: "idle", message: "" }, formData);

    expect(result.status).toBe("success");
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      organization_id: "org-1",
      tenant_key: "apex-mumbai",
      custom_domain: "gym.example.com",
      logo_url: "https://cdn.example.com/logo.png",
      favicon_url: "https://cdn.example.com/favicon.ico",
      status: "draft",
      updated_by: "user-1",
    }));
    expect(revalidateOrgModulesMock).toHaveBeenCalledWith(["/organization/branding", "/organization/domains"]);
  });

  it("rejects caller-supplied organization IDs that do not match the authenticated owner scope", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn(),
    });

    await expect(getCustomFields("org-2")).rejects.toThrow("Organization scope mismatch.");
  });

  it("rejects cross-gym class rule writes for a mismatched organization scope before admin writes run", async () => {
    getSupabaseAdminClientMock.mockReturnValue({
      from: vi.fn(),
    });

    await expect(createCrossGymClassRule("org-2", {
      name: "Allow Downtown to West",
      toGymId: "gym-2",
    })).rejects.toThrow("Organization scope mismatch.");
  });

  it("rejects trainer-sharing reads for a mismatched organization scope", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn(),
    });

    await expect(getAllTrainersWithGyms("org-2")).rejects.toThrow("Organization scope mismatch.");
  });

  it("rejects network calendar reads for a mismatched organization scope", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn(),
    });

    await expect(getNetworkCalendar("org-2", 2026, 7)).rejects.toThrow("Organization scope mismatch.");
  });
});
