import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireApiPermission,
  getApiTenantOrganizationId,
  requireApiTenantGymScope,
} from "@/lib/auth/api-guards";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiPermission("attendance", "read");
    if (!auth.ok) return auth.response;

    const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
    if (!gymScope.ok) return gymScope.response;

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branch_id");
    const hours = Math.min(Math.max(1, parseInt(searchParams.get("hours") || "24")), 168);

    const supabase = createAdminClient();
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data: insideNow, error: insideError } = await supabase
      .from("attendance_sessions")
      .select("id, branch_id")
      .eq("gym_id", gymScope.gymId)
      .eq("status", "inside");

    if (insideError) {
      return NextResponse.json(
        { ok: false, error: { code: "QUERY_FAILED", message: insideError.message } },
        { status: 500 }
      );
    }

    let snapQuery = supabase
      .from("occupancy_log")
      .select("*")
      .eq("gym_id", gymScope.gymId)
      .gte("timestamp", since)
      .order("timestamp", { ascending: true });

    if (branchId) snapQuery = snapQuery.eq("branch_id", branchId);

    const { data: snapshots, error: snapError } = await snapQuery;

    if (snapError) {
      return NextResponse.json(
        { ok: false, error: { code: "QUERY_FAILED", message: snapError.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        currentlyInside: insideNow?.length || 0,
        currentByBranch: (insideNow || []).reduce<Record<string, number>>((acc, s) => {
          const b = s.branch_id || "unknown";
          acc[b] = (acc[b] || 0) + 1;
          return acc;
        }, {}),
        snapshots: snapshots || [],
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}
