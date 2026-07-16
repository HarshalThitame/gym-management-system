import "server-only";

import { getGymProviderConfig } from "@/features/billing/providers/provider-config-service";
import type { RazorpayEnvironment } from "./razorpay-types";

export type RazorpayProviderCredentials = {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
  environment: RazorpayEnvironment;
  isTestMode: boolean;
};

function readValue(config: Record<string, string> | null | undefined, keys: string[]): string | null {
  if (!config) return null;

  for (const key of keys) {
    const value = config[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

export function normalizeRazorpayProviderConfig(
  config: Record<string, string> | null | undefined,
  testMode?: boolean,
): RazorpayProviderCredentials | null {
  const keyId = readValue(config, ["keyId", "key_id", "public_key_id", "publicKeyId"]);
  const keySecret = readValue(config, ["keySecret", "key_secret", "secret", "secret_key"]);
  const webhookSecret = readValue(config, ["webhookSecret", "webhook_secret"]);
  const environment = (readValue(config, ["environment"]) === "live" ? "live" : "test") as RazorpayEnvironment;
  const isTestMode = testMode ?? environment !== "live";

  if (!keyId || !keySecret) {
    return null;
  }

  return {
    keyId,
    keySecret,
    webhookSecret: webhookSecret ?? undefined,
    environment: isTestMode ? "test" : environment,
    isTestMode,
  };
}

export function hasRazorpayProviderCredentials(config: Record<string, string> | null | undefined): boolean {
  return normalizeRazorpayProviderConfig(config) !== null;
}

export async function resolveRazorpayCredentialsForGym(gymId: string): Promise<RazorpayProviderCredentials | null> {
  const result = await getGymProviderConfig(gymId, "razorpay");
  if (!result.ok || !result.config.isActive) return null;
  return normalizeRazorpayProviderConfig(result.config.config, result.config.testMode);
}
