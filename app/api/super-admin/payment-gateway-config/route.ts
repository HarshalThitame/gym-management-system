import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { billingLogger } from "@/features/billing/lib/logger";
import type { PaymentProviderName } from "@/features/billing/providers/provider-types";
import { getPlatformDefaultProvider, listPlatformProviders, upsertPlatformProviderConfig } from "@/features/billing/services/platform-provider-config-service";

const ALLOWED_PROVIDERS: PaymentProviderName[] = ["razorpay"];

export async function GET() {
  const auth = await requireApiRole(["super_admin"], { skipSubscriptionCheck: true });
  if (!auth.ok) return auth.response;

  const result = await listPlatformProviders();
  if (!result.ok) {
    return NextResponse.json({ providers: [] });
  }

  const defaultProvider = await getPlatformDefaultProvider();
  return NextResponse.json({
    providers: result.providers,
    defaultProvider: defaultProvider.ok ? defaultProvider.config.provider : null,
  });
}

export async function PUT(request: Request) {
  const auth = await requireApiRole(["super_admin"], { skipSubscriptionCheck: true });
  if (!auth.ok) return auth.response;

  const body = await request.json() as {
    provider: string;
    isActive: boolean;
    isDefault: boolean;
    priority: number;
    testMode: boolean;
    supportedPaymentTypes?: string[];
    config: Record<string, string>;
  };

  if (!body.provider || !ALLOWED_PROVIDERS.includes(body.provider as PaymentProviderName)) {
    return NextResponse.json({ error: `Invalid provider. Must be one of: ${ALLOWED_PROVIDERS.join(", ")}` }, { status: 400 });
  }

  const result = await upsertPlatformProviderConfig(body.provider as PaymentProviderName, {
    isActive: body.isActive,
    isDefault: body.isDefault,
    priority: body.priority,
    testMode: body.testMode,
    config: body.config,
    supportedPaymentTypes: body.supportedPaymentTypes ?? ["card", "upi", "net_banking"],
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  billingLogger.info("platform-provider-config", "Platform provider config updated", {
    provider: body.provider,
    actorId: auth.context.userId,
  });

  return NextResponse.json({ ok: true, message: result.message });
}
