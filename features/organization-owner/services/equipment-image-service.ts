import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateAllowedFile } from "@/lib/security/file-validation";

export const EQUIPMENT_IMAGE_BUCKET = "equipment-images";
export const equipmentImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_EQUIPMENT_IMAGE_BYTES = 4 * 1024 * 1024;

export type EquipmentImageSource = "upload" | "ai";

export type EquipmentImageAsset = {
  imageUrl: string;
  imageStoragePath: string;
  imageSource: EquipmentImageSource;
  imagePrompt: string | null;
};

type PersistUploadedEquipmentImageInput = {
  organizationId: string;
  file: File;
  source: EquipmentImageSource;
  prompt?: string | null;
};

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
