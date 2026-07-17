import "server-only";

import type { PayuConfig, PayuEnvironment } from "./payu-types";

const ENV_KEY_MAP = {
  keyId: { test: "PAYU_TEST_MERCHANT_KEY", live: "PAYU_LIVE_MERCHANT_KEY", legacy: "PAYU_MERCHANT_KEY" },
  salt: { test: "PAYU_TEST_MERCHANT_SALT", live: "PAYU_LIVE_MERCHANT_SALT", legacy: "PAYU_MERCHANT_SALT" },
  authHeader: { test: "PAYU_TEST_AUTH_HEADER", live: "PAYU_LIVE_AUTH_HEADER", legacy: "PAYU_AUTH_HEADER" },
} as const;

function resolveEnvVar(keys: { test: string; live: string; legacy: string }, environment: PayuEnvironment): string {
  return process.env[keys[environment]] || process.env[keys.legacy] || "";
}

export function getPayuConfig(overrides?: Partial<PayuConfig>): PayuConfig {
  const rawEnv = overrides?.environment || process.env.PAYU_ENV || "test";
  const environment: PayuEnvironment = rawEnv === "live" ? "live" : "test";
  const isTestMode = environment === "test";

  const merchantKey = overrides?.merchantKey || resolveEnvVar(ENV_KEY_MAP.keyId, environment);
  const merchantSalt = overrides?.merchantSalt || resolveEnvVar(ENV_KEY_MAP.salt, environment);
  const authHeader = overrides?.authHeader || resolveEnvVar(ENV_KEY_MAP.authHeader, environment) || btoa(`${merchantKey}:${merchantSalt}`);

  if (!merchantKey) throw new Error("PayU merchant key is not configured. Set PAYU_MERCHANT_KEY env var.");
  if (!merchantSalt) throw new Error("PayU merchant salt is not configured. Set PAYU_MERCHANT_SALT env var.");

  return { merchantKey, merchantSalt, authHeader, environment, isTestMode };
}

export function getPayuApiBaseUrl(environment: PayuEnvironment): string {
  return environment === "test"
    ? "https://test.payu.in"
    : "https://secure.payu.in";
}

export function getPayuEnvironment(): PayuEnvironment {
  return process.env.PAYU_ENV === "live" ? "live" : "test";
}
