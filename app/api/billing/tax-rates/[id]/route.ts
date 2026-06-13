import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";
const superAdminRoles = ["super_admin"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const body = await request.json();
    const supabase = await createSupabaseServerClient();
    const db = supabase as never as {
      from(t: string): {
        update(r: Record<string, unknown>): { eq(c: string, v: string): Promise<{ error: { message: string } | null }> };
      };
    };

    const { error } = await db.from("tax_rates").update({
      name: body.name,
      rate_percent: body.ratePercent,
      is_active: body.isActive,
      effective_until: body.effectiveUntil ?? null,
    }).eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(superAdminRoles);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const db = supabase as never as {
    from(t: string): { delete(): { eq(c: string, v: string): Promise<{ error: { message: string } | null }> } };
  };

  const { error } = await db.from("tax_rates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
