import { NextRequest, NextResponse } from "next/server";
import { getRoleDetailData } from "@/features/super-admin/services/role-management-service";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";

export async function GET(req: NextRequest, { params }: { params: Promise<{ roleId: string }> }) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`roles-detail:${ip}`, "roles_detail");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });

  const { roleId } = await params;
  try {
    const data = await getRoleDetailData(roleId);
    if (!data) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
