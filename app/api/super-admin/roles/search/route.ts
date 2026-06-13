import { NextRequest, NextResponse } from "next/server";
import { searchUsersByEmail } from "@/features/super-admin/services/role-management-service";
import { requireApiRole } from "@/lib/auth/api-guards";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";

export async function GET(req: NextRequest) {
  const auth = await requireApiRole(["super_admin"], {});
  if (!auth.ok) return auth.response;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`roles-search:${ip}`, "roles_search");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });

  const query = req.nextUrl.searchParams.get("q") ?? "";
  try {
    const users = await searchUsersByEmail(query);
    return NextResponse.json(users);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
