import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { billingLogger } from "@/features/billing/lib/logger";

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

  if (!profile?.gym_id) return NextResponse.json({ error: "No gym scope" }, { status: 403 });

  const body = await request.json() as { invoiceId: string };
  if (!body.invoiceId) return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, discount_amount, notes, status, gym_id")
    .eq("id", body.invoiceId)
    .maybeSingle() as never as {
    data: { id: string; discount_amount: number; notes: string | null; status: string; gym_id: string } | null;
    error: unknown;
  };

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.gym_id !== profile.gym_id) return NextResponse.json({ error: "Invoice does not belong to your gym" }, { status: 403 });

  const couponMatch = invoice.notes?.match(/\[COUPON:([^\]]+):([^\]]+):(\d+)\]/);
  if (!couponMatch) return NextResponse.json({ ok: false, error: "No promo code applied to this invoice" });

  const appliedDiscount = parseInt(couponMatch[3], 10);
  const newDiscountAmount = Math.max((invoice.discount_amount ?? 0) - appliedDiscount, 0);
  const cleanedNotes = (invoice.notes ?? "").replace(/\[COUPON:[^\]]+\]/, "").trim();

  await admin.from("invoices").update({
    discount_amount: newDiscountAmount,
    notes: cleanedNotes || null,
  } as never).eq("id", body.invoiceId);

  billingLogger.info("remove-coupon", "Coupon removed from invoice", {
    invoiceId: body.invoiceId,
    removedDiscount: appliedDiscount,
  });

  return NextResponse.json({ ok: true, newDiscountAmount });
}
