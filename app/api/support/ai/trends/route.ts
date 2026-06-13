import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { getTrendingIssues } from "@/features/support/services/support-ai-service";

export const runtime = "nodejs";

const roles = ["super_admin"] as const;

export async function GET(request: Request) {
  const auth = await requireApiRole(roles, {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Access denied.",
  });
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId") ?? undefined;
    const trends = await getTrendingIssues(organizationId);
    return NextResponse.json({ ok: true, data: trends });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "FETCH_ERROR", message: e instanceof Error ? e.message : "Failed to fetch trends." } }, { status: 500 });
  }
}
