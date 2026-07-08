import "server-only";

import type { IPaymentProvider, PaymentProviderName } from "./provider-types";
import { getRazorpayProvider } from "@/features/billing/razorpay/razorpay-provider-adapter";
import { getPayuProvider } from "@/features/billing/payu/payu-service";
import { getGymProviderConfig } from "./provider-config-service";
import { billingLogger } from "@/features/billing/lib/logger";

const providerCache = new Map<string, IPaymentProvider>();

export async function getProviderForGym(gymId: string, providerName?: PaymentProviderName): Promise<{
  ok: true;
  provider: IPaymentProvider;
  providerName: PaymentProviderName;
} | {
  ok: false;
  message: string;
}> {
  const cacheKey = providerName ? `${gymId}:${providerName}` : `${gymId}:default`;

  const cached = providerCache.get(cacheKey);
  if (cached) return { ok: true, provider: cached, providerName: cached.name };

  let configResult;
  if (providerName) {
    configResult = await getGymProviderConfig(gymId, providerName);
  } else {
    configResult = await getGymDefaultProvider(gymId);
  }

  if (!configResult.ok) {
    if (providerName) {
      billingLogger.warn("getProviderForGym", `No DB config found for ${providerName}, falling back to env defaults`, { gymId });
      return getEnvFallbackProvider(providerName);
    }
    return { ok: false, message: configResult.message };
  }

  const { config, provider: resolvedName, testMode } = configResult.config;

  let provider: IPaymentProvider;
  switch (resolvedName) {
    case "razorpay":
      provider = getRazorpayProvider(config, testMode);
      break;
    case "payu":
      provider = getPayuProvider(config, testMode);
      break;
    default:
      return { ok: false, message: `Unsupported provider: ${resolvedName}` };
  }

  providerCache.set(cacheKey, provider);
  return { ok: true, provider, providerName: resolvedName };
}

async function getGymDefaultProvider(gymId: string) {
  const { getGymDefaultProvider: fetchDefault } = await import("./provider-config-service");
  return fetchDefault(gymId);
}

function getEnvFallbackProvider(providerName: PaymentProviderName): Promise<{
  ok: true;
  provider: IPaymentProvider;
  providerName: PaymentProviderName;
} | {
  ok: false;
  message: string;
}> {
  switch (providerName) {
    case "razorpay":
      return Promise.resolve({
        ok: true,
        provider: getRazorpayProvider({}, false),
        providerName: "razorpay",
      });
    case "payu":
      return Promise.resolve({
        ok: true,
        provider: getPayuProvider({}, false),
        providerName: "payu",
      });
    default:
      return Promise.resolve({ ok: false, message: `Unsupported provider: ${providerName}` });
  }
}

export function clearProviderCache(): void {
  providerCache.clear();
}
