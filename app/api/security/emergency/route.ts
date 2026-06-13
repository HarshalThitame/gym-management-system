import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { createEmergencyOverride, listEmergencyOverrides, approveEmergencyOverride, denyEmergencyOverride } from "@/features/security/services/security-emergency-service";

const roles = ["super_admin"] as const;

export async function GET(request: Request) {
  const auth = await requireApiRole(roles, { unauthenticatedMessage: "Auth required.", forbiddenMessage: "Access denied." });
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(request.url);
    const opts: Record<string, unknown> = { page: Number(url.searchParams.get("page") ?? "1") };
    const status = url.searchParams.get("status"); if (status) opts.status = status;
    const result = await listEmergencyOverrides(opts as never);
    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "FETCH_ERROR", message: e instanceof Error ? e.message : "Failed" } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRole(roles, { unauthenticatedMessage: "Auth required.", forbiddenMessage: "Access denied." });
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "create") {
      const override = await createEmergencyOverride({
        requested_by: auth.context.userId,
        reason: body.reason,
        justification: body.justification,
        use_case: body.useCase,
        access_level: body.accessLevel ?? "read_only",
        duration_minutes: body.durationMinutes ?? 60,
      });
      return NextResponse.json({ ok: true, data: override }, { status: 201 });
    }
    if (body.action === "approve") {
      await approveEmergencyOverride(body.overrideId as string, auth.context.userId ?? "");
      return NextResponse.json({ ok: true, message: "Override approved." });
    }
    if (body.action === "deny") {
      await denyEmergencyOverride(body.overrideId as string);
      return NextResponse.json({ ok: true, message: "Override denied." });
    }
    return NextResponse.json({ ok: false, error: { code: "INVALID_ACTION", message: "Invalid action." } }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "ERROR", message: e instanceof Error ? e.message : "Failed" } }, { status: 500 });
  }
}
