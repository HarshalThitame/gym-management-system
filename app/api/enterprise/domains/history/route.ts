import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { requireApiFeatureAccess } from "@/features/entitlement";

export async function GET(request: Request) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const domainId = searchParams.get("domainId");

  if (!domainId) return NextResponse.json({ error: "domainId required" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: domain } = await supabase.from("tenant_domains").select("organization_id").eq("id", domainId).maybeSingle();
  if (!domain) return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  const denied = await requireApiFeatureAccess(domain.organization_id, "custom_domain");
  if (denied) return denied;

  const { data: checks } = await supabase
    .from("tenant_domain_checks")
    .select("*")
    .eq("tenant_domain_id", domainId)
    .order("checked_at", { ascending: false })
    .limit(50);

  const { data: providerEvents } = await supabase
    .from("tenant_domain_provider_events")
    .select("*")
    .eq("tenant_domain_id", domainId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ data: { checks: checks ?? [], providerEvents: providerEvents ?? [] } });
}
