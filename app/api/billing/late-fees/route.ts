import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiRole } from "@/lib/auth/api-guards";
const superAdminRoles = ["super_admin"] as const;
import { applyLateFeesToOverdueInvoices } from "@/features/billing/services/late-fee-service";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";

export async function GET() {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  const supabase = await createSupabaseServerClient();
  const db = supabase as never as {
    from(t: string): {
      select(c: string): {
        order(c: string, o: { ascending: boolean }): {
          limit(n: number): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
        };
      };
    };
  };

  const { data } = await db.from("late_fee_policies").select("*").order("created_at", { ascending: false }).limit(100);
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const ip = request.headers?.get?.("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`billing:late-fees:${ip}`, "billing_api");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    if (body.action === "apply") {
      const result = await applyLateFeesToOverdueInvoices();
      return NextResponse.json({ ok: true, applied: result.applied, errors: result.errors });
    }

    const supabase = await createSupabaseServerClient();
    const db = supabase as never as {
      from(t: string): {
        insert(r: Record<string, unknown>): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };

    const { data, error } = await db.from("late_fee_policies").insert({
      gym_id: body.gymId,
      name: body.name,
      fee_type: body.feeType,
      fee_amount: body.feeAmount ?? 0,
      fee_percent: body.feePercent ?? 0,
      grace_period_days: body.gracePeriodDays ?? 0,
      max_fee_amount: body.maxFeeAmount ?? null,
      recurrence: body.recurrence ?? "one_time",
      applies_to: body.appliesTo ?? ["invoice", "subscription"],
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
}
