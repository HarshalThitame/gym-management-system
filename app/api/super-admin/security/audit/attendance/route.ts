import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";
import { searchAttendanceAuditDrilldown } from "@/features/security/services/attendance-audit-service";

export async function GET(req: NextRequest) {
  const auth = await requireApiRole(["super_admin"], {});
  if (!auth.ok) return auth.response;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`super-admin-attendance-audit:${ip}`, "audit_logs");
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  }

  const url = new URL(req.url);
  try {
    const result = await searchAttendanceAuditDrilldown({
      page: Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1,
      pageSize: Number.parseInt(url.searchParams.get("pageSize") ?? "25", 10) || 25,
      search: url.searchParams.get("search") ?? undefined,
      actorId: url.searchParams.get("actorId") ?? undefined,
      branchId: url.searchParams.get("branchId") ?? undefined,
      entityType: url.searchParams.get("entityType") ?? undefined,
      entityId: url.searchParams.get("entityId") ?? undefined,
      workflow: url.searchParams.get("workflow") ?? undefined,
      reasonCode: url.searchParams.get("reasonCode") ?? undefined,
      decision: url.searchParams.get("decision") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
