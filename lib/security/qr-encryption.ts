import crypto from "node:crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const PAYLOAD_PREFIX = "qr1_";

export type QrPayload = {
  v: 1;
  m: string;
  g: string;
  i: number;
  e: number;
};

function getEncryptionKey(): Buffer {
  const encoded = process.env.QR_ENCRYPTION_KEY;
  if (encoded) {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const key = Buffer.from(normalized, "base64");
    if (key.length === KEY_LENGTH) return key;
  }

  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (fallback) {
    const hash = crypto.createHash("sha256").update(fallback).digest();
    console.warn("[QR] QR_ENCRYPTION_KEY not set; deriving from SUPABASE_SERVICE_ROLE_KEY");
    return hash;
  }

  throw new Error(
    "QR encryption key not configured. Set QR_ENCRYPTION_KEY (32-byte base64) or SUPABASE_SERVICE_ROLE_KEY."
  );
}

export function encryptQrPayload(memberId: string, gymId: string, ttlDays = 90): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const expiresAt = Math.floor(Date.now() / 1000) + ttlDays * 86400;

  const payload: QrPayload = {
    v: 1,
    m: memberId,
    g: gymId,
    i: Math.floor(Date.now() / 1000),
    e: expiresAt,
  };

  const json = JSON.stringify(payload);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);

  return PAYLOAD_PREFIX + Buffer.concat([iv, encrypted]).toString("base64url");
}

export function decryptQrPayload(encoded: string): QrPayload | null {
  try {
    if (!encoded.startsWith(PAYLOAD_PREFIX)) return null;

    const raw = encoded.slice(PAYLOAD_PREFIX.length);
    const buffer = Buffer.from(raw, "base64url");
    if (buffer.length < IV_LENGTH + 1) return null;

    const iv = buffer.subarray(0, IV_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH);
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const payload = JSON.parse(decrypted.toString("utf8")) as QrPayload;

    if (!payload || payload.v !== 1 || !payload.m || !payload.g) return null;

    return payload;
  } catch {
    return null;
  }
}

export function isQrExpired(payload: QrPayload): boolean {
  return Math.floor(Date.now() / 1000) > payload.e;
}

export function buildQrUrl(encryptedPayload: string, origin?: string): string {
  const baseUrl = (
    origin ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "https://apexperformance.club"
  ).replace(/\/$/, "");
  return `${baseUrl}/admin/attendance?q=${encodeURIComponent(encryptedPayload)}`;
}
