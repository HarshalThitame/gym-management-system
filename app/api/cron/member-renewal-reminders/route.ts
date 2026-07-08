import { NextResponse } from "next/server";
import { sendRenewalReminders } from "@/features/memberships/services/member-renewal-reminder-service";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendRenewalReminders();

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    sent: result.sent,
    errors: result.errors.length > 0 ? result.errors : undefined,
  });
}
