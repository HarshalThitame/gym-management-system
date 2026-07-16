import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { billingLogger } from "@/features/billing/lib/logger";
import type { PaymentProviderName, ProviderConfig } from "@/features/billing/providers/provider-types";

type PlatformConfigRow = {
  id: string;
  provider: string;
  is_active: boolean;
  is_default: boolean;
  priority: number;
  test_mode: boolean;
  config: Record<string, string>;
  supported_payment_types: string[];
};

export type PlatformProviderConfigResult =
  | { ok: true; config: ProviderConfig }
  | { ok: false; message: string };

function mapRow(row: PlatformConfigRow): ProviderConfig {
  return {
    provider: row.provider as PaymentProviderName,
    isActive: row.is_active,
    isDefault: row.is_default,
    priority: row.priority,
    testMode: row.test_mode,
    config: row.config,
  };
}

export async function getPlatformProviderConfig(provider: PaymentProviderName): Promise<PlatformProviderConfigResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const { data, error } = await admin
    .from("platform_payment_gateway_configs")
    .select("*")
    .eq("provider", provider)
    .maybeSingle() as never as {
    data: PlatformConfigRow | null;
    error: { message: string } | null;
  };

  if (error) {
    billingLogger.error("getPlatformProviderConfig", "Failed to fetch platform provider config", { provider, error: error.message });
    return { ok: false, message: error.message };
  }

  if (!data) {
    return { ok: false, message: `No platform configuration found for ${provider}` };
  }

  return { ok: true, config: mapRow(data) };
}

export async function getPlatformDefaultProvider(): Promise<PlatformProviderConfigResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const { data, error } = await admin
    .from("platform_payment_gateway_configs")
    .select("*")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("priority", { ascending: true })
    .limit(1)
    .maybeSingle() as never as {
    data: PlatformConfigRow | null;
    error: { message: string } | null;
  };

  if (error) {
    billingLogger.error("getPlatformDefaultProvider", "Failed to fetch default platform provider", { error: error.message });
    return { ok: false, message: error.message };
  }

  if (!data) {
    return { ok: false, message: "No active platform payment gateway configured" };
  }

  return { ok: true, config: mapRow(data) };
}

export async function listPlatformProviders(): Promise<{ ok: true; providers: ProviderConfig[] } | { ok: false; message: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const { data, error } = await admin
    .from("platform_payment_gateway_configs")
    .select("*")
    .order("priority", { ascending: true }) as never as {
    data: PlatformConfigRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    billingLogger.error("listPlatformProviders", "Failed to list platform providers", { error: error.message });
    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    providers: (data ?? []).map(mapRow),
  };
}

export async function upsertPlatformProviderConfig(
  provider: PaymentProviderName,
  input: {
    isActive: boolean;
    isDefault: boolean;
    priority: number;
    testMode: boolean;
    config: Record<string, string>;
    supportedPaymentTypes: string[];
  },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  if (input.isDefault) {
    const { error: resetError } = await admin
      .from("platform_payment_gateway_configs")
      .update({ is_default: false } as never)
      .eq("is_default", true)
      .neq("provider", provider) as never as {
      error: { message: string } | null;
    };

    if (resetError) {
      billingLogger.error("upsertPlatformProviderConfig", "Failed to reset default provider", { provider, error: resetError.message });
      return { ok: false, message: resetError.message };
    }
  }

  const payload = {
    provider,
    is_active: input.isActive,
    is_default: input.isDefault,
    priority: input.priority,
    test_mode: input.testMode,
    config: input.config,
    supported_payment_types: input.supportedPaymentTypes,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from("platform_payment_gateway_configs").upsert(payload as never, { onConflict: "provider" }) as never as {
    error: { message: string } | null;
  };

  if (error) {
    billingLogger.error("upsertPlatformProviderConfig", "Failed to upsert platform provider config", { provider, error: error.message });
    return { ok: false, message: error.message };
  }

  billingLogger.info("upsertPlatformProviderConfig", "Platform provider config saved", { provider });
  return { ok: true, message: "Configuration saved" };
}
