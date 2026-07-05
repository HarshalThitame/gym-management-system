import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const API_KEY_PREFIX = "dev_";
const API_KEY_BYTES = 32;

export function generateDeviceApiKey(): { plaintext: string; hash: string } {
  const raw = crypto.randomBytes(API_KEY_BYTES);
  const plaintext = API_KEY_PREFIX + raw.toString("base64url");
  const hash = crypto.createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, hash };
}

export function hashDeviceApiKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

export type DeviceAuthResult = {
  ok: true;
  device: {
    id: string;
    device_name: string;
    device_type_id: string;
    organization_id: string;
    gym_id: string | null;
    branch_id: string | null;
  };
} | {
  ok: false;
  response: NextResponse;
};

export async function authenticateDeviceRequest(request: Request): Promise<DeviceAuthResult> {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: { code: "API_KEY_REQUIRED", message: "x-api-key header is required." } },
        { status: 401 }
      ),
    };
  }

  const hash = hashDeviceApiKey(apiKey);
  const supabase = createAdminClient();

  const { data: device, error } = await supabase
    .from("attendance_devices")
    .select("id, device_name, device_type_id, organization_id, gym_id, branch_id, is_active, status")
    .eq("api_key", hash)
    .single();

  if (error || !device) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: { code: "INVALID_API_KEY", message: "Device authentication failed." } },
        { status: 401 }
      ),
    };
  }

  if (!device.is_active) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: { code: "DEVICE_INACTIVE", message: "Device is deactivated." } },
        { status: 403 }
      ),
    };
  }

  return { ok: true, device };
}
