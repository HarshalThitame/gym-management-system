import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { CreateRazorpayOrderSchema } from "@/features/billing/schemas/payment";
import { createPaymentOrder } from "@/features/billing/services/provider-payment-service";
import { getApiTenantOrganizationId, requireApiAuth } from "@/lib/auth/api-guards";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPayuConfig, getPayuApiBaseUrl } from "@/features/billing/payu/payu-config";

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

  const { provider, keyId, paymentId, orderId, amount, currency } = result.data;

  if (provider === "payu") {
    try {
      const config = getPayuConfig();
      const baseUrl = getPayuApiBaseUrl(config.environment);

      const amountInRupees = (amount / 100).toFixed(2);
      const productinfo = "Membership payment";
      const firstname = body?.payerName || "Member";
      const email = body?.payerEmail || "member@example.com";
      const phone = body?.payerPhone || "9999999999";

      const hashString = `${config.merchantKey}|${orderId}|${amountInRupees}|${productinfo}|${firstname}|${email}|||||||||||${config.merchantSalt}`;
      const hash = crypto.createHash("sha512").update(hashString).digest("hex");

      const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/member/payments?payment_success=1`;

      return NextResponse.json({
        ok: true,
        data: {
          provider: "payu" as const,
          paymentId,
          orderId,
          checkoutForm: {
            action: `${baseUrl}/_payment`,
            fields: {
              key: config.merchantKey,
              txnid: orderId,
              amount: amountInRupees,
              productinfo,
              firstname,
              email,
              phone,
              surl: callbackUrl,
              furl: callbackUrl,
              hash,
              service_provider: "payu_paisa",
            },
          },
        },
      });
    } catch {
      return NextResponse.json({ ok: false, error: { code: "PAYU_CONFIG_ERROR", message: "PayU configuration error." } }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      provider: "razorpay" as const,
      keyId,
      paymentId,
      orderId,
      amount,
      currency,
    },
  });
}
