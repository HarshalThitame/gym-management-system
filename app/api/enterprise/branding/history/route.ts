import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { requireApiFeatureAccess } from "@/features/entitlement";

export async function GET(request: Request) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const configId = searchParams.get("configId");

  if (!configId) return NextResponse.json({ error: "configId required" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const db = supabase as never as { from(t: string): { select(c: string): { eq(c: string, v: unknown): { single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } } } };

  const { data: config } = await db.from("tenant_configs").select("*").eq("id", configId).single();
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orgId = config.organization_id as string;
  const denied = await requireApiFeatureAccess(orgId, "custom_branding");
  if (denied) return denied;

  const [domainsRes, eventsRes] = await Promise.all([
    supabase.from("tenant_domains").select("id, domain, status, ssl_status, is_primary").eq("organization_id", orgId),
    (supabase as never as { from(t: string): { select(c: string): { eq(k: string, v: string): { order(k2: string, o: { ascending: boolean }): { limit(n: number): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> } } } } }).from('subscription_events').select('event_type, reason, created_at').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(20),
  ]);

  return NextResponse.json({
    data: {
      config,
      domains: (domainsRes.data ?? []) as Array<Record<string, unknown>>,
      auditLog: (eventsRes.data ?? []) as Array<Record<string, unknown>>,
    },
  });
}
