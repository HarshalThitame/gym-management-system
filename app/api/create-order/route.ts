import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { resolveStandardCheckoutCredentials } from "@/features/billing/razorpay/standard-checkout-env";

const createOrderSchema = z.object({
  amount: z.coerce.number().int().min(100, "Amount must be at least 100 paise"),
  currency: z.string().trim().min(3).max(3).default("INR"),
  receipt: z.string().trim().min(1).max(40),
});

export async function POST(request: Request) {
  const auth = await requireApiAuth({ unauthenticatedMessage: "Sign in before creating a Razorpay order." });
  if (!auth.ok) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid order request.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const credentials = resolveStandardCheckoutCredentials();
    const authHeader = Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        receipt: parsed.data.receipt,
      }),
    });

    if (response.status === 401) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Razorpay authentication failed. Check your key id and key secret.",
          },
        },
        { status: 401 },
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "RAZORPAY_ORDER_ERROR",
            message: text || `Razorpay order creation failed with status ${response.status}.`,
          },
        },
        { status: 500 },
      );
    }

    const data = await response.json() as { id: string; amount: number; currency: string };

    return NextResponse.json({
      ok: true,
      data: {
        order_id: data.id,
        amount: data.amount,
        currency: data.currency,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Razorpay order creation failed.";
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RAZORPAY_ORDER_ERROR",
          message,
        },
      },
      { status: 500 },
    );
  }
}

