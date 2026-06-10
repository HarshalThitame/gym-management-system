import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { hasRequiredRole } from "@/lib/rbac";
import { membershipRowsToCsv } from "@/features/memberships/lib/csv";
import { getMembershipReportRows } from "@/features/memberships/services/membership-service";

const reportTypes = ["active", "expired", "upcoming", "revenue", "growth"] as const;

export async function GET(request: NextRequest) {
  const context = await getAuthContext();

  if (!context.isAuthenticated || !hasRequiredRole(context.roles, ["super_admin", "gym_admin", "reception_staff"])) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type") ?? "active";
  const reportType = reportTypes.includes(type as (typeof reportTypes)[number]) ? type as (typeof reportTypes)[number] : "active";
  const rows = await getMembershipReportRows({
    gymId: context.profile?.gym_id ?? null,
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
