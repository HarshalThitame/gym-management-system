import { NextResponse } from "next/server";
import { CreateRazorpayRefundSchema } from "@/features/billing/schemas/payment";
import { createRazorpayRefundForPayment } from "@/features/billing/services/payment-processing";
import { getAuthContext } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { hasRequiredRole } from "@/lib/rbac";

export async function POST(request: Request) {
  const context = await getAuthContext();

  if (!context.isAuthenticated || !context.userId || !hasRequiredRole(context.roles, ["super_admin", "gym_admin"])) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Only authorized admins can create refunds." } }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(`razorpay-refund:${context.userId}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many refund requests." } }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = CreateRazorpayRefundSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Refund payload is invalid.", fieldErrors: parsed.error.flatten().fieldErrors } }, { status: 400 });
  }

  const result = await createRazorpayRefundForPayment(context, parsed.data);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { code: result.code, message: result.message } }, { status: result.status });
  }

  return NextResponse.json({ ok: true, data: result.data });
}
