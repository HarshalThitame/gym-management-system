import { getSupabaseClient } from "@/api/supabase";
import { secureStorage } from "@/storage/secure";

const STORE_DEVICE_ID = "apex_device_id";
const STORE_QR_SESSION = "apex_qr_session";

const QR_REFRESH_INTERVAL_MS = 30000;
const QR_VALIDITY_WINDOW_MS = 35000;

export interface SecureQRData {
  memberId: string;
  memberCode: string;
  organizationId: string;
  gymId: string;
  timestamp: number;
  expiresAt: number;
  nonce: string;
  signature: string;
  sessionToken: string;
}

export interface QRValidationResult {
  ok: boolean;
  error?: string;
  code?: string;
  memberId?: string;
}

export const qrSecurityService = {
  async generateSecureQR(memberId: string, gymId: string, organizationId: string): Promise<{ qrData: string; expiresIn: number }> {
    const timestamp = Date.now();
    const expiresAt = timestamp + QR_VALIDITY_WINDOW_MS;
    const nonce = this.generateUUID();
    const deviceId = await this.getDeviceId();
    const sessionToken = await this.getSessionToken();

    const signature = this.signData(`${memberId}:${gymId}:${organizationId}:${timestamp}:${nonce}:${deviceId}:${sessionToken}`);

    const qrData = JSON.stringify({
      v: 2,
      mid: memberId,
      mc: memberId.slice(0, 8).toUpperCase(),
      oid: organizationId,
      gid: gymId,
      ts: timestamp,
      exp: expiresAt,
      nonce,
      sig: signature,
      st: sessionToken.slice(0, 8),
    });

    return { qrData, expiresIn: QR_REFRESH_INTERVAL_MS };
  },

  async validateQR(qrData: string, scannerGymId: string): Promise<QRValidationResult> {
    try {
      let parsed: SecureQRData;
      try {
        parsed = JSON.parse(qrData);
      } catch {
        return { ok: false, error: "Invalid QR format.", code: "INVALID_FORMAT" };
      }

      // Version check
      if (!parsed.v || parsed.v < 2) {
        return { ok: false, error: "QR version not supported.", code: "VERSION_MISMATCH" };
      }

      // Expiry check
      if (Date.now() > parsed.exp) {
        return { ok: false, error: "QR code has expired. Please refresh.", code: "QR_EXPIRED" };
      }

      // Timestamp freshness
      if (Date.now() - parsed.ts > QR_VALIDITY_WINDOW_MS) {
        return { ok: false, error: "QR code is too old.", code: "QR_STALE" };
      }

      // Nonce reuse check (anti-replay)
      const nonceUsed = await this.checkNonceReuse(parsed.nonce);
      if (nonceUsed) {
        return { ok: false, error: "QR code has already been used.", code: "QR_REUSED" };
      }

      // Gym validation
      if (parsed.gid !== scannerGymId) {
        return { ok: false, error: "QR code is for a different gym.", code: "GYM_MISMATCH" };
      }

      // Mark nonce as used (anti-replay)
      await this.markNonceUsed(parsed.nonce, parsed.exp);

      // Verify member exists and is active
      const supabase = getSupabaseClient();
      const { data: member } = await supabase
        .from("members")
        .select("id, status, organization_id")
        .eq("id", parsed.mid)
        .maybeSingle();

      if (!member) {
        return { ok: false, error: "Member not found.", code: "MEMBER_NOT_FOUND" };
      }

      if (member.status !== "active") {
        return { ok: false, error: "Member account is not active.", code: "MEMBER_INACTIVE" };
      }

      if (member.organization_id !== parsed.oid) {
        return { ok: false, error: "Organization mismatch.", code: "ORG_MISMATCH" };
      }

      return { ok: true, memberId: parsed.mid };
    } catch {
      return { ok: false, error: "QR validation failed.", code: "VALIDATION_ERROR" };
    }
  },

  async getDeviceId(): Promise<string> {
    const stored = await secureStorage.get(STORE_DEVICE_ID as never);
    if (stored) return stored;
    const id = this.generateUUID();
    await secureStorage.set(STORE_DEVICE_ID as never, id);
    return id;
  },

  async getSessionToken(): Promise<string> {
    const stored = await secureStorage.getJSON<{ token: string; expiresAt: number }>(STORE_QR_SESSION as never);
    if (stored && stored.expiresAt > Date.now()) return stored.token;

    const token = this.generateUUID();
    await secureStorage.setJSON(STORE_QR_SESSION as never, { token, expiresAt: Date.now() + 3600000 });
    return token;
  },

  signData(data: string): string {
    let hash = 0;
    const str = data + "apex-qr-secret-v2";
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, "0").slice(0, 8);
  },

  generateUUID(): string {
    return "xxxx-xxxx-xxxx".replace(/x/g, () =>
      Math.floor(Math.random() * 16).toString(16)
    );
  },

  async checkNonceReuse(nonce: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("qr_nonce_log")
        .select("id")
        .eq("nonce", nonce)
        .maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  },

  async markNonceUsed(nonce: string, expiresAt: number): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      await supabase.from("qr_nonce_log").insert({
        nonce,
        expires_at: new Date(expiresAt).toISOString(),
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-fatal if logging fails
    }
  },

  async cleanupExpiredNonces(): Promise<number> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("qr_nonce_log")
        .delete()
        .lt("expires_at", new Date().toISOString())
        .select("id");
      return data?.length ?? 0;
    } catch {
      return 0;
    }
  },
};
