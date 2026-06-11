import { NextResponse } from "next/server";
import { getInstallPlatform } from "@/features/pwa/lib/business-rules";
import { PwaMetricSchema } from "@/features/pwa/schemas/pwa";
import { getApiTenantBranchId, getApiTenantOrganizationId, getOptionalApiAuth } from "@/lib/auth/api-guards";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIpFromHeaders } from "@/lib/security/request";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export async function POST(request: Request) {
  const ip = getClientIpFromHeaders(request.headers);
  const rateLimit = await checkRateLimit(`pwa-analytics:${ip}`, 60, 60_000);

  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many mobile analytics events." } }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = PwaMetricSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Mobile analytics payload is invalid.",
          fieldErrors: parsed.error.flatten().fieldErrors
        }
      },
      { status: 400 }
    );
  }

  const auth = await getOptionalApiAuth();

  if (!auth.ok) {
    return auth.response;
  }

  if (!auth.context || !auth.tenant) {
    return NextResponse.json({ ok: true, data: { stored: false, anonymous: true } });
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ ok: true, data: { stored: false } });
  }

  const { error } = await supabase.from("pwa_install_events").insert({
    user_id: auth.context.userId,
    organization_id: getApiTenantOrganizationId(auth.context, auth.tenant),
    branch_id: getApiTenantBranchId(auth.tenant),
    client_event_id: parsed.data.id,
    event_type: parsed.data.eventType,
    route: parsed.data.route,
    platform: getInstallPlatform(request.headers.get("user-agent") ?? ""),
    metadata: toJson(parsed.data.metadata),
    occurred_at: parsed.data.createdAt
  });

  if (error) {
    return NextResponse.json({ ok: false, error: { code: "DATABASE_ERROR", message: "Mobile analytics event could not be stored." } }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { stored: true } });
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
