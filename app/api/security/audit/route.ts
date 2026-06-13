import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { searchAuditLogs } from "@/features/security/services/security-audit-service";

const roles = ["super_admin"] as const;

export async function GET(request: Request) {
  const auth = await requireApiRole(roles, { unauthenticatedMessage: "Auth required.", forbiddenMessage: "Access denied." });
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(request.url);
    const opts: Record<string, unknown> = { page: Number(url.searchParams.get("page") ?? "1"), pageSize: Number(url.searchParams.get("pageSize") ?? "50") };
    const userId = url.searchParams.get("userId"); if (userId) opts.userId = userId;
    const orgId = url.searchParams.get("organizationId"); if (orgId) opts.organizationId = orgId;
    const action = url.searchParams.get("action"); if (action) opts.action = action;
    const entityType = url.searchParams.get("entityType"); if (entityType) opts.entityType = entityType;
    const dateFrom = url.searchParams.get("dateFrom"); if (dateFrom) opts.dateFrom = dateFrom;
    const dateTo = url.searchParams.get("dateTo"); if (dateTo) opts.dateTo = dateTo;
    const result = await searchAuditLogs(opts as never);
    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "FETCH_ERROR", message: e instanceof Error ? e.message : "Failed" } }, { status: 500 });
  }
}
