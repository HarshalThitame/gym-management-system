import { NextRequest, NextResponse } from "next/server";
import { getOrgUsage } from "@/features/super-admin/services/subscription-usage-service";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`subscription-usage:${ip}`, "subscription_usage");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });

  const organizationId = req.nextUrl.searchParams.get("organizationId") ?? "";
  if (!organizationId) return NextResponse.json({ error: "organizationId param is required" }, { status: 400 });

  try {
    const usage = await getOrgUsage(organizationId);
    return NextResponse.json(usage);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
