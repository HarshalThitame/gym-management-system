import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { RazorpayConfig, RazorpayEnvironment } from "./razorpay-types";

export type OrgRazorpayConfigResult = {
  configured: boolean;
  config: RazorpayConfig | null;
  error: string | null;
};

export async function getOrgRazorpayConfig(
  organizationId: string,
): Promise<OrgRazorpayConfigResult> {
  const adminDb = createAdminClient();

  const { data, error } = await adminDb
    .from("integrations")
    .select("credentials, config, status, error_message")
    .eq("organization_id", organizationId)
    .eq("provider", "razorpay")
    .maybeSingle();

  if (error) {
    return { configured: false, config: null, error: error.message };
  }

  if (!data) {
    return { configured: false, config: null, error: "Razorpay is not configured for this organization." };
  }

  const credentials = data.credentials as Record<string, unknown> | null;
  const config = data.config as Record<string, unknown> | null;

  const keyId = typeof credentials?.keyId === "string" && credentials.keyId.trim() ? credentials.keyId.trim() : "";
  const keySecret = typeof credentials?.keySecret === "string" && credentials.keySecret.trim() ? credentials.keySecret.trim() : "";
  const webhookSecret = typeof credentials?.webhookSecret === "string" && credentials.webhookSecret.trim() ? credentials.webhookSecret.trim() : "";
  const environment = (typeof config?.environment === "string" && config.environment === "live" ? "live" : "test") as RazorpayEnvironment;

  if (!keyId || !keySecret) {
    return { configured: false, config: null, error: "Razorpay credentials are incomplete." };
  }

  return {
    configured: true,
    config: {
      keyId,
      keySecret,
      webhookSecret,
      environment,
      isTestMode: environment === "test",
    },
    error: data.error_message,
  };
}
