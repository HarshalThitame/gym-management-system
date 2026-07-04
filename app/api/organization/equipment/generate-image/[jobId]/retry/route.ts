import { NextRequest, NextResponse } from "next/server";
import { requireApiPrimaryRole, getApiTenantOrganizationId } from "@/lib/auth/api-guards";
import {
  retryEquipmentImageJob,
  processJob,
} from "@/features/organization-owner/services/equipment-image-job-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const auth = await requireApiPrimaryRole(["organization_owner"], {
    unauthenticatedMessage: "Sign in to retry image generation.",
    forbiddenMessage: "Only organization owners can retry image generation.",
  });

  if (!auth.ok) return auth.response;

  const organizationId = getApiTenantOrganizationId(auth.context, auth.tenant);
  if (!organizationId) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const { jobId } = await params;

  if (!jobId) {
    return NextResponse.json({ error: "Job ID is required." }, { status: 400 });
  }

  try {
    const result = await retryEquipmentImageJob(jobId, organizationId, auth.context.userId);

    request.waitUntil(processJob(jobId));

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to retry image generation." },
      { status: 400 }
    );
  }
}
