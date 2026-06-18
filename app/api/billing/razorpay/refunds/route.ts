import { NextResponse } from "next/server";
import { CreateRazorpayRefundSchema } from "@/features/billing/schemas/payment";
import { createRazorpayRefundForPayment } from "@/features/billing/services/payment-processing";
import { getApiTenantOrganizationId, requireApiRole } from "@/lib/auth/api-guards";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireApiFeatureAccess } from "@/features/entitlement";

export async function POST(request: Request) {
  const auth = await requireApiRole(["super_admin", "organization_owner", "gym_admin"], {
    unauthenticatedMessage: "Only authorized admins can create refunds.",
    forbiddenMessage: "Only authorized admins can create refunds."
  });

  if (!auth.ok) {
    return auth.response;
  }

  const featureResponse = await requireRazorpayFeature(getApiTenantOrganizationId(auth.context, auth.tenant));
  if (featureResponse) {
    return featureResponse;
  }

  const rateLimit = await checkRateLimit(`razorpay-refund:${auth.context.userId}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many refund requests." } }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = CreateRazorpayRefundSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Refund payload is invalid.", fieldErrors: parsed.error.flatten().fieldErrors } }, { status: 400 });
  }

  const result = await createRazorpayRefundForPayment(auth.context, parsed.data);

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
