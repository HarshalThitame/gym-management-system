import { NextResponse } from "next/server";
import { PushSubscriptionSchema } from "@/features/pwa/schemas/pwa";
import { getAuthContext } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const context = await getAuthContext();

  if (!context.isAuthenticated || !context.userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in to enable push notifications." } }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(`pwa-push:${context.userId}`, 12, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many push subscription requests." } }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = PushSubscriptionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Push subscription is invalid.",
          fieldErrors: parsed.error.flatten().fieldErrors
        }
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, data: { stored: false }, message: "Push subscription validated. Configure Supabase to persist it." });
  }

  const { error } = await supabase.from("pwa_push_subscriptions").upsert(
    {
      user_id: context.userId,
      organization_id: null,
      branch_id: null,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth_secret: parsed.data.keys.auth,
      user_agent: request.headers.get("user-agent"),
      status: "active",
      last_seen_at: new Date().toISOString()
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ ok: false, error: { code: "DATABASE_ERROR", message: "Push subscription could not be saved." } }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { stored: true } });
}

export async function DELETE(request: Request) {
  const context = await getAuthContext();

  if (!context.isAuthenticated || !context.userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in to manage push notifications." } }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const endpoint = body && typeof body === "object" && "endpoint" in body && typeof body.endpoint === "string" ? body.endpoint : null;

  if (!endpoint) {
    return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Endpoint is required." } }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, data: { revoked: false }, message: "Supabase is not configured." });
  }

  const { error } = await supabase
    .from("pwa_push_subscriptions")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("user_id", context.userId)
    .eq("endpoint", endpoint);

  if (error) {
    return NextResponse.json({ ok: false, error: { code: "DATABASE_ERROR", message: "Push subscription could not be revoked." } }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { revoked: true } });
}
