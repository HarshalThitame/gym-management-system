import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    const authenticated = Boolean(data?.claims?.sub && !error);

    return noStore(NextResponse.json({ authenticated }, { status: authenticated ? 200 : 401 }));
  } catch {
    return noStore(NextResponse.json({ authenticated: false }, { status: 401 }));
  }
}
