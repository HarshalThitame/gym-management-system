import { NextRequest, NextResponse } from "next/server";
import { getAllPackages } from "@/features/super-admin/services/subscription-service";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth({ skipSubscriptionCheck: true });
  if (!auth.ok) return auth.response;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`subscription-packages:${ip}`, "subscription_packages");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });

  try {
    const packages = await getAllPackages();
    return NextResponse.json(packages);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
