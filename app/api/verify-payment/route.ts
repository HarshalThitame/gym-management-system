import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { resolveStandardCheckoutCredentials } from "@/features/billing/razorpay/standard-checkout-env";

const verifyPaymentSchema = z.object({
  order_id: z.string().trim().min(1),
  payment_id: z.string().trim().min(1),
  razorpay_signature: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const auth = await requireApiAuth({ unauthenticatedMessage: "Sign in before verifying a Razorpay payment." });
  if (!auth.ok) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = verifyPaymentSchema.safeParse(normalizeVerifyPayload(body));
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Missing payment verification fields.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const credentials = resolveStandardCheckoutCredentials();
    const expected = crypto
      .createHmac("sha256", credentials.keySecret)
      .update(`${parsed.data.order_id}|${parsed.data.payment_id}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(parsed.data.razorpay_signature);
    const isValid = expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

    if (!isValid) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "SIGNATURE_MISMATCH",
            message: "Razorpay signature verification failed.",
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        verified: true,
        order_id: parsed.data.order_id,
        payment_id: parsed.data.payment_id,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Razorpay payment verification failed.";
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RAZORPAY_VERIFICATION_ERROR",
          message,
        },
      },
      { status: 500 },
    );
  }
}

function normalizeVerifyPayload(body: unknown) {
  if (!body || typeof body !== "object") {
    return body;
  }

  const record = body as Record<string, unknown>;
  return {
    order_id: record.order_id ?? record.orderId ?? "",
    payment_id: record.payment_id ?? record.paymentId ?? "",
    razorpay_signature: record.razorpay_signature ?? record.signature ?? "",
  };
}

