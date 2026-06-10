import { NextResponse } from "next/server";
import { OfflineSyncSchema } from "@/features/pwa/schemas/pwa";
import { getAuthContext } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export async function POST(request: Request) {
  const context = await getAuthContext();

  if (!context.isAuthenticated || !context.userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in before syncing offline actions." } }, { status: 401 });
  }

  const userId = context.userId;
  const rateLimit = checkRateLimit(`pwa-sync:${userId}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many sync requests." } }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = OfflineSyncSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Offline sync payload is invalid.",
          fieldErrors: parsed.error.flatten().fieldErrors
        }
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      processedIds: parsed.data.actions.map((action) => action.id),
      data: { stored: false },
      message: "Offline actions validated. Configure Supabase to persist sync events."
    });
  }

  const receivedAt = new Date().toISOString();
  const rows = parsed.data.actions.map((action) => ({
    user_id: userId,
    organization_id: null,
    branch_id: null,
    client_action_id: action.id,
    action_type: action.type,
    endpoint: action.endpoint,
    method: action.method,
    payload: toJson(action.payload),
    idempotency_key: action.idempotencyKey,
    status: "accepted" as const,
    created_offline_at: action.createdAt,
    received_at: receivedAt
  }));

  const { error } = await supabase.from("pwa_offline_actions").upsert(rows, { onConflict: "user_id,idempotency_key" });

  if (error) {
    return NextResponse.json({ ok: false, error: { code: "DATABASE_ERROR", message: "Offline actions could not be saved." } }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    processedIds: parsed.data.actions.map((action) => action.id),
    data: {
      stored: true,
      accepted: parsed.data.actions.length
    }
  });
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
