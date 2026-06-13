import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiRole } from "@/lib/auth/api-guards";
const superAdminRoles = ["super_admin"] as const;
import { createContract, getActiveContracts, signContract, terminateContract } from "@/features/billing/services/contract-service";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";

export async function GET(request: Request) {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("organizationId");

  if (orgId) {
    const contracts = await getActiveContracts(orgId);
    return NextResponse.json({ data: contracts });
  }

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

  const { data } = await db.from("org_contracts").select("*").order("created_at", { ascending: false }).limit(100);
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const ip = request.headers?.get?.("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`billing:contracts:${ip}`, "billing_api");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    if (body.action === "sign") {
      const result = await signContract(body.contractId, auth.context.userId, body.role ?? "provider");
      return result.ok
        ? NextResponse.json({ ok: true, message: result.message })
        : NextResponse.json({ error: result.message }, { status: 400 });
    }

    if (body.action === "terminate") {
      const result = await terminateContract(body.contractId);
      return result.ok
        ? NextResponse.json({ ok: true, message: result.message })
        : NextResponse.json({ error: result.message }, { status: 400 });
    }

    const result = await createContract({
      organizationId: body.organizationId,
      contractType: body.contractType,
      title: body.title,
      description: body.description ?? null,
      effectiveFrom: body.effectiveFrom,
      effectiveUntil: body.effectiveUntil ?? null,
      autoRenew: body.autoRenew ?? false,
      specialTerms: body.specialTerms ?? {},
      documentUrl: body.documentUrl ?? null,
      createdBy: auth.context.userId,
    });

    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ ok: true, contractId: result.contractId }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
}
