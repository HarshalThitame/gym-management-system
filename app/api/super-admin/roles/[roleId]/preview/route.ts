import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";
import { getRoleAccessPreview } from "@/features/super-admin/services/role-access-preview-service";
import { previewRolePermissionsSchema } from "@/features/super-admin/schemas/role-management-schemas";

export async function POST(req: NextRequest, { params }: { params: Promise<{ roleId: string }> }) {
  const auth = await requireApiRole(["super_admin"], {});
  if (!auth.ok) return auth.response;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`roles-preview:${ip}`, "roles_detail");
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  }

  const { roleId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = previewRolePermissionsSchema.safeParse({ roleId, ...(body as Record<string, unknown>) });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid preview payload", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const preview = await getRoleAccessPreview(parsed.data.roleId, parsed.data.permissions);
    if (!preview) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    return NextResponse.json(preview);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

