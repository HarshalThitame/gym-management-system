import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";
import {
  getPaymentMethods,
  savePaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
} from "@/features/billing/services/payment-method-service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`org-pm-get:${ip}`, "payment_methods");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });

  const { orgId } = await params;
  try {
    const methods = await getPaymentMethods(orgId);
    return NextResponse.json(methods);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`org-pm-post:${ip}`, "payment_methods");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });

  const { orgId } = await params;
  try {
    const body = await req.json();
    const method = await savePaymentMethod(orgId, {
      provider: body.provider ?? "razorpay",
      provider_customer_id: body.provider_customer_id,
      provider_payment_method_id: body.provider_payment_method_id,
      provider_mandate_id: body.provider_mandate_id,
      mandate_status: body.mandate_status,
      payment_type: body.payment_type,
      display_name: body.display_name,
      last_four: body.last_four,
      expiry_month: body.expiry_month,
      expiry_year: body.expiry_year,
      card_network: body.card_network,
      is_default: body.is_default,
      metadata: body.metadata,
    });
    return NextResponse.json(method, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`org-pm-del:${ip}`, "payment_methods");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });

  const { orgId } = await params;
  try {
    const methodId = req.nextUrl.searchParams.get("methodId");
    if (!methodId) return NextResponse.json({ error: "methodId query param required" }, { status: 400 });
    await deletePaymentMethod(orgId, methodId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`org-pm-patch:${ip}`, "payment_methods");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });

  const { orgId } = await params;
  try {
    const body = await req.json();
    if (body.action === "set_default") {
      await setDefaultPaymentMethod(orgId, body.methodId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
