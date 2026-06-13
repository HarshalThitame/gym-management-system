import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { assessLoginRisk, recordRiskEvent, getRiskTrends } from "@/features/security/services/security-risk-service";

const roles = ["super_admin"] as const;

export async function POST(request: Request) {
  const auth = await requireApiRole(roles, { unauthenticatedMessage: "Auth required.", forbiddenMessage: "Access denied." });
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "assess") {
      const result = await assessLoginRisk(body.userId as string, body.ipAddress as string, body.deviceFingerprint as string, body.userAgent as string);
      return NextResponse.json({ ok: true, data: result });
    }
    if (body.action === "record") {
      const event: Record<string, unknown> = {
        userId: body.userId, eventType: body.eventType, riskScore: body.riskScore,
        riskLevel: body.riskLevel, signals: body.signals ?? {}, actionTaken: body.actionTaken,
      };
      if (body.organizationId) event.organizationId = body.organizationId;
      if (body.ipAddress) event.ipAddress = body.ipAddress;
      if (body.deviceFingerprint) event.deviceFingerprint = body.deviceFingerprint;
      await recordRiskEvent(event as never);
      return NextResponse.json({ ok: true, message: "Risk event recorded." });
    }
    return NextResponse.json({ ok: false, error: { code: "INVALID_ACTION", message: "Invalid action." } }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "ERROR", message: e instanceof Error ? e.message : "Failed" } }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const auth = await requireApiRole(roles, { unauthenticatedMessage: "Auth required.", forbiddenMessage: "Access denied." });
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(request.url);
    const trends = await getRiskTrends(Number(url.searchParams.get("days") ?? "7"));
    return NextResponse.json({ ok: true, data: trends });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "FETCH_ERROR", message: e instanceof Error ? e.message : "Failed" } }, { status: 500 });
  }
}
