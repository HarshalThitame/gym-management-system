import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateAllowedFile } from "@/lib/security/file-validation";

const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";
export const EQUIPMENT_IMAGE_BUCKET = "equipment-images";
export const equipmentImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_EQUIPMENT_IMAGE_BYTES = 4 * 1024 * 1024;
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const AI_IMAGE_TIMEOUT_MS = 120_000;

export type EquipmentImageSource = "upload" | "ai";

export type EquipmentImageAsset = {
  imageUrl: string;
  imageStoragePath: string;
  imageSource: EquipmentImageSource;
  imagePrompt: string | null;
};

type BuildEquipmentImagePromptInput = {
  name: string;
  equipmentType: string;
  brand?: string | null;
  model?: string | null;
  customPrompt?: string | null;
};

type GenerateEquipmentImagePreviewInput = BuildEquipmentImagePromptInput & {
  organizationId: string;
};

type PersistUploadedEquipmentImageInput = {
  organizationId: string;
  file: File;
  source: EquipmentImageSource;
  prompt?: string | null;
};

type PersistGeneratedEquipmentImageInput = {
  organizationId: string;
  dataUrl: string;
  prompt: string;
};

type OpenAiImageResponse = {
  data?: Array<{
    b64_json?: string;
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

function cleanPromptPart(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\s+/g, " ") : null;
}

export function buildEquipmentImagePrompt(input: BuildEquipmentImagePromptInput) {
  const name = cleanPromptPart(input.name) ?? "gym equipment";
  const type = cleanPromptPart(input.equipmentType) ?? "equipment";
  const brand = cleanPromptPart(input.brand);
  const model = cleanPromptPart(input.model);
  const customPrompt = cleanPromptPart(input.customPrompt);

  const descriptors = [
    `Create a photorealistic commercial product photo of a single ${type} gym equipment item named ${name}.`,
    brand ? `The equipment should match the ${brand} brand.` : null,
    model ? `Use the ${model} model design details if they are applicable.` : null,
    "Show the full equipment clearly with accurate proportions, realistic materials, and sharp lighting.",
    "Use a clean neutral studio or premium gym-floor background.",
    "Do not include any people, text overlays, logos, watermarks, posters, or extra equipment.",
    "The result must look like a real product photograph suitable for a gym inventory catalog.",
    customPrompt ? `Additional guidance: ${customPrompt}.` : null,
  ].filter(Boolean);

  return descriptors.join(" ");
}

export async function generateEquipmentImagePreview(input: GenerateEquipmentImagePreviewInput) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  if (!apiKey.startsWith("sk-")) {
    throw new Error("OPENAI_API_KEY is invalid. Configure a real OpenAI API key that starts with 'sk-'.");
  }

  const prompt = buildEquipmentImagePrompt(input);
  try {
    const response = await fetch(OPENAI_IMAGE_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      signal: AbortSignal.timeout(AI_IMAGE_TIMEOUT_MS),
      body: JSON.stringify({
        model: DEFAULT_IMAGE_MODEL,
        prompt,
        size: "1024x1024",
        quality: "medium",
        output_format: "jpeg",
        background: "opaque",
        moderation: "auto",
        n: 1,
        user: input.organizationId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let parsed: OpenAiImageResponse | null = null;
      try {
        parsed = errorText ? JSON.parse(errorText) as OpenAiImageResponse : null;
      } catch {
        parsed = null;
      }

      const providerMessage = parsed?.error?.message?.trim();
      if (response.status === 401) {
        throw new Error(providerMessage || "OpenAI rejected the API key. Update OPENAI_API_KEY and redeploy/restart.");
      }
      if (response.status === 403) {
        throw new Error(providerMessage || "This OpenAI project does not have access to image generation.");
      }
      if (response.status === 429) {
        throw new Error(providerMessage || "OpenAI rate limit reached. Wait a moment and try again.");
      }

      throw new Error(providerMessage || `Image generation failed (${response.status}). Please retry.`);
    }

    const body = await response.json() as OpenAiImageResponse;
    const base64 = body.data?.[0]?.b64_json;
    if (!base64) {
      throw new Error("Image generation completed but did not return preview data.");
    }

    return {
      prompt,
      dataUrl: `data:image/jpeg;base64,${base64}`,
      mimeType: "image/jpeg",
      model: DEFAULT_IMAGE_MODEL,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("AI image generation timed out after 20 seconds. Try again or simplify the prompt.");
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI image generation timed out after 20 seconds. Try again or simplify the prompt.");
    }
    throw error;
  }
}

export async function persistUploadedEquipmentImage(input: PersistUploadedEquipmentImageInput): Promise<EquipmentImageAsset> {
  if (input.file.size > MAX_EQUIPMENT_IMAGE_BYTES) {
    throw new Error("Image must be under 4 MB.");
  }

  const validation = await validateAllowedFile(
    input.file,
    equipmentImageMimeTypes,
    "Upload a valid JPG, PNG, or WebP image."
  );
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const storagePath = buildEquipmentImagePath(input.organizationId, input.source, validation.extension);
  const client = createAdminClient();
  const { error } = await client.storage.from(EQUIPMENT_IMAGE_BUCKET).upload(storagePath, buffer, {
    contentType: validation.mimeType,
    upsert: false,
    cacheControl: "3600",
  });

  if (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }

  const { data } = client.storage.from(EQUIPMENT_IMAGE_BUCKET).getPublicUrl(storagePath);

  return {
    imageUrl: data.publicUrl,
    imageStoragePath: storagePath,
    imageSource: input.source,
    imagePrompt: input.prompt?.trim() || null,
  };
}

export async function persistGeneratedEquipmentImage(input: PersistGeneratedEquipmentImageInput): Promise<EquipmentImageAsset> {
  const parsed = parseGeneratedDataUrl(input.dataUrl);
  const file = new File([parsed.buffer], `equipment-ai.${parsed.extension}`, { type: parsed.mimeType });
  return persistUploadedEquipmentImage({
    organizationId: input.organizationId,
    file,
    source: "ai",
    prompt: input.prompt,
  });
}

export async function removeEquipmentImageAsset(storagePath?: string | null) {
  if (!storagePath) return;
  try {
    const client = createAdminClient();
    await client.storage.from(EQUIPMENT_IMAGE_BUCKET).remove([storagePath]);
  } catch {
    // Storage cleanup should not break the main request path.
  }
}

function buildEquipmentImagePath(organizationId: string, source: EquipmentImageSource, extension: string) {
  const year = new Date().getUTCFullYear();
  return `organizations/${organizationId}/equipment/${year}/${source}-${randomUUID()}.${extension}`;
}

function parseGeneratedDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match?.[1] || !match[2]) {
    throw new Error("Generated image payload is invalid.");
  }

  const mimeType = match[1];
  if (!equipmentImageMimeTypes.has(mimeType)) {
    throw new Error("Generated image type is not supported.");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) {
    throw new Error("Generated image payload is empty.");
  }

  if (buffer.length > MAX_EQUIPMENT_IMAGE_BYTES) {
    throw new Error("Generated image is too large to store.");
  }

  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";

  return { buffer, mimeType, extension };
}
