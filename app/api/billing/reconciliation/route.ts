import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
const superAdminRoles = ["super_admin"] as const;
import { runDailyReconciliation, getReconciliationSummary, flagDiscrepancy, resolveDiscrepancy } from "@/features/billing/services/reconciliation-service";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";

export async function POST(request: Request) {
  const ip = request.headers?.get?.("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`billing:reconciliation:${ip}`, "billing_api");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    if (body.action === "flag" && body.reconciliationId) {
      const result = await flagDiscrepancy(body.reconciliationId, body.notes ?? "");
      return result.ok
        ? NextResponse.json({ ok: true, message: result.message })
        : NextResponse.json({ error: result.message }, { status: 400 });
    }

    if (body.action === "resolve" && body.reconciliationId) {
      const result = await resolveDiscrepancy(body.reconciliationId, body.notes ?? "", auth.context.userId);
      return result.ok
        ? NextResponse.json({ ok: true, message: result.message })
        : NextResponse.json({ error: result.message }, { status: 400 });
    }

    if (!body.gymId || !body.date) {
      return NextResponse.json({ error: "gymId and date are required." }, { status: 400 });
    }

    const result = await runDailyReconciliation(body.gymId, body.date, body.provider ?? "razorpay");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const gymId = searchParams.get("gymId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!gymId || !from || !to) {
    return NextResponse.json({ error: "gymId, from, and to query params required." }, { status: 400 });
  }

  const summary = await getReconciliationSummary(gymId, from, to);
  return NextResponse.json({ data: summary });
}
