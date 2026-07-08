import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { billingLogger } from "@/features/billing/lib/logger";
import type { PaymentProviderName, ProviderConfig } from "./provider-types";

export type ProviderConfigResult =
  | { ok: true; config: ProviderConfig }
  | { ok: false; message: string };

export async function getGymProviderConfig(gymId: string, provider: PaymentProviderName): Promise<ProviderConfigResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const { data, error } = await admin
    .from("payment_gateway_configs")
    .select("*")
    .eq("gym_id", gymId)
    .eq("provider", provider)
    .maybeSingle() as never as {
    data: {
      id: string;
      gym_id: string;
      provider: string;
      is_active: boolean;
      is_default: boolean;
      config: Record<string, string>;
      supported_payment_types: string[];
      priority: number;
      test_mode: boolean;
    } | null;
    error: { message: string } | null;
  };

  if (error) {
    billingLogger.error("getGymProviderConfig", "Failed to fetch provider config", { gymId, provider, error: error.message });
    return { ok: false, message: error.message };
  }

  if (!data) {
    return { ok: false, message: `No configuration found for ${provider} in this gym` };
  }

  return {
    ok: true,
    config: {
      provider: data.provider as PaymentProviderName,
      isActive: data.is_active,
      isDefault: data.is_default,
      priority: data.priority,
      testMode: data.test_mode,
      config: data.config,
    },
  };
}

export async function getGymDefaultProvider(gymId: string): Promise<ProviderConfigResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const { data, error } = await admin
    .from("payment_gateway_configs")
    .select("*")
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .limit(1)
    .maybeSingle() as never as {
    data: {
      id: string;
      gym_id: string;
      provider: string;
      is_active: boolean;
      is_default: boolean;
      config: Record<string, string>;
      supported_payment_types: string[];
      priority: number;
      test_mode: boolean;
    } | null;
    error: { message: string } | null;
  };

  if (error) {
    billingLogger.error("getGymDefaultProvider", "Failed to fetch default provider", { gymId, error: error.message });
    return { ok: false, message: error.message };
  }

  if (!data) {
    return { ok: false, message: "No active payment gateway configured for this gym" };
  }

  return {
    ok: true,
    config: {
      provider: data.provider as PaymentProviderName,
      isActive: data.is_active,
      isDefault: data.is_default,
      priority: data.priority,
      testMode: data.test_mode,
      config: data.config,
    },
  };
}

export async function upsertGymProviderConfig(
  gymId: string,
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

  const { error } = await admin.from("payment_gateway_configs").upsert({
    gym_id: gymId,
    provider,
    is_active: input.isActive,
    is_default: input.isDefault,
    priority: input.priority,
    test_mode: input.testMode,
    config: input.config,
    supported_payment_types: input.supportedPaymentTypes,
  } as never, { onConflict: "gym_id, provider" }) as never as {
    error: { message: string } | null;
  };

  if (error) {
    billingLogger.error("upsertGymProviderConfig", "Failed to upsert provider config", { gymId, provider, error: error.message });
    return { ok: false, message: error.message };
  }

  billingLogger.info("upsertGymProviderConfig", "Provider config saved", { gymId, provider });
  return { ok: true, message: "Configuration saved" };
}

export async function listGymProviders(gymId: string): Promise<{ ok: true; providers: ProviderConfig[] } | { ok: false; message: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Database not configured" };

  const { data, error } = await admin
    .from("payment_gateway_configs")
    .select("*")
    .eq("gym_id", gymId)
    .order("priority", { ascending: true }) as never as {
    data: Array<{
      id: string;
      gym_id: string;
      provider: string;
      is_active: boolean;
      is_default: boolean;
      config: Record<string, string>;
      supported_payment_types: string[];
      priority: number;
      test_mode: boolean;
    }> | null;
    error: { message: string } | null;
  };

  if (error) {
    billingLogger.error("listGymProviders", "Failed to list providers", { gymId, error: error.message });
    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    providers: (data ?? []).map((p) => ({
      provider: p.provider as PaymentProviderName,
      isActive: p.is_active,
      isDefault: p.is_default,
      priority: p.priority,
      testMode: p.test_mode,
      config: p.config,
    })),
  };
}
