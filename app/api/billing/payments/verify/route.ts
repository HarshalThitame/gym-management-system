import { NextResponse } from "next/server";
import { verifyPayment } from "@/features/billing/services/provider-payment-service";
import { requireApiAuth } from "@/lib/auth/api-guards";

export async function POST(request: Request) {
  const auth = await requireApiAuth({ unauthenticatedMessage: "Sign in before verifying payment." });
  if (!auth.ok) return auth.response;

  const body: { orderId: string; paymentId: string; signature: string } | null = await request.json().catch(() => null);
  if (!body?.orderId || !body?.paymentId || !body?.signature) {
    return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "orderId, paymentId, and signature are required." } }, { status: 400 });
  }

  const result = await verifyPayment(auth.context, {
    orderId: body.orderId,
    paymentId: body.paymentId,
    signature: body.signature,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { code: result.code, message: result.message } }, { status: result.status });
  }

  return NextResponse.json({ ok: true, data: result.data });
}
