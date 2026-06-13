import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { listSavedViews, saveView, deleteView } from "@/features/support/services/support-saved-views-service";

export const runtime = "nodejs";

const roles = ["super_admin"] as const;

export async function GET() {
  const auth = await requireApiRole(roles, {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Access denied.",
  });
  if (!auth.ok) return auth.response;

  try {
    const views = await listSavedViews(auth.context.userId ?? "");
    return NextResponse.json({ ok: true, data: views });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "FETCH_ERROR", message: e instanceof Error ? e.message : "Failed." } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRole(roles, {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Access denied.",
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as { name: string; filters: Record<string, unknown> };
    if (!body.name) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_NAME", message: "View name required." } }, { status: 400 });
    }
    const view = await saveView(auth.context.userId ?? "", body.name, body.filters);
    return NextResponse.json({ ok: true, data: view }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "SAVE_ERROR", message: e instanceof Error ? e.message : "Failed." } }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireApiRole(roles, {
    unauthenticatedMessage: "Authentication required.",
    forbiddenMessage: "Access denied.",
  });
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const viewId = url.searchParams.get("id");
    if (!viewId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_ID", message: "View ID required." } }, { status: 400 });
    }
    await deleteView(auth.context.userId ?? "", viewId);
    return NextResponse.json({ ok: true, message: "View deleted." });
  } catch (e) {
    return NextResponse.json({ ok: false, error: { code: "DELETE_ERROR", message: e instanceof Error ? e.message : "Failed." } }, { status: 500 });
  }
}
