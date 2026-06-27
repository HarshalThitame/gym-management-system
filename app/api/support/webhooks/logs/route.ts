import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";

export async function GET() {
  try {
    await requireRole(["super_admin"], "/super-admin");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await (supabase as unknown as { from: (t: string) => any })
      .from("webhook_delivery_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to fetch webhook logs" }, { status: 500 });
  }
}
