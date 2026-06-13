import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { validatePassword } from "@/features/security/services/security-password-service";

const roles = ["super_admin"] as const;

export async function POST(request: Request) {
  const auth = await requireApiRole(roles, { unauthenticatedMessage: "Auth required.", forbiddenMessage: "Access denied." });
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json() as { password: string };
    if (!body.password) return NextResponse.json({ ok: false, error: { code: "MISSING_PASSWORD" } }, { status: 400 });
    const result = await validatePassword(body.password);
    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "ERROR", message: e instanceof Error ? e.message : "Failed." } }, { status: 500 });
  }
}
