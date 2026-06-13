import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
const superAdminRoles = ["super_admin"] as const;
import { recognizeRevenue, runBatchRevenueRecognition } from "@/features/billing/services/revenue-recognition-service";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";

export async function POST(request: Request) {
  const ip = request.headers?.get?.("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`billing:revenue-recognition:${ip}`, "billing_api");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    if (body.action === "batch") {
      const result = await runBatchRevenueRecognition();
      return NextResponse.json({ ok: true, processed: result.processed, errors: result.errors });
    }

    if (!body.invoiceId) {
      return NextResponse.json({ error: "invoiceId is required for single recognition." }, { status: 400 });
    }

    const result = await recognizeRevenue(body.invoiceId);
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ ok: true, message: result.message, schedule: result.schedule });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
}
