import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const gymId = searchParams.get("gym_id")?.trim();
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

  if (!q || q.length < 2) {
    return NextResponse.json({ members: [] });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pattern = `%${q}%`;
  let query = supabase
    .from("members")
    .select("id, full_name, member_code, phone, email, photo_url, gender, last_attendance_date, is_currently_in_gym")
    .or(`full_name.ilike.${pattern},member_code.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
    .order("full_name", { ascending: true })
    .limit(limit);

  if (gymId) query = query.eq("gym_id", gymId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ members: data ?? [] });
}
