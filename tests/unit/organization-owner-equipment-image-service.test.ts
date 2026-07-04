import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAdminClientMock,
  validateAllowedFileMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  validateAllowedFileMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/lib/security/file-validation", () => ({
  validateAllowedFile: validateAllowedFileMock,
}));

import { persistUploadedEquipmentImage } from "@/features/organization-owner/services/equipment-image-service";

describe("equipment image service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists an uploaded image into storage and returns normalized metadata", async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrlMock = vi.fn().mockReturnValue({ data: { publicUrl: "https://cdn.example.com/equipment/test.jpg" } });

    createAdminClientMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          upload: uploadMock,
          getPublicUrl: getPublicUrlMock,
        })),
      },
    });
    validateAllowedFileMock.mockResolvedValue({
      ok: true,
      extension: "jpg",
      mimeType: "image/jpeg",
    });

    const file = new File(["fake-image-data"], "photo.jpg", { type: "image/jpeg" });

    const result = await persistUploadedEquipmentImage({
      organizationId: "org-1",
      file,
      source: "upload",
    });

    expect(uploadMock).toHaveBeenCalled();
    expect(result).toMatchObject({
      imageUrl: "https://cdn.example.com/equipment/test.jpg",
      imageSource: "upload",
      imagePrompt: null,
    });
    expect(result.imageStoragePath).toContain("organizations/org-1/equipment/");
  });

  it("rejects oversized files", async () => {
    const blob = new Blob(["x".repeat(5 * 1024 * 1024)]);
    const file = new File([blob], "large.jpg", { type: "image/jpeg" });

    await expect(persistUploadedEquipmentImage({
      organizationId: "org-1",
      file,
      source: "upload",
    })).rejects.toThrow("Image must be under 4 MB");
  });
});
