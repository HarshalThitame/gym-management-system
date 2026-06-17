import "server-only";

import { getRazorpayConfig, getRazorpayPublicKeyId, getRazorpayEnvironment } from "./razorpay-config";
import type { RazorpayHealthStatus } from "./razorpay-types";

/**
 * Checks Razorpay configuration health without exposing secrets.
 * Safe to call from server actions or API routes for admin dashboards.
 * Returns a status object with boolean flags only — never returns actual secret values.
 */
export function getRazorpayHealthStatus(): RazorpayHealthStatus {
  let config: ReturnType<typeof getRazorpayConfig> | null = null;
  let configError = false;

  try {
    config = getRazorpayConfig();
  } catch {
    configError = true;
  }

  const environment = configError ? null : getRazorpayEnvironment();
  const publicKeyId = getRazorpayPublicKeyId();

  return {
    configured: config !== null,
    environment,
    hasKeyId: config !== null && config.keyId.length > 0,
    hasKeySecret: config !== null && config.keySecret.length > 0,
    hasWebhookSecret: config !== null && config.webhookSecret.length > 0,
    publicKeyMatchesServerKey: config !== null && config.keyId === publicKeyId,
  };
}
