import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateAndApplyCoupon } from "@/features/billing/services/coupon-redemption-service";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("gym_id")
    .eq("id", user.id)
    .maybeSingle() as never as {
    data: { gym_id: string | null } | null;
    error: unknown;
  };

  if (!profile?.gym_id) {
    return NextResponse.json({ error: "No gym scope" }, { status: 403 });
  }

  const body = await request.json() as { code: string; amount: number };
  if (!body.code || typeof body.amount !== "number" || body.amount <= 0) {
    return NextResponse.json({ error: "code and amount are required" }, { status: 400 });
  }

  const result = await validateAndApplyCoupon({
    gymId: profile.gym_id,
    code: body.code,
    amount: body.amount,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.message });
  }

  return NextResponse.json({ ok: true, coupon: result.coupon });
}
