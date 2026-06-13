import { NextResponse } from "next/server";
import { takeUsageSnapshot } from "@/features/billing/services/usage-billing-service";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await takeUsageSnapshot();
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    snapshotsCreated: result.snapshotCount,
    overLimit: result.overLimitCount,
    errors: result.errors.length > 0 ? result.errors : undefined,
  });
}
