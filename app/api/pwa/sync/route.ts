import { NextResponse } from "next/server";
import type { QueueableOfflineActionType } from "@/features/pwa/lib/business-rules";
import { OfflineSyncSchema } from "@/features/pwa/schemas/pwa";
import { getApiTenantBranchId, getApiTenantOrganizationId, requireApiAuth } from "@/lib/auth/api-guards";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

const allowedOfflineTargets: Record<QueueableOfflineActionType, { methods: Set<string>; prefixes: string[] }> = {
  workout_log: { methods: new Set(["POST", "PUT", "PATCH"]), prefixes: ["/member/workouts", "/member/fitness"] },
  nutrition_log: { methods: new Set(["POST", "PUT", "PATCH"]), prefixes: ["/member/fitness", "/member/nutrition"] },
  profile_update: { methods: new Set(["POST", "PUT", "PATCH"]), prefixes: ["/member/profile", "/member/settings"] },
  attendance_check_in: { methods: new Set(["POST"]), prefixes: ["/member/attendance", "/admin/attendance"] },
  attendance_check_out: { methods: new Set(["POST"]), prefixes: ["/member/attendance", "/admin/attendance"] },
  class_booking_request: { methods: new Set(["POST", "DELETE"]), prefixes: ["/member/classes"] }
};

export async function POST(request: Request) {
  const auth = await requireApiAuth({ unauthenticatedMessage: "Sign in before syncing offline actions." });

  if (!auth.ok) {
    return auth.response;
  }

  const userId = auth.context.userId;
  const rateLimit = await checkRateLimit(`pwa-sync:${userId}`, 30, 60_000);
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

  const invalidAction = parsed.data.actions.find((action) => !isAllowedOfflineAction(action));
  if (invalidAction) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "OFFLINE_ACTION_NOT_ALLOWED",
          message: "Offline sync contains an action that is not allowed for background processing."
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
  const organizationId = getApiTenantOrganizationId(auth.context, auth.tenant);
  const branchId = getApiTenantBranchId(auth.tenant);
  const rows = parsed.data.actions.map((action) => ({
    user_id: userId,
    organization_id: organizationId,
    branch_id: branchId,
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

function isAllowedOfflineAction(action: { type: QueueableOfflineActionType; endpoint: string; method: string }) {
  const target = allowedOfflineTargets[action.type];
  return target.methods.has(action.method) && target.prefixes.some((prefix) => action.endpoint === prefix || action.endpoint.startsWith(`${prefix}/`));
}
