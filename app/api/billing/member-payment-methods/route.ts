import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMemberPaymentMethods, deletePaymentMethod } from "@/features/billing/services/member-subscription-service";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getMemberPaymentMethods(user.id);
  if (!result.ok) {
    return NextResponse.json({ methods: [] });
  }

  return NextResponse.json({ methods: result.methods });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const methodId = url.searchParams.get("methodId");
  if (!methodId) {
    return NextResponse.json({ error: "methodId query param is required" }, { status: 400 });
  }

  const result = await deletePaymentMethod(methodId, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
