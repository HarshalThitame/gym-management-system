import "server-only";

import type { RazorpayConfig, RazorpayEnvironment } from "./razorpay-types";

function readEnv(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

const ENV_ENV = "RAZORPAY_ENV";

/**
 * Returns the active Razorpay environment: "test" or "live".
 */
export function getRazorpayEnvironment(): RazorpayEnvironment {
  return readEnv(ENV_ENV) === "live" ? "live" : "test";
}

export function isRazorpayTestMode(): boolean {
  return getRazorpayEnvironment() !== "live";
}

export function isRazorpayLiveMode(): boolean {
  return getRazorpayEnvironment() === "live";
}

/**
 * Resolves environment-specific env variable names with backward-compatible fallback.
 *
 * Test mode lookup order:
 *   1. RAZORPAY_TEST_KEY_ID
 *   2. RAZORPAY_KEY_ID (backward compat)
 *
 * Live mode lookup order:
 *   1. RAZORPAY_LIVE_KEY_ID
 *   2. RAZORPAY_KEY_ID (backward compat)
 */
function resolveEnvVar(env: RazorpayEnvironment, testVar: string, liveVar: string, fallbackVar: string): string | null {
  if (env === "test") {
    return readEnv(testVar) ?? readEnv(fallbackVar);
  }
  return readEnv(liveVar) ?? readEnv(fallbackVar);
}

/**
 * Returns the public-facing Razorpay Key ID for frontend.
 * Safe to expose to the browser.
 */
export function getRazorpayPublicKeyId(): string {
  const env = getRazorpayEnvironment();
  if (env === "test") {
    return readEnv("NEXT_PUBLIC_RAZORPAY_TEST_KEY_ID") ?? readEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID") ?? "";
  }
  return readEnv("NEXT_PUBLIC_RAZORPAY_LIVE_KEY_ID") ?? readEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID") ?? "";
}

/**
 * Validates and returns the full Razorpay server-side config for the active environment.
 * Throws a clear error if required server-only env vars are missing.
 * Never exposes secret values in error messages or logs.
 */
export function getRazorpayConfig(): RazorpayConfig {
  const env = getRazorpayEnvironment();
  const keyId = resolveEnvVar(env, "RAZORPAY_TEST_KEY_ID", "RAZORPAY_LIVE_KEY_ID", "RAZORPAY_KEY_ID");
  const keySecret = resolveEnvVar(env, "RAZORPAY_TEST_KEY_SECRET", "RAZORPAY_LIVE_KEY_SECRET", "RAZORPAY_KEY_SECRET");
  const webhookSecret = resolveEnvVar(env, "RAZORPAY_TEST_WEBHOOK_SECRET", "RAZORPAY_LIVE_WEBHOOK_SECRET", "RAZORPAY_WEBHOOK_SECRET");

  const prefix = env === "test" ? "Test" : "Live";

  if (!keyId) {
    throw new Error(`Razorpay ${prefix} config incomplete: ${env}_KEY_ID (or legacy KEY_ID) is required.`);
  }
  if (!keySecret) {
    throw new Error(`Razorpay ${prefix} config incomplete: ${env}_KEY_SECRET (or legacy KEY_SECRET) is required.`);
  }
  if (!webhookSecret) {
    throw new Error(`Razorpay ${prefix} config incomplete: ${env}_WEBHOOK_SECRET (or legacy WEBHOOK_SECRET) is required.`);
  }

  return {
    keyId,
    keySecret,
    webhookSecret,
    environment: env,
    isTestMode: env === "test",
  };
}

/**
 * Masks a Razorpay key ID for safe display: shows first 8 chars + last 4 chars.
 */
export function maskRazorpayKey(key: string): string {
  if (key.length <= 12) return key.slice(0, 8) + "...";
  return key.slice(0, 8) + "..." + key.slice(-4);
}

/**
 * Returns the Razorpay webhook secret for the active environment.
 * Server-only. Never expose to client.
 */
export function getRazorpayWebhookSecret(): string {
  const env = getRazorpayEnvironment();
  return resolveEnvVar(env, "RAZORPAY_TEST_WEBHOOK_SECRET", "RAZORPAY_LIVE_WEBHOOK_SECRET", "RAZORPAY_WEBHOOK_SECRET") ?? "";
}
