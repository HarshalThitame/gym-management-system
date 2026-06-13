import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/features/support/services/support-db";

export const runtime = "nodejs";

const roles = ["super_admin", "organization_owner", "gym_admin"] as const;

export async function POST(request: Request) {
  const auth = await requireApiRole(roles, {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Access denied.",
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as { keywords: string[]; organizationId?: string | null };
    if (!body.keywords || body.keywords.length === 0) {
      return NextResponse.json({ ok: true, data: [] });
    }

    const supabase = await createSupabaseServerClient();
    const sdb = db(supabase as unknown);

    let q = sdb.from("support_knowledge_base_articles").select("id, title, slug, excerpt").eq("status", "published");

    for (const kw of body.keywords) {
      q = q.or(`title.ilike.%${kw}%,body.ilike.%${kw}%`);
    }

    const { data } = await q.limit(5);
    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "SEARCH_ERROR", message: e instanceof Error ? e.message : "Search failed." } }, { status: 500 });
  }
}
