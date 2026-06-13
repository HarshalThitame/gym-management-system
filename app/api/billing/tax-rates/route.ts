import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiRole } from "@/lib/auth/api-guards";
const superAdminRoles = ["super_admin"] as const;
import { getTaxRates } from "@/features/billing/services/tax-service";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";

export async function GET() {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  const rates = await getTaxRates();
  return NextResponse.json({ data: rates });
}

export async function POST(request: Request) {
  const ip = request.headers?.get?.("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`billing:tax-rates:${ip}`, "billing_api");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const supabase = await createSupabaseServerClient();
    const db = supabase as never as {
      from(t: string): {
        insert(r: Record<string, unknown>): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };

    const { data, error } = await db.from("tax_rates").insert({
      gym_id: body.gymId ?? null,
      name: body.name,
      description: body.description ?? null,
      rate_percent: body.ratePercent,
      tax_type: body.taxType ?? "gst",
      is_compound: body.isCompound ?? false,
      applies_to: body.appliesTo ?? ["membership", "subscription", "product"],
      effective_from: body.effectiveFrom ?? new Date().toISOString().slice(0, 10),
      effective_until: body.effectiveUntil ?? null,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
}
