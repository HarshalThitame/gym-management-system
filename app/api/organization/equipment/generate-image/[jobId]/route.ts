import { NextResponse } from "next/server";
import { requireApiPrimaryRole, getApiTenantOrganizationId } from "@/lib/auth/api-guards";
import { getEquipmentImageJobStatus } from "@/features/organization-owner/services/equipment-image-job-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const auth = await requireApiPrimaryRole(["organization_owner"], {
    unauthenticatedMessage: "Sign in to check image generation status.",
    forbiddenMessage: "Only organization owners can check image generation status.",
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

  const jobStatus = await getEquipmentImageJobStatus(jobId, organizationId);

  if (!jobStatus) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  return NextResponse.json(jobStatus);
}
