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
  const { data: domain } = await supabase.from("tenant_domains").select("*").eq("id", domainId).single();
  if (!domain) return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  const denied = await requireApiFeatureAccess(domain.organization_id, "custom_domain");
  if (denied) return denied;

  const d = domain as unknown as { domain: string; verification_token?: string };

  const records = [
    { type: "A", name: d.domain, ttl: 3600, value: "76.76.21.21", comment: "Apex domain" },
    { type: "CNAME", name: `www.${d.domain}`, ttl: 3600, value: `${d.domain}.`, comment: "WWW subdomain" },
    { type: "TXT", name: `_apex-verify.${d.domain}`, ttl: 3600, value: `apex-verify=${d.verification_token ?? ""}`, comment: "Domain ownership verification" },
  ];

  const zoneHeader = `; BIND zone file for ${d.domain}
; Generated ${new Date().toISOString()}
; TTL: 3600
$ORIGIN ${d.domain}.
$TTL 3600

`;

  const zoneRecords = records
    .map((r) => `${r.name.endsWith(d.domain) ? r.name.slice(0, -(d.domain.length + 1)) : r.name}  ${r.ttl}  IN  ${r.type}  ${r.value}  ; ${r.comment}`)
    .join("\n");

  const zoneFile = zoneHeader + zoneRecords + "\n";

  return new NextResponse(zoneFile, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": `attachment; filename="${d.domain}.zone"`,
    },
  });
}
