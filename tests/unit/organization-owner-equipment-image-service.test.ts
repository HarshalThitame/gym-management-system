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

import {
  buildEquipmentImagePrompt,
  generateEquipmentImagePreview,
  persistGeneratedEquipmentImage,
} from "@/features/organization-owner/services/equipment-image-service";

describe("equipment image service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("builds a realistic product prompt from equipment metadata", () => {
    const prompt = buildEquipmentImagePrompt({
      name: "Elite Runner",
      equipmentType: "cardio",
      brand: "Life Fitness",
      model: "T5",
      customPrompt: "side angle with matte black frame",
    });

    expect(prompt).toContain("photorealistic commercial product photo");
    expect(prompt).toContain("Elite Runner");
    expect(prompt).toContain("Life Fitness");
    expect(prompt).toContain("T5");
    expect(prompt).toContain("Do not include any people");
    expect(prompt).toContain("watermarks");
  });

  it("persists an AI preview into storage and returns normalized metadata", async () => {
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

    const result = await persistGeneratedEquipmentImage({
      organizationId: "org-1",
      dataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/",
      prompt: "A realistic treadmill in a studio",
    });

    expect(uploadMock).toHaveBeenCalled();
    expect(result).toMatchObject({
      imageUrl: "https://cdn.example.com/equipment/test.jpg",
      imageSource: "ai",
      imagePrompt: "A realistic treadmill in a studio",
    });
    expect(result.imageStoragePath).toContain("organizations/org-1/equipment/");
  });

  it("rejects non-OpenAI style API keys with a clear configuration error", async () => {
    vi.stubEnv("OPENAI_API_KEY", "vcp_invalid_token");

    await expect(generateEquipmentImagePreview({
      organizationId: "org-1",
      name: "Bike",
      equipmentType: "cardio",
    })).rejects.toThrow("OPENAI_API_KEY is invalid");
  });
});
