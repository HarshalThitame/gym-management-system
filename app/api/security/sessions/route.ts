import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { listActiveSessions, revokeSession, revokeAllUserSessions } from "@/features/security/services/security-session-service";

const roles = ["super_admin"] as const;

export async function GET(request: Request) {
  const auth = await requireApiRole(roles, { unauthenticatedMessage: "Auth required.", forbiddenMessage: "Access denied." });
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(request.url);
    const opts: Record<string, unknown> = { page: Number(url.searchParams.get("page") ?? "1") };
    const userId = url.searchParams.get("userId"); if (userId) opts.userId = userId;
    if (url.searchParams.get("highRisk") === "true") opts.highRiskOnly = true;
    const { sessions } = await listActiveSessions(opts as never);
    return NextResponse.json({ ok: true, data: { sessions } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "FETCH_ERROR", message: e instanceof Error ? e.message : "Failed" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRole(roles, { unauthenticatedMessage: "Auth required.", forbiddenMessage: "Access denied." });
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "revoke") {
      await revokeSession(body.sessionId as string);
      return NextResponse.json({ ok: true, message: "Session revoked." });
    }
    if (body.action === "revoke_all") {
      await revokeAllUserSessions(body.userId as string);
      return NextResponse.json({ ok: true, message: "All sessions revoked." });
    }
    return NextResponse.json({ ok: false, error: { code: "INVALID_ACTION", message: "Invalid action." } }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "ERROR", message: e instanceof Error ? e.message : "Failed" } }, { status: 500 });
  }
}
