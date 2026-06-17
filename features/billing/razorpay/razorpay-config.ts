import "server-only";

import type { RazorpayConfig, RazorpayEnvironment } from "./razorpay-types";

function readEnv(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

const ENV_KEY_ID = "RAZORPAY_KEY_ID";
const ENV_KEY_SECRET = "RAZORPAY_KEY_SECRET";
const ENV_WEBHOOK_SECRET = "RAZORPAY_WEBHOOK_SECRET";
const ENV_ENV = "RAZORPAY_ENV";

/**
 * Validates and returns the full Razorpay server-side config.
 * Throws a clear error if required server-only env vars are missing.
 * Never exposes secret values in error messages or logs.
 */
export function getRazorpayConfig(): RazorpayConfig {
  const keyId = readEnv(ENV_KEY_ID);
  const keySecret = readEnv(ENV_KEY_SECRET);
  const webhookSecret = readEnv(ENV_WEBHOOK_SECRET);
  const envRaw = readEnv(ENV_ENV) ?? "test";

  const environment: RazorpayEnvironment = envRaw === "live" ? "live" : "test";

  if (!keyId) {
    throw new Error("Razorpay server config incomplete: RAZORPAY_KEY_ID is required.");
  }
  if (!keySecret) {
    throw new Error("Razorpay server config incomplete: RAZORPAY_KEY_SECRET is required.");
  }
  if (!webhookSecret) {
    throw new Error("Razorpay server config incomplete: RAZORPAY_WEBHOOK_SECRET is required.");
  }

  return {
    keyId,
    keySecret,
    webhookSecret,
    environment,
    isTestMode: environment === "test",
  };
}

/**
 * Returns the public-facing Razorpay Key ID for use in frontend components.
 * Safe to expose to the browser.
 */
export function getRazorpayPublicKeyId(): string {
  return readEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID") ?? "";
}

/**
 * Returns whether Razorpay is configured in test mode.
 * Safe for conditional UI rendering (e.g. showing "Test Mode" badge).
 */
export function isRazorpayTestMode(): boolean {
  return readEnv(ENV_ENV) !== "live";
}

/**
 * Returns the Razorpay environment string for display: "test" | "live".
 */
export function getRazorpayEnvironment(): RazorpayEnvironment {
  return readEnv(ENV_ENV) === "live" ? "live" : "test";
}
