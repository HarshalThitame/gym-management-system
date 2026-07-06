import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { processPendingCrmSyncJobs } from "@/features/integrations/services/crm-sync-service";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin client not configured" }, { status: 503 });
  }

  const results = await processPendingCrmSyncJobs(25);

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...results,
  });
}
