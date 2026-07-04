import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createSupabaseServerClientMock,
  requireOrgFeatureAccessMock,
  getOrgOwnerContextMock,
  auditOrgActionMock,
  removeEquipmentImageAssetMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  requireOrgFeatureAccessMock: vi.fn(),
  getOrgOwnerContextMock: vi.fn(),
  auditOrgActionMock: vi.fn(),
  removeEquipmentImageAssetMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock("@/features/entitlement", () => ({
  requireOrgFeatureAccess: requireOrgFeatureAccessMock,
}));

vi.mock("@/features/organization-owner/actions/action-utils", () => ({
  getOrgOwnerContext: getOrgOwnerContextMock,
  auditOrgAction: auditOrgActionMock,
}));

vi.mock("@/features/organization-owner/services/equipment-image-service", () => ({
  removeEquipmentImageAsset: removeEquipmentImageAssetMock,
}));

import { deleteEquipment, saveEquipment } from "@/features/organization-owner/actions/equipment-actions";

describe("equipment actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrgOwnerContextMock.mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
      roles: ["organization_owner"],
    });
    requireOrgFeatureAccessMock.mockResolvedValue(undefined);
  });

  it("removes the previous stored image when an equipment image is replaced", async () => {
    const selectSingleMock = vi.fn()
      .mockResolvedValueOnce({ data: { id: "eq-1", image_storage_path: "old/path.jpg" }, error: null })
      .mockResolvedValueOnce({
        data: { id: "eq-1", organization_id: "org-1", name: "Bike", image_storage_path: "new/path.jpg", image_url: "https://cdn/new.jpg", image_source: "upload", image_prompt: null },
        error: null,
      });

    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: selectSingleMock,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: selectSingleMock,
              })),
            })),
          })),
        })),
      })),
    });

    await saveEquipment("org-1", {
      equipmentId: "eq-1",
      name: "Bike",
      equipmentType: "cardio",
      imageUrl: "https://cdn/new.jpg",
      imageStoragePath: "new/path.jpg",
      imageSource: "upload",
    });

    expect(removeEquipmentImageAssetMock).toHaveBeenCalledWith("old/path.jpg");
    expect(auditOrgActionMock).toHaveBeenCalledWith(
      "user-1",
      "save_equipment",
      "equipment",
      "eq-1",
      expect.objectContaining({ operation: "update" })
    );
  });

  it("removes the stored asset when equipment is deleted", async () => {
    const singleMock = vi.fn().mockResolvedValue({ data: { id: "eq-1", image_storage_path: "delete/me.jpg" }, error: null });
    const deleteEqMock = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));

    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: singleMock,
            })),
          })),
        })),
        delete: deleteEqMock,
      })),
    });

    await deleteEquipment("org-1", "eq-1");

    expect(removeEquipmentImageAssetMock).toHaveBeenCalledWith("delete/me.jpg");
    expect(auditOrgActionMock).toHaveBeenCalledWith(
      "user-1",
      "delete_equipment",
      "equipment",
      "eq-1",
      { organizationId: "org-1" }
    );
  });

  it("rejects client supplied organization ids outside the owner scope", async () => {
    await expect(saveEquipment("org-2", {
      name: "Treadmill",
      equipmentType: "cardio",
    })).rejects.toThrow("Organization scope mismatch.");
  });
});
