import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { getSecurityDashboard, getSecurityKpis, getRecentSecurityEvents, getTenantRiskRanking } from "@/features/security/services/security-dashboard-service";

const roles = ["super_admin"] as const;

export async function GET() {
  const auth = await requireApiRole(roles, { unauthenticatedMessage: "Auth required.", forbiddenMessage: "Access denied." });
  if (!auth.ok) return auth.response;
  try {
    const [dashboard, events, tenantRisk] = await Promise.all([getSecurityDashboard(), getRecentSecurityEvents(20), getTenantRiskRanking()]);
    const kpis = await getSecurityKpis(dashboard);
    return NextResponse.json({ ok: true, data: { dashboard, kpis, events, tenantRisk } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "FETCH_ERROR", message: e instanceof Error ? e.message : "Failed" } }, { status: 500 });
  }
}
