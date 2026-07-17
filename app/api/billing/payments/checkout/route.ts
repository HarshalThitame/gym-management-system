import { NextResponse } from "next/server";
import { CreateRazorpayOrderSchema } from "@/features/billing/schemas/payment";
import { createPaymentOrder } from "@/features/billing/services/provider-payment-service";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const auth = await requireApiAuth({ unauthenticatedMessage: "Sign in before creating a payment order." });
  if (!auth.ok) return auth.response;

  const rateLimit = await checkRateLimit(`payment-checkout:${auth.context.userId}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many payment requests." } }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = CreateRazorpayOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid payment request." } }, { status: 400 });
  }

  const result = await createPaymentOrder(auth.context, parsed.data.paymentId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { code: result.code, message: result.message } }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    data: result.data,
  });
}
