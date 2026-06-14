import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionEvents } from "@/features/super-admin/services/subscription-events-service";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";

function isOrgAccessible(context: { roles: readonly string[]; organizationId: string | null }, orgId: string): boolean {
  if (context.roles.includes("super_admin")) return true;
  return context.organizationId === orgId;
}

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`subscription-events:${ip}`, "subscription_events");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });

  const organizationId = req.nextUrl.searchParams.get("organizationId") ?? "";
  if (!organizationId) return NextResponse.json({ error: "organizationId param is required" }, { status: 400 });

  if (!isOrgAccessible(auth.context, organizationId)) {
    return NextResponse.json({ error: "Access denied to this organization's subscription events" }, { status: 403 });
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 50, 100);
  const offset = Number(req.nextUrl.searchParams.get("offset")) || 0;

  try {
    const events = await getSubscriptionEvents(organizationId, { limit, offset });
    return NextResponse.json(events);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
