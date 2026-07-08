import { NextResponse } from "next/server";
import { createRefund } from "@/features/billing/services/provider-payment-service";
import { requireApiAuth } from "@/lib/auth/api-guards";

export async function POST(request: Request) {
  const auth = await requireApiAuth({ unauthenticatedMessage: "Sign in before issuing a refund." });
  if (!auth.ok) return auth.response;

  const body: { paymentId: string; amount: number; reason: string } | null = await request.json().catch(() => null);
  if (!body?.paymentId || !body?.amount || !body?.reason) {
    return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "paymentId, amount, and reason are required." } }, { status: 400 });
  }

  const result = await createRefund(auth.context, {
    paymentId: body.paymentId,
    amount: body.amount,
    reason: body.reason,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { code: result.code, message: result.message } }, { status: result.status });
  }

  return NextResponse.json({ ok: true, data: result.data });
}
