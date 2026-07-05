import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireApiPermission,
  getApiTenantOrganizationId,
  requireApiTenantGymScope,
} from "@/lib/auth/api-guards";
import { writeAuditLog } from "@/lib/audit";
import { encryptQrPayload, buildQrUrl } from "@/lib/security/qr-encryption";
import {
  generateQrTokenValue,
  hashQrToken,
  buildQrPayload as buildLegacyQrPayload,
} from "@/features/attendance/lib/business-rules";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiPermission("attendance", "write");
    if (!auth.ok) return auth.response;

    const organizationId = getApiTenantOrganizationId(auth.context, auth.tenant);
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: { code: "ORG_SCOPE_REQUIRED", message: "Organization scope required." } },
        { status: 403 }
      );
    }

    const gymScope = requireApiTenantGymScope(auth.context, auth.tenant);
    if (!gymScope.ok) return gymScope.response;

    const body = await request.json() as Record<string, unknown>;
    const { member_id } = body;

    if (!member_id || typeof member_id !== "string") {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: "member_id is required" } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, gym_id, full_name, qr_code_static")
      .eq("id", member_id)
      .eq("gym_id", gymScope.gymId)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Member not found in this gym." } },
        { status: 404 }
      );
    }

    const origin = request.headers.get("origin") ?? undefined;

    // --- Legacy SHA-256 token (backward compat) ---
    const legacyTokenValue = generateQrTokenValue();
    const legacyHash = hashQrToken(legacyTokenValue);
    const legacyUrl = buildLegacyQrPayload(legacyTokenValue, origin);

    // --- New AES-encrypted payload ---
    const encryptedPayload = encryptQrPayload(member_id, gymScope.gymId);
    const newQrUrl = buildQrUrl(encryptedPayload, origin);

    // Revoke previous active tokens
    const { data: previousToken } = await supabase
      .from("qr_tokens")
      .select("id")
      .eq("member_id", member_id)
      .eq("purpose", "attendance")
      .eq("status", "active")
      .maybeSingle();

    if (previousToken) {
      await supabase.from("qr_tokens").update({ status: "revoked" }).eq("id", previousToken.id);
    }

    // Store new legacy token
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: token, error: insertError } = await supabase
      .from("qr_tokens")
      .insert({
        gym_id: gymScope.gymId,
        member_id,
        token_value: legacyTokenValue,
        token_hash: legacyHash,
        expires_at: expiresAt,
        regenerated_from_token_id: previousToken?.id ?? null,
        created_by: auth.context.userId,
      })
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: { code: "INSERT_FAILED", message: insertError.message } },
        { status: 500 }
      );
    }

    // Store encrypted payload on member record for static QR
    await supabase
      .from("members")
      .update({
        qr_code_static: encryptedPayload,
        qr_generated_at: new Date().toISOString(),
      })
      .eq("id", member_id);

    await supabase.from("attendance_logs").insert({
      gym_id: gymScope.gymId,
      member_id,
      qr_token_id: token.id,
      action: "qr_generated",
      source: "reception",
      result: "success",
      message: "Dual-format QR generated (legacy + AES).",
      actor_id: auth.context.userId,
      occurred_at: new Date().toISOString(),
    });

    await writeAuditLog({
      actorId: auth.context.userId,
      gymId: gymScope.gymId,
      action: "attendance.qr.generated",
      entityType: "member",
      entityId: member_id,
      metadata: { token_id: token.id, format: "dual" },
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          member_id,
          legacy: {
            token: legacyTokenValue,
            url: legacyUrl,
            expires_at: expiresAt,
          },
          encrypted: {
            payload: encryptedPayload,
            url: newQrUrl,
            expires_at: expiresAt,
          },
          qr_code_static: encryptedPayload,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}
