import { NextResponse, type NextRequest } from "next/server";
import { getApiTenantOrganizationId, requireApiPermission, requireApiTenantGymScope } from "@/lib/auth/api-guards";
import { requireApiFeatureAccessAll } from "@/features/entitlement";
import { membershipRowsToCsv } from "@/features/memberships/lib/csv";
import { getMembershipReportRows } from "@/features/memberships/services/membership-service";

const reportTypes = ["active", "expired", "upcoming", "revenue", "growth"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("reports", "export");

  if (!auth.ok) {
    return auth.response;
  }
  const organizationId = getApiTenantOrganizationId(auth.context, auth.tenant);
  if (!organizationId) return NextResponse.json({ error: "Organization scope required." }, { status: 403 });
  const featureDenied = await requireApiFeatureAccessAll(organizationId, ["member_management", "basic_reports"]);
  if (featureDenied) return featureDenied;

  const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
  if (!gymScope.ok) {
    return gymScope.response;
  }

  const type = request.nextUrl.searchParams.get("type") ?? "active";
  const reportType = reportTypes.includes(type as (typeof reportTypes)[number]) ? type as (typeof reportTypes)[number] : "active";
  const rows = await getMembershipReportRows({
    gymId: gymScope.gymId,
    type: reportType
  });
  const csv = membershipRowsToCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="membership-${reportType}-report.csv"`
    }
  });
}
