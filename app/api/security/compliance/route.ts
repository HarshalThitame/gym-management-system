import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { getComplianceStatus, listComplianceReports, generateComplianceReport } from "@/features/security/services/security-compliance-service";

const roles = ["super_admin"] as const;

export async function GET() {
  const auth = await requireApiRole(roles, { unauthenticatedMessage: "Auth required.", forbiddenMessage: "Access denied." });
  if (!auth.ok) return auth.response;
  try {
    const [status, reports] = await Promise.all([getComplianceStatus(), listComplianceReports()]);
    return NextResponse.json({ ok: true, data: { status, reports } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "FETCH_ERROR", message: e instanceof Error ? e.message : "Failed" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRole(roles, { unauthenticatedMessage: "Auth required.", forbiddenMessage: "Access denied." });
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const report = await generateComplianceReport({
      report_type: body.reportType,
      title: body.title,
      period_start: body.periodStart,
      period_end: body.periodEnd,
      organization_id: body.organizationId ?? null,
      generated_by: auth.context.userId,
    });
    return NextResponse.json({ ok: true, data: report }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "ERROR", message: e instanceof Error ? e.message : "Failed" } }, { status: 500 });
  }
}
