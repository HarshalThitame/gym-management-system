import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/features/support/services/support-db";

export const runtime = "nodejs";

const roles = ["super_admin"] as const;

export async function PUT(request: Request) {
  const auth = await requireApiRole(roles, {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Only super admins can update automation rules.",
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as { rules: Record<string, unknown>[] };
    const supabase = await createSupabaseServerClient();
    const sdb = db(supabase as unknown);

    for (const rule of body.rules) {
      if (rule.id) {
        const { id, ...updates } = rule;
        await sdb.from("support_automation_rules").update(updates as Record<string, unknown>).eq("id", id as string);
      } else {
        await sdb.from("support_automation_rules").insert(rule as Record<string, unknown>);
      }
    }

    return NextResponse.json({ ok: true, message: "Rules saved." });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "SAVE_ERROR", message: e instanceof Error ? e.message : "Failed to save rules." } }, { status: 500 });
  }
}
