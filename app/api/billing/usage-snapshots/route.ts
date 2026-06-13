import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
const superAdminRoles = ["super_admin"] as const;
import { takeUsageSnapshot, calculateOverageCharges, generateOverageInvoice } from "@/features/billing/services/usage-billing-service";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";

export async function POST(request: Request) {
  const ip = request.headers?.get?.("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`billing:usage-snapshots:${ip}`, "billing_api");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    if (body.action === "snapshot") {
      const result = await takeUsageSnapshot();
      return NextResponse.json({
        ok: true,
        snapshotsCreated: result.snapshotCount,
        overLimitFound: result.overLimitCount,
        errors: result.errors,
      });
    }

    if (body.action === "calculate-overage" && body.subscriptionId) {
      const overage = await calculateOverageCharges(body.subscriptionId);
      return NextResponse.json({ ok: true, ...overage });
    }

    if (body.action === "generate-overage-invoice" && body.subscriptionId) {
      const result = await generateOverageInvoice(body.subscriptionId);
      return result.ok
        ? NextResponse.json({ ok: true, message: result.message, invoiceId: result.invoiceId })
        : NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ error: "action, subscriptionId required" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
}
