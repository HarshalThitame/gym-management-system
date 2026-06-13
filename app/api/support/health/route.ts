import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { getCustomerHealth, computeHealthScore } from "@/features/support/services/support-customer-health-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireApiRole(["super_admin", "organization_owner", "gym_admin"], {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Access denied.",
  });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");
  const organizationId = url.searchParams.get("organizationId");

  if (!customerId || !organizationId) {
    return NextResponse.json({ ok: false, error: { code: "MISSING_PARAMS", message: "customerId and organizationId required." } }, { status: 400 });
  }

  try {
    const health = await getCustomerHealth(customerId, organizationId);
    return NextResponse.json({ ok: true, data: health });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "FETCH_ERROR", message: e instanceof Error ? e.message : "Failed to fetch health data." } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["super_admin"], {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Only super admins can recompute health scores.",
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as { customerId: string; organizationId: string };
    await computeHealthScore(body.customerId, body.organizationId);
    return NextResponse.json({ ok: true, message: "Health score recomputed." });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "COMPUTE_ERROR", message: e instanceof Error ? e.message : "Failed to compute health score." } }, { status: 500 });
  }
}
