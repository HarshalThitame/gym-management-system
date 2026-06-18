import { NextResponse } from "next/server";
import { CreateRazorpayOrderSchema } from "@/features/billing/schemas/payment";
import { createRazorpayOrderForPayment } from "@/features/billing/services/payment-processing";
import { getApiTenantOrganizationId, requireApiAuth } from "@/lib/auth/api-guards";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireApiFeatureAccess } from "@/features/entitlement";

export async function POST(request: Request) {
  const auth = await requireApiAuth({ unauthenticatedMessage: "Sign in before creating a payment order." });

  if (!auth.ok) {
    return auth.response;
  }

  const featureResponse = await requireRazorpayFeature(getApiTenantOrganizationId(auth.context, auth.tenant));
  if (featureResponse) {
    return featureResponse;
  }

  const rateLimit = await checkRateLimit(`razorpay-order:${auth.context.userId}`, 20, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many payment order requests." } }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = CreateRazorpayOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Payment order payload is invalid.", fieldErrors: parsed.error.flatten().fieldErrors } }, { status: 400 });
  }

  const result = await createRazorpayOrderForPayment(auth.context, parsed.data.paymentId);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { code: result.code, message: result.message } }, { status: result.status });
  }

  return NextResponse.json({ ok: true, data: result.data });
}

async function requireRazorpayFeature(organizationId: string | null) {
  if (!organizationId) {
    return NextResponse.json({ error: "FEATURE_LOCKED", reason: "UNAUTHORIZED_ORG_ACCESS", message: "Organization scope required.", featureKey: "razorpay_payu_integration" }, { status: 403 });
  }
  return requireApiFeatureAccess(organizationId, "razorpay_payu_integration");
}
