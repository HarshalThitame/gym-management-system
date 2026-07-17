import "server-only";

import type { RazorpayEnvironment } from "./razorpay-types";

type StandardCheckoutCredentials = {
  keyId: string;
  keySecret: string;
  environment: RazorpayEnvironment;
};

function readEnv(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

function resolveEnvironment(): RazorpayEnvironment {
  return readEnv("RAZORPAY_ENV") === "live" ? "live" : "test";
}

export function resolveStandardCheckoutCredentials(): StandardCheckoutCredentials {
  const environment = resolveEnvironment();
  const keyId =
    readEnv(environment === "test" ? "RAZORPAY_TEST_KEY_ID" : "RAZORPAY_LIVE_KEY_ID")
    ?? readEnv("RAZORPAY_KEY_ID")
    ?? "";
  const keySecret =
    readEnv(environment === "test" ? "RAZORPAY_TEST_KEY_SECRET" : "RAZORPAY_LIVE_KEY_SECRET")
    ?? readEnv("RAZORPAY_KEY_SECRET")
    ?? "";

  if (!keyId) {
    throw new Error(`Razorpay ${environment === "test" ? "test" : "live"} key id is not configured.`);
  }

  if (!keySecret) {
    throw new Error(`Razorpay ${environment === "test" ? "test" : "live"} key secret is not configured.`);
  }

  return { keyId, keySecret, environment };
}

