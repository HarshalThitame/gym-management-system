import { NextResponse } from "next/server";
import { runBatchRevenueRecognition } from "@/features/billing/services/revenue-recognition-service";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runBatchRevenueRecognition();
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    processed: result.processed,
    errors: result.errors.length > 0 ? result.errors : undefined,
  });
}
