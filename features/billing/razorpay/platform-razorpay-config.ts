import "server-only";

import { getRazorpayConfig } from "./razorpay-config";
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
    return normalizeRazorpayProviderConfig(getRazorpayConfig());
  } catch {
    return null;
  }
}
