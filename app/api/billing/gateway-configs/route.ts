import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiRole } from "@/lib/auth/api-guards";
const superAdminRoles = ["super_admin"] as const;
import { getActiveGateway, setDefaultGateway, upsertGatewayConfig } from "@/features/billing/services/gateway-config-service";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";

export async function GET(request: Request) {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const gymId = searchParams.get("gymId");

  if (!gymId) return NextResponse.json({ error: "gymId query param required" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const db = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(c: string, v: unknown): {
          order(c: string, o: { ascending: boolean }): {
            limit(n: number): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
          };
        };
      };
    };
  };

  const { data } = await db.from("payment_gateway_configs").select("*").eq("gym_id", gymId).order("priority", { ascending: true }).limit(10);
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const ip = request.headers?.get?.("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`billing:gateway-configs:${ip}`, "billing_api");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    if (body.action === "set-default") {
      const result = await setDefaultGateway(body.gymId, body.provider);
      return result.ok
        ? NextResponse.json({ ok: true, message: result.message })
        : NextResponse.json({ error: result.message }, { status: 400 });
    }

    const result = await upsertGatewayConfig(body.gymId, body.provider, {
      apiKey: body.apiKey,
      secret: body.secret,
      webhookSecret: body.webhookSecret,
      supportedPaymentTypes: body.supportedPaymentTypes,
      testMode: body.testMode ?? true,
      priority: body.priority ?? 0,
    });

    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ ok: true, message: result.message });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
}
