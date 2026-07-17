import "server-only";

import { resolveStandardCheckoutCredentials } from "./standard-checkout-env";
import { normalizeRazorpayProviderConfig, type RazorpayProviderCredentials } from "./razorpay-provider-config";
import { getPlatformProviderConfig } from "@/features/billing/services/platform-provider-config-service";

export async function resolvePlatformRazorpayCredentials(): Promise<RazorpayProviderCredentials | null> {
  const result = await getPlatformProviderConfig("razorpay");
  if (result.ok && result.config.isActive) {
    const normalized = normalizeRazorpayProviderConfig(result.config.config, result.config.testMode);
    if (normalized) {
      return normalized;
    }
  }

  try {
    const standardCredentials = resolveStandardCheckoutCredentials();
    return {
      keyId: standardCredentials.keyId,
      keySecret: standardCredentials.keySecret,
      environment: standardCredentials.environment,
      isTestMode: standardCredentials.environment !== "live",
      webhookSecret: undefined,
    };
  } catch {
    return null;
  }
}
