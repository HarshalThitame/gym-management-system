import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { billingLogger } from "@/features/billing/lib/logger";
import type { PaymentProviderName, PaymentProviderHealth } from "@/features/billing/providers/provider-types";
import { getPlatformProviderConfig } from "@/features/billing/services/platform-provider-config-service";
import { getRazorpayProvider } from "@/features/billing/razorpay/razorpay-provider-adapter";
import { getRazorpayConfig, maskRazorpayKey } from "@/features/billing/razorpay/razorpay-config";
import { normalizeRazorpayProviderConfig } from "@/features/billing/razorpay/razorpay-provider-config";
import { preflightRazorpayCredentials } from "@/features/billing/razorpay/razorpay-service";

const ALLOWED_PROVIDERS: PaymentProviderName[] = ["razorpay"];

type TestResult = {
  ok: boolean;
  provider: PaymentProviderName;
  runtimeSource: "platform table" | "env fallback" | "not configured";
  message: string;
  health: PaymentProviderHealth | null;
  keyIdMasked?: string;
  missingFields?: string[];
};

function getMissingRazorpayFields(config: Record<string, string>): string[] {
  const hasAny = (keys: string[]) => keys.some((key) => typeof config[key] === "string" && config[key].trim().length > 0);
  const missing: string[] = [];

  if (!hasAny(["keyId", "key_id", "public_key_id", "publicKeyId"])) missing.push("key_id");
  if (!hasAny(["keySecret", "key_secret", "secret", "secret_key"])) missing.push("key_secret");
  if (!hasAny(["webhookSecret", "webhook_secret"])) missing.push("webhook_secret");

  return missing;
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["super_admin"], { skipSubscriptionCheck: true });
  if (!auth.ok) return auth.response;

  const body = await request.json() as { provider?: string };
  if (!body.provider || !ALLOWED_PROVIDERS.includes(body.provider as PaymentProviderName)) {
    return NextResponse.json(
      { error: `Invalid provider. Must be one of: ${ALLOWED_PROVIDERS.join(", ")}` },
      { status: 400 },
    );
  }

  const provider = body.provider as PaymentProviderName;

  if (provider === "razorpay") {
    const platformResult = await getPlatformProviderConfig("razorpay");
    const usingPlatformTable = platformResult.ok && platformResult.config.isActive;
    const runtimeSource = usingPlatformTable ? "platform table" : "env fallback";

    let rawConfig: Record<string, string>;
    let testMode: boolean | undefined;

    try {
      if (usingPlatformTable) {
        rawConfig = platformResult.config.config;
        testMode = platformResult.config.testMode;
      } else {
        const envConfig = getRazorpayConfig();
        rawConfig = {
          key_id: envConfig.keyId,
          key_secret: envConfig.keySecret,
          webhook_secret: envConfig.webhookSecret,
          environment: envConfig.environment,
        };
        testMode = envConfig.isTestMode;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Razorpay environment is incomplete.";
      const response: TestResult = {
        ok: false,
        provider,
        runtimeSource: usingPlatformTable ? "platform table" : "not configured",
        message,
        health: null,
        missingFields: ["key_id", "key_secret", "webhook_secret"],
      };
      return NextResponse.json(response, { status: 422 });
    }

    const normalized = normalizeRazorpayProviderConfig(rawConfig, testMode);

    if (!normalized) {
      const response: TestResult = {
        ok: false,
        provider,
        runtimeSource: usingPlatformTable ? "platform table" : "not configured",
        message: "Razorpay configuration is incomplete. Save Key ID and Key Secret before testing.",
        health: null,
        missingFields: getMissingRazorpayFields(rawConfig),
      };
      return NextResponse.json(response, { status: 422 });
    }

    const adapterConfig: Record<string, string> = {
      key_id: normalized.keyId,
      key_secret: normalized.keySecret,
      environment: normalized.environment,
    };
    if (normalized.webhookSecret) {
      adapterConfig.webhook_secret = normalized.webhookSecret;
    }

    const providerAdapter = getRazorpayProvider(adapterConfig, normalized.isTestMode);
    const health = providerAdapter.getHealth();
    const authCheck = await preflightRazorpayCredentials(normalized);
    if (!authCheck.ok) {
      const response: TestResult = {
        ok: false,
        provider,
        runtimeSource,
        message: authCheck.message,
        health,
        keyIdMasked: maskRazorpayKey(providerAdapter.getPublicKey()),
        missingFields: [],
      };

      billingLogger.warn("payment-gateway-test", "Platform Razorpay auth preflight failed", {
        actorId: auth.context.userId,
        runtimeSource,
        environment: normalized.environment,
        status: authCheck.status,
      });

      return NextResponse.json(response, { status: 422 });
    }

    const response: TestResult = {
      ok: authCheck.ok && health.configured,
      provider,
      runtimeSource,
      message: authCheck.message,
      health,
      keyIdMasked: maskRazorpayKey(providerAdapter.getPublicKey()),
      missingFields: health.configured ? [] : getMissingRazorpayFields(rawConfig),
    };

    billingLogger.info("payment-gateway-test", "Platform Razorpay test completed", {
      actorId: auth.context.userId,
      runtimeSource,
      configured: health.configured,
      environment: normalized.environment,
      authStatus: authCheck.status,
    });

    return NextResponse.json(response, { status: health.configured ? 200 : 422 });
  }

  return NextResponse.json(
    {
      ok: false,
      provider,
      runtimeSource: "not configured",
      message: "Only Razorpay is supported for platform payment gateway testing.",
      health: null,
      missingFields: [],
    } satisfies TestResult,
    { status: 400 },
  );
}
