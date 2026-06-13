import { NextResponse } from "next/server";
import { checkDomainRegistrationExpiry } from "@/features/enterprise/services/domain-registration-service";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await checkDomainRegistrationExpiry();

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    summary: { expiringSoon: result.expiringSoon, expired: result.expired, ok: result.ok },
    errors: result.errors.length > 0 ? result.errors : undefined,
  });
}
