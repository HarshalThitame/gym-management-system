import "server-only";

import { getRazorpayConfig, getRazorpayPublicKeyId, getRazorpayEnvironment, maskRazorpayKey } from "./razorpay-config";
import type { RazorpayHealthStatus } from "./razorpay-types";

export type EnvironmentValidationResult = {
  valid: boolean;
  environment: string;
  hasKeyId: boolean;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  hasPublicKeyId: boolean;
  keyIdPrefixValid: boolean;
  publicKeyMatchesEnvironment: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Validates Razorpay environment configuration for production readiness.
 * Returns detailed validation result without exposing secrets.
 */
export function validateRazorpayEnvironmentConfig(): EnvironmentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const env = getRazorpayEnvironment();
  const publicKeyId = getRazorpayPublicKeyId();

  let config: ReturnType<typeof getRazorpayConfig> | null = null;
  let configError = false;
  try {
    config = getRazorpayConfig();
  } catch (e) {
    configError = true;
    errors.push(e instanceof Error ? e.message : "Config validation failed");
  }

  const hasKeyId = config !== null && config.keyId.length > 0;
  const hasKeySecret = config !== null && config.keySecret.length > 0;
  const hasWebhookSecret = config !== null && config.webhookSecret.length > 0;
  const hasPublicKeyId = publicKeyId.length > 0;

  // Check key prefix matches environment
  const expectedPrefix = env === "live" ? "rzp_live_" : "rzp_test_";
  const keyIdPrefixValid = hasKeyId && config!.keyId.startsWith(expectedPrefix);
  const publicKeyMatchesEnvironment = hasPublicKeyId && publicKeyId.startsWith(expectedPrefix);

  if (!hasKeyId) errors.push(`Missing ${env} key ID`);
  if (!hasKeySecret) errors.push(`Missing ${env} key secret`);
  if (!hasWebhookSecret) errors.push(`Missing ${env} webhook secret`);
  if (!hasPublicKeyId) errors.push(`Missing ${env} public key ID (NEXT_PUBLIC_RAZORPAY_${env.toUpperCase()}_KEY_ID)`);

  if (hasKeyId && !keyIdPrefixValid) {
    errors.push(`${env === "live" ? "Test" : "Live"} key ID detected in ${env} mode. Key prefix mismatch.`);
  }

  if (env === "live") {
    if (!publicKeyMatchesEnvironment) {
      errors.push("Public key does not match live environment. Check NEXT_PUBLIC_RAZORPAY_LIVE_KEY_ID.");
    }
    if (!keyIdPrefixValid) {
      errors.push("Server key ID does not start with rzp_live_. Check RAZORPAY_LIVE_KEY_ID.");
    }
    warnings.push("Live mode is active. Verify webhook URL is HTTPS.");
  } else {
    if (!keyIdPrefixValid && hasKeyId) {
      warnings.push("Server key ID does not start with rzp_test_. Check RAZORPAY_TEST_KEY_ID.");
    }
  }

  return {
    valid: errors.length === 0,
    environment: env,
    hasKeyId,
    hasKeySecret,
    hasWebhookSecret,
    hasPublicKeyId,
    keyIdPrefixValid,
    publicKeyMatchesEnvironment,
    errors,
    warnings,
  };
}

/**
 * Returns Razorpay configuration health status without exposing secrets.
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
