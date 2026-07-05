import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireApiPermission,
  getApiTenantOrganizationId,
  requireApiTenantGymScope,
} from "@/lib/auth/api-guards";
import { writeAuditLog } from "@/lib/audit";
import { hashQrToken } from "@/features/attendance/lib/business-rules";
import { decryptQrPayload, isQrExpired } from "@/lib/security/qr-encryption";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiPermission("attendance", "read");
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

    let raw = "";
    try {
      const body = await request.clone().json() as Record<string, unknown>;
      raw = String(body?.token ?? body?.payload ?? "");
    } catch {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_BODY", message: "Request body must be valid JSON with a token or payload field." } },
        { status: 400 }
      );
    }
    if (!raw) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: "token or payload is required" } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // --- Legacy SHA-256 token path ---
    if (raw.startsWith("att_")) {
      const tokenHash = hashQrToken(raw);

      const { data: qrToken, error: qrError } = await supabase
        .from("qr_tokens")
        .select("id, member_id, gym_id, status, expires_at")
        .eq("token_hash", tokenHash)
        .single();

      if (qrError || !qrToken) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "INVALID_TOKEN",
              message: "QR token not found.",
            },
          },
          { status: 404 }
        );
      }

      if (qrToken.gym_id !== gymScope.gymId) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "WRONG_GYM",
              message: "This QR token belongs to another gym.",
            },
          },
          { status: 403 }
        );
      }

      if (qrToken.status !== "active") {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "TOKEN_NOT_ACTIVE",
              message: `QR token is ${qrToken.status}.`,
            },
          },
          { status: 403 }
        );
      }

      if (new Date(qrToken.expires_at) <= new Date()) {
        await supabase.from("qr_tokens").update({ status: "expired" }).eq("id", qrToken.id);
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "TOKEN_EXPIRED",
              message: "QR token has expired.",
            },
          },
          { status: 403 }
        );
      }

      const { data: member } = await supabase
        .from("members")
        .select("id, full_name, email, phone, photo_url")
        .eq("id", qrToken.member_id)
        .single();

      await writeAuditLog({
        actorId: auth.context.userId,
        gymId: gymScope.gymId,
        action: "attendance.qr.verified",
        entityType: "qr_token",
        entityId: qrToken.id,
        metadata: { member_id: qrToken.member_id, format: "legacy" },
      });

      return NextResponse.json({
        ok: true,
        data: {
          format: "legacy",
          member_id: qrToken.member_id,
          member: member ?? null,
          token_id: qrToken.id,
          expires_at: qrToken.expires_at,
          gym_id: qrToken.gym_id,
        },
      });
    }

    // --- New AES-256-CBC encrypted payload path ---
    const payload = decryptQrPayload(raw);
    if (!payload) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_PAYLOAD",
            message: "Unable to decrypt QR payload. It may be corrupted or from a different key.",
          },
        },
        { status: 400 }
      );
    }

    if (payload.g !== gymScope.gymId) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "WRONG_GYM",
            message: "This QR code belongs to another gym.",
          },
        },
        { status: 403 }
      );
    }

    if (isQrExpired(payload)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "QR_EXPIRED",
            message: "QR code has expired. Please generate a new one.",
          },
        },
        { status: 403 }
      );
    }

    const { data: member } = await supabase
      .from("members")
      .select("id, full_name, email, phone, photo_url")
      .eq("id", payload.m)
      .eq("gym_id", payload.g)
      .single();

    if (!member) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "MEMBER_NOT_FOUND",
            message: "Member not found for this QR code.",
          },
        },
        { status: 404 }
      );
    }

    await writeAuditLog({
      actorId: auth.context.userId,
      gymId: gymScope.gymId,
      action: "attendance.qr.verified",
      entityType: "member",
      entityId: payload.m,
      metadata: { format: "encrypted", version: payload.v },
    });

    return NextResponse.json({
      ok: true,
      data: {
        format: "encrypted",
        version: payload.v,
        member_id: payload.m,
        member,
        gym_id: payload.g,
        issued_at: payload.i,
        expires_at: payload.e,
        expires_at_iso: new Date(payload.e * 1000).toISOString(),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" } },
      { status: 500 }
    );
  }
}
