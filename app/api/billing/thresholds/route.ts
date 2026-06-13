import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiRole } from "@/lib/auth/api-guards";
const superAdminRoles = ["super_admin"] as const;
import { createThreshold, deleteThreshold, evaluateThresholds } from "@/features/billing/services/billing-threshold-service";
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

  const { data } = await db.from("billing_thresholds").select("*").order("created_at", { ascending: false }).limit(100);
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const ip = request.headers?.get?.("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`billing:thresholds:${ip}`, "billing_api");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    if (body.action === "evaluate" && body.organizationId) {
      const results = await evaluateThresholds(body.organizationId);
      return NextResponse.json({ ok: true, results });
    }

    if (body.action === "delete" && body.thresholdId) {
      const result = await deleteThreshold(body.thresholdId);
      return result.ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: result.message }, { status: 400 });
    }

    const result = await createThreshold({
      organizationId: body.organizationId,
      thresholdType: body.thresholdType,
      thresholdValue: body.thresholdValue,
      comparison: body.comparison ?? "gte",
      notificationChannels: body.notificationChannels ?? ["email"],
      cooldownHours: body.cooldownHours ?? 24,
    });

    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ ok: true, thresholdId: result.thresholdId }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
}
