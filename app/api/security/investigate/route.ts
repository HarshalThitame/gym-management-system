import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { getInvestigationDetail, forcePasswordReset, forceMfaReset, blockLogin } from "@/features/security/services/security-investigation-service";
import { revokeAllUserSessions } from "@/features/security/services/security-session-service";

const roles = ["super_admin"] as const;

export async function GET(request: Request) {
  const auth = await requireApiRole(roles, { unauthenticatedMessage: "Auth required.", forbiddenMessage: "Access denied." });
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    if (!userId) return NextResponse.json({ ok: false, error: { code: "MISSING_PARAMS", message: "userId required." } }, { status: 400 });
    const data = await getInvestigationDetail(userId);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "FETCH_ERROR", message: e instanceof Error ? e.message : "Failed." } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRole(roles, { unauthenticatedMessage: "Auth required.", forbiddenMessage: "Access denied." });
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json() as { userId: string; action: string };
    const adminId = auth.context.userId ?? "";
    switch (body.action) {
      case "block":
        await blockLogin(body.userId, "Blocked by security investigation", adminId);
        return NextResponse.json({ ok: true, message: "User blocked." });
      case "force_reset":
        await forcePasswordReset(body.userId, adminId);
        return NextResponse.json({ ok: true, message: "Password reset forced." });
      case "mfa_reset":
        await forceMfaReset(body.userId, adminId);
        return NextResponse.json({ ok: true, message: "MFA reset forced." });
      case "revoke_sessions":
        await revokeAllUserSessions(body.userId);
        return NextResponse.json({ ok: true, message: "All sessions revoked." });
      default:
        return NextResponse.json({ ok: false, error: { code: "INVALID_ACTION" } }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "ERROR", message: e instanceof Error ? e.message : "Failed." } }, { status: 500 });
  }
}
