import { NextResponse } from "next/server";
import { CreateRazorpayOrderSchema } from "@/features/billing/schemas/payment";
import { createRazorpayOrderForPayment } from "@/features/billing/services/payment-processing";
import { getAuthContext } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const context = await getAuthContext();

  if (!context.isAuthenticated || !context.userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in before creating a payment order." } }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(`razorpay-order:${context.userId}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many payment order requests." } }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = CreateRazorpayOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Payment order payload is invalid.", fieldErrors: parsed.error.flatten().fieldErrors } }, { status: 400 });
  }

  const result = await createRazorpayOrderForPayment(context, parsed.data.paymentId);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { code: result.code, message: result.message } }, { status: result.status });
  }

  return NextResponse.json({ ok: true, data: result.data });
}
