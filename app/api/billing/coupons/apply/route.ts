import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateAndApplyCoupon, recordCouponUsage } from "@/features/billing/services/coupon-redemption-service";
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

  if (!profile?.gym_id) {
    return NextResponse.json({ error: "No gym scope" }, { status: 403 });
  }

  const body = await request.json() as { code: string; invoiceId: string };
  if (!body.code || !body.invoiceId) {
    return NextResponse.json({ error: "code and invoiceId are required" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, subtotal_amount, discount_amount, total_amount, amount_due, status, gym_id, member_id, notes")
    .eq("id", body.invoiceId)
    .maybeSingle() as never as {
    data: {
      id: string;
      subtotal_amount: number;
      discount_amount: number;
      total_amount: number | null;
      amount_due: number;
      status: string;
      gym_id: string;
      member_id: string;
      notes: string | null;
    } | null;
    error: unknown;
  };

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.gym_id !== profile.gym_id) return NextResponse.json({ error: "Invoice does not belong to your gym" }, { status: 403 });
  if (invoice.status === "paid" || invoice.status === "cancelled" || invoice.status === "refunded") {
    return NextResponse.json({ error: "Cannot apply promo code to a paid or cancelled invoice" }, { status: 400 });
  }
  if (invoice.notes && /\[COUPON:[^\]]+\]/.test(invoice.notes)) {
    return NextResponse.json({ ok: false, error: "A promo code has already been applied to this invoice. Remove it first." }, { status: 400 });
  }

  const originalAmount = invoice.total_amount ?? invoice.amount_due;

  const validation = await validateAndApplyCoupon({
    gymId: profile.gym_id,
    code: body.code,
    amount: originalAmount,
  });

  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.message });
  }

  const existingDiscount = invoice.discount_amount ?? 0;
  const newDiscount = existingDiscount + validation.coupon.appliedDiscount;

  const couponTag = `[COUPON:${validation.coupon.id}:${validation.coupon.code}:${validation.coupon.appliedDiscount}]`;
  const existingNotes = invoice.notes || "";
  const updatedNotes = existingNotes.length > 900 ? existingNotes.slice(0, 900) + couponTag : existingNotes + couponTag;

  const { error: updateError } = await admin
    .from("invoices")
    .update({ discount_amount: newDiscount, notes: updatedNotes } as never)
    .eq("id", body.invoiceId) as never as {
    error: { message: string } | null;
  };

  if (updateError) {
    billingLogger.error("apply-coupon", "Failed to update invoice discount", { invoiceId: body.invoiceId, error: updateError.message });
    return NextResponse.json({ error: "Failed to apply coupon" }, { status: 500 });
  }

  billingLogger.info("apply-coupon", "Coupon applied to invoice", {
    invoiceId: body.invoiceId,
    code: validation.coupon.code,
    discount: validation.coupon.appliedDiscount,
  });

  return NextResponse.json({
    ok: true,
    coupon: validation.coupon,
    newDiscountAmount: newDiscount,
  });
}
