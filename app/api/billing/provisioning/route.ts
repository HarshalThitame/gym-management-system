import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiRole } from "@/lib/auth/api-guards";
const superAdminRoles = ["super_admin"] as const;
import { executeProvisioningHooks } from "@/features/billing/services/provisioning-hook-service";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";

export async function GET() {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  const supabase = await createSupabaseServerClient();
  const db = supabase as never as {
    from(t: string): {
      select(c: string): {
        order(c: string, o: { ascending: boolean }): {
          limit(n: number): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
        };
      };
    };
  };

  const { data } = await db.from("provisioning_hooks").select("*").order("created_at", { ascending: false }).limit(100);
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const ip = request.headers?.get?.("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`billing:provisioning:${ip}`, "billing_api");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    if (body.action === "execute") {
      const result = await executeProvisioningHooks(body.organizationId, body.event, body.payload ?? {});
      return NextResponse.json({ ok: true, ...result });
    }

    const supabase = await createSupabaseServerClient();
    const db = supabase as never as {
      from(t: string): {
        insert(r: Record<string, unknown>): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };

    const { data, error } = await db.from("provisioning_hooks").insert({
      organization_id: body.organizationId,
      trigger_event: body.triggerEvent,
      hook_type: body.hookType,
      target_url: body.targetUrl ?? null,
      target_function: body.targetFunction ?? null,
      payload_template: body.payloadTemplate ?? {},
      headers: body.headers ?? {},
      is_active: body.isActive ?? true,
      retry_count: body.retryCount ?? 3,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
}
