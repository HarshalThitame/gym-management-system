import { NextResponse } from "next/server";
import { runMemberAutoRenewal } from "@/features/memberships/services/member-auto-renewal-service";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runMemberAutoRenewal();

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    renewed: result.renewed,
    skipped: result.skipped,
    errors: result.errors.length > 0 ? result.errors : undefined,
  });
}
