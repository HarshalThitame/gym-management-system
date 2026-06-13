import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiAuth } from "@/lib/auth/api-guards";

export async function GET(request: Request) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const domainId = searchParams.get("domainId");

  if (!domainId) return NextResponse.json({ error: "domainId required" }, { status: 400 });

  const supabase = await createSupabaseServerClient();

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
