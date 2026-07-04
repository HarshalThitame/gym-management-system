import { NextResponse } from "next/server";
import { requireApiPrimaryRole, getApiTenantOrganizationId } from "@/lib/auth/api-guards";
import { requireApiFeatureAccess } from "@/features/entitlement";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";
import { assertFeature } from "@/lib/tenant";
import { generateEquipmentImagePreview } from "@/features/organization-owner/services/equipment-image-service";

export async function POST(request: Request) {
  const auth = await requireApiPrimaryRole(["organization_owner"], {
    unauthenticatedMessage: "Sign in to generate equipment images.",
    forbiddenMessage: "Only organization owners can generate equipment images.",
  });

  if (!auth.ok) return auth.response;

  const organizationId = getApiTenantOrganizationId(auth.context, auth.tenant);
  if (!organizationId) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const denied = await requireApiFeatureAccess(organizationId, "equipment_inventory_maintenance");
  if (denied) return denied;

  try {
    await assertFeature(organizationId, "aiEnabled");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI image generation is not available on your plan." },
      { status: 403 }
    );
  }

  const rateLimit = await checkRateLimit(`equipment-image-generate:${auth.context.userId}`, 6, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many image generations. Try again shortly." }, { status: 429 });
  }

  try {
    const body = await request.json() as {
      organizationId?: string;
      name?: string;
      equipmentType?: string;
      brand?: string | null;
      model?: string | null;
      customPrompt?: string | null;
    };

    if (body.organizationId !== organizationId) {
      return NextResponse.json({ error: "Organization scope mismatch." }, { status: 403 });
    }

    if (!body.name?.trim() || !body.equipmentType?.trim()) {
      return NextResponse.json({ error: "Equipment name and type are required to generate an image." }, { status: 400 });
    }

    if ((body.customPrompt?.length ?? 0) > 300) {
      return NextResponse.json({ error: "AI prompt refinement must be 300 characters or fewer." }, { status: 400 });
    }

    const preview = await generateEquipmentImagePreview({
      organizationId,
      name: body.name,
      equipmentType: body.equipmentType,
      brand: body.brand,
      model: body.model,
      customPrompt: body.customPrompt,
    });

    await writeAuditLog({
      actorId: auth.context.userId,
      action: "organization_owner.equipment_image_generated",
      entityType: "equipment_image",
      entityId: null,
      metadata: {
        organizationId,
        equipmentName: body.name,
        equipmentType: body.equipmentType,
        model: preview.model,
      },
    });

    return NextResponse.json({
      ok: true,
      imageDataUrl: preview.dataUrl,
      imagePrompt: preview.prompt,
      mimeType: preview.mimeType,
      model: preview.model,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed." },
      { status: 400 }
    );
  }
}
