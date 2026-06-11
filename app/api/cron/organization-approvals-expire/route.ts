import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type ApprovalExpiryRpcClient = {
  rpc(functionName: "expire_organization_approval_requests", args: { p_actor_id: string | null }): Promise<{
    data: number | null;
    error: { message: string } | null;
  }>;
};

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 503 });
  }

  const { data, error } = await (supabase as unknown as ApprovalExpiryRpcClient)
    .rpc("expire_organization_approval_requests", { p_actor_id: null });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    expired: data ?? 0
  });
}
