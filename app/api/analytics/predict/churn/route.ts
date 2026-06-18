/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireApiRole } from "@/lib/auth/api-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(["super_admin"]);
  if (!auth.ok) return auth.response;
  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");

  try {
    const { data, error } = await (supabase.rpc as any)("predict_churn_risk", {
      p_tenant_id: tenantId ?? null
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      predictions: data ?? [],
      generated_at: new Date().toISOString(),
      model_version: "2.0",
      total_members_at_risk: (data ?? []).filter((r: { risk_category: string }) => r.risk_category === "high" || r.risk_category === "critical").length
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
