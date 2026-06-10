import { NextResponse } from "next/server";
import { processRazorpayWebhook } from "@/features/billing/services/payment-processing";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const signature = request.headers.get("x-razorpay-signature");
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = await checkRateLimit(`razorpay-webhook:${forwardedFor}`, 120, 60_000);

  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many webhook requests." } }, { status: 429 });
  }

  const rawBody = await request.text();
  const result = await processRazorpayWebhook(rawBody, signature);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: { code: result.code, message: result.message } }, { status: result.status });
  }

  return NextResponse.json({ ok: true, data: result.data });
}
