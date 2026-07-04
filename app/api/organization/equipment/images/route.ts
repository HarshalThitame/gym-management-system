import { NextResponse } from "next/server";
import { requireApiPrimaryRole, getApiTenantOrganizationId } from "@/lib/auth/api-guards";
import { requireApiFeatureAccess } from "@/features/entitlement";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";
import {
  persistGeneratedEquipmentImage,
  persistUploadedEquipmentImage,
} from "@/features/organization-owner/services/equipment-image-service";

export async function POST(request: Request) {
  const auth = await requireApiPrimaryRole(["organization_owner"], {
    unauthenticatedMessage: "Sign in to manage equipment images.",
    forbiddenMessage: "Only organization owners can manage equipment images.",
  });

  if (!auth.ok) return auth.response;

  const organizationId = getApiTenantOrganizationId(auth.context, auth.tenant);
  if (!organizationId) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const denied = await requireApiFeatureAccess(organizationId, "equipment_inventory_maintenance");
  if (denied) return denied;

  const rateLimit = await checkRateLimit(`equipment-image-upload:${auth.context.userId}`, 12, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many image uploads. Try again in a minute." }, { status: 429 });
  }

  try {
    const formData = await request.formData();
    const requestedOrgId = String(formData.get("organizationId") ?? "");
    const source = String(formData.get("source") ?? "");

    if (requestedOrgId !== organizationId) {
      return NextResponse.json({ error: "Organization scope mismatch." }, { status: 403 });
    }

    if (source !== "upload" && source !== "ai") {
      return NextResponse.json({ error: "Invalid image source." }, { status: 400 });
    }

    const file = formData.get("file");
    const generatedDataUrl = formData.get("generatedDataUrl");
    const prompt = String(formData.get("prompt") ?? "");

    if (prompt.length > 500) {
      return NextResponse.json({ error: "Stored AI prompt must be 500 characters or fewer." }, { status: 400 });
    }

    const result = file instanceof File
      ? await persistUploadedEquipmentImage({
          organizationId,
          file,
          source: "upload",
        })
      : typeof generatedDataUrl === "string" && generatedDataUrl
      ? await persistGeneratedEquipmentImage({
          organizationId,
          dataUrl: generatedDataUrl,
          prompt,
        })
      : null;

    if (!result) {
      return NextResponse.json({ error: "Either file or generatedDataUrl is required." }, { status: 400 });
    }

    await writeAuditLog({
      actorId: auth.context.userId,
      action: "organization_owner.equipment_image_uploaded",
      entityType: "equipment_image",
      entityId: null,
      metadata: {
        organizationId,
        source: result.imageSource,
        storagePath: result.imageStoragePath,
      },
    });

    return NextResponse.json({
      ok: true,
      imageUrl: result.imageUrl,
      imageStoragePath: result.imageStoragePath,
      imageSource: result.imageSource,
      imagePrompt: result.imagePrompt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image upload failed." },
      { status: 400 }
    );
  }
}
