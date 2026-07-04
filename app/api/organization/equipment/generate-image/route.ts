import { NextRequest, NextResponse } from "next/server";
import { requireApiPrimaryRole, getApiTenantOrganizationId } from "@/lib/auth/api-guards";
import { requireApiFeatureAccess } from "@/features/entitlement";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertFeature } from "@/lib/tenant";
import {
  createEquipmentImageJob,
  getActiveJobForUser,
  processJob,
} from "@/features/organization-owner/services/equipment-image-job-service";

export async function POST(request: NextRequest) {
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

  const rateLimit = await checkRateLimit(`equipment-image-generate:${auth.context.userId}`, 12, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many image generation requests. Try again shortly." }, { status: 429 });
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

    const existingJob = await getActiveJobForUser(
      organizationId,
      auth.context.userId,
      body.name.trim(),
      body.equipmentType.trim(),
      body.brand || null,
      body.model || null,
      body.customPrompt || null,
    );

    if (existingJob) {
      request.waitUntil(processJob(existingJob.id));

      return NextResponse.json({
        jobId: existingJob.id,
        status: existingJob.status,
      });
    }

    const job = await createEquipmentImageJob({
      organizationId,
      requestedBy: auth.context.userId,
      equipmentName: body.name.trim(),
      equipmentType: body.equipmentType.trim(),
      brand: body.brand || null,
      model: body.model || null,
      customPrompt: body.customPrompt || null,
    });

    request.waitUntil(processJob(job.jobId));

    return NextResponse.json({
      jobId: job.jobId,
      status: job.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation request failed." },
      { status: 400 }
    );
  }
}
