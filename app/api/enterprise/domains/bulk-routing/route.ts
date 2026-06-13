import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiAuth } from "@/lib/auth/api-guards";

export async function PATCH(request: Request) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { domainIds, routingMode } = body;

    if (!Array.isArray(domainIds) || domainIds.length === 0) {
      return NextResponse.json({ error: "domainIds array required" }, { status: 400 });
    }
    if (!routingMode || !["organization", "branch", "gym"].includes(routingMode)) {
      return NextResponse.json({ error: "routingMode must be: organization, branch, or gym" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    let updated = 0;
    const errors: string[] = [];

    for (const id of domainIds) {
      const { error } = await supabase
        .from("tenant_domains")
        .update({ routing_mode: routingMode })
        .eq("id", id);

      if (error) errors.push(`${id}: ${error.message}`);
      else updated++;
    }

    return NextResponse.json({ ok: true, updated, errors: errors.length > 0 ? errors : undefined });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
}
