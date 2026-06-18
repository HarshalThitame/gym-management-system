import { NextRequest, NextResponse } from "next/server";
import { getAssignedAddons } from "@/features/super-admin/services/subscription-addon-service";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth({ skipSubscriptionCheck: true });
  if (!auth.ok) return auth.response;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`subscription-addons:${ip}`, "subscription_addons");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });

  const subscriptionId = req.nextUrl.searchParams.get("subscriptionId") ?? "";
  if (!subscriptionId) return NextResponse.json({ error: "subscriptionId param is required" }, { status: 400 });

  try {
    const addons = await getAssignedAddons(subscriptionId);
    return NextResponse.json(addons);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
