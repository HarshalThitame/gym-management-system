import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";
import { performMonthEndClose, getFinancialPeriods, openNewFinancialPeriod, getOpenFinancialPeriod } from "@/features/billing/services/month-end-close-service";

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`mec-get:${ip}`, "month_end_close");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });

  const gymId = req.nextUrl.searchParams.get("gymId");
  if (!gymId) return NextResponse.json({ error: "gymId query param required" }, { status: 400 });

  try {
    const periods = await getFinancialPeriods(gymId);
    const openPeriod = await getOpenFinancialPeriod(gymId);
    return NextResponse.json({ periods, openPeriod });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`mec-post:${ip}`, "month_end_close");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });

  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === "open_period") {
      const period = await openNewFinancialPeriod(body.gymId, body.periodStart, body.periodEnd);
      return NextResponse.json(period, { status: 201 });
    }

    if (action === "close_period") {
      const result = await performMonthEndClose(body.gymId, body.periodId, body.closedBy);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action. Use 'open_period' or 'close_period'." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
