import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiRole } from "@/lib/auth/api-guards";
const superAdminRoles = ["super_admin"] as const;
import { openDispute, getDisputeSummary } from "@/features/billing/services/dispute-service";
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

  const { data } = await db.from("disputes").select("*").order("created_at", { ascending: false }).limit(100);
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const ip = request.headers?.get?.("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`billing:disputes:${ip}`, "billing_api");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    if (body.action === "summary" && body.gymId) {
      const summary = await getDisputeSummary(body.gymId);
      return NextResponse.json({ data: summary });
    }

    const result = await openDispute({
      gymId: body.gymId,
      paymentId: body.paymentId,
      invoiceId: body.invoiceId ?? null,
      memberId: body.memberId,
      reason: body.reason,
      description: body.description,
      amount: body.amount,
      currency: body.currency ?? "INR",
      evidenceNotes: body.evidenceNotes ?? null,
    });

    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ ok: true, disputeId: result.disputeId }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
}
