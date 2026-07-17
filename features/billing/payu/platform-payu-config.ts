import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { billingLogger } from "@/features/billing/lib/logger";
import type { PayuConfig, PayuEnvironment } from "./payu-types";
import { getPayuConfig } from "./payu-config";

type PlatformConfigRow = {
  provider: string;
  is_active: boolean;
  test_mode: boolean;
  config: Record<string, string>;
};

export type PayuProviderCredentials = PayuConfig & {
  keyId: string;
  keySecret: string;
};

export function normalizePayuProviderConfig(config: Record<string, string>, testMode: boolean): PayuProviderCredentials | null {
  const merchantKey = config.merchant_key?.trim() ?? "";
  const merchantSalt = config.merchant_salt?.trim() ?? "";
  const authHeader = config.auth_header?.trim() || Buffer.from(`${merchantKey}:${merchantSalt}`).toString("base64");

  if (!merchantKey || !merchantSalt) {
    return null;
  }

  const environment: PayuEnvironment = testMode ? "test" : "live";
  return {
    merchantKey,
    merchantSalt,
    authHeader,
    environment,
    isTestMode: testMode,
    keyId: merchantKey,
    keySecret: merchantSalt,
  };
}

export async function resolvePlatformPayuCredentials(): Promise<PayuProviderCredentials | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("platform_payment_gateway_configs")
    .select("*")
    .eq("provider", "payu")
    .maybeSingle() as never as {
    data: PlatformConfigRow | null;
    error: { message: string } | null;
  };

  if (error) {
    billingLogger.error("resolvePlatformPayuCredentials", "Failed to fetch platform PayU config", { error: error.message });
    return null;
  }

  if (data?.is_active) {
    const normalized = normalizePayuProviderConfig(data.config, data.test_mode);
    if (normalized) {
      return normalized;
    }
  }

  try {
    const fallback = getPayuConfig();
    return {
      ...fallback,
      keyId: fallback.merchantKey,
      keySecret: fallback.merchantSalt,
    };
  } catch {
    return null;
  }
}
