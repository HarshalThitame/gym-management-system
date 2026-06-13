import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { getSupportDashboard } from "@/features/support/services/support-analytics-service";
import { getSlaDashboard } from "@/features/support/services/support-sla-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireApiRole(["super_admin", "organization_owner", "gym_admin"], {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Access denied.",
  });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "overview";
  const organizationId = url.searchParams.get("organizationId") ?? undefined;

  try {
    if (view === "sla") {
      const sla = await getSlaDashboard();
      return NextResponse.json({ ok: true, data: sla });
    }

    const dashboard = await getSupportDashboard(organizationId);
    return NextResponse.json({ ok: true, data: dashboard });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "FETCH_ERROR", message: e instanceof Error ? e.message : "Failed to fetch analytics." } }, { status: 500 });
  }
}
