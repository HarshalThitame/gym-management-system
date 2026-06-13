import type { DbClient } from "./db-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";


function getDb(supabase: unknown): DbClient { return supabase as never as DbClient; }

export type GatewayProvider = "razorpay" | "stripe" | "paypal" | "manual";

export async function getActiveGateway(gymId: string): Promise<Record<string, unknown> | null> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: gateway } = await db.from("payment_gateway_configs")
    .select("*")
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .eq("is_default", true)
    .limit(1);

  const gateways = gateway ?? [];
  return gateways.length > 0 ? gateways[0]! : null;
}

export async function getGatewayConfig(gymId: string, provider: GatewayProvider): Promise<Record<string, unknown> | null> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data } = await db.from("payment_gateway_configs")
    .select("*")
    .eq("gym_id", gymId)
    .eq("provider", provider)
    .maybeSingle();

  return data;
}

export async function setDefaultGateway(gymId: string, provider: GatewayProvider): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const config = await getGatewayConfig(gymId, provider);
  if (!config) return { ok: false, message: `No config found for ${provider}.` };

  const { error: clearErr } = await db.from("payment_gateway_configs").update({
    is_default: false,
  }).eq("gym_id", gymId);

  if (clearErr) return { ok: false, message: clearErr.message };

  const { error } = await db.from("payment_gateway_configs").update({
    is_default: true,
    is_active: true,
  }).eq("gym_id", gymId).eq("provider", provider);

  if (error) return { ok: false, message: error.message };
  return { ok: true, message: `${provider} set as default gateway.` };
}

export async function upsertGatewayConfig(
  gymId: string,
  provider: GatewayProvider,
  config: {
    apiKey?: string;
    secret?: string;
    webhookSecret?: string;
    supportedPaymentTypes?: string[];
    testMode?: boolean;
    priority?: number;
  }
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const existing = await getGatewayConfig(gymId, provider);
  const payload: Record<string, unknown> = {
    config: {
      api_key: config.apiKey ?? "",
      secret: config.secret ? "••••" : undefined,
      webhook_secret: config.webhookSecret ? "••••" : undefined,
    },
    supported_payment_types: config.supportedPaymentTypes ?? ["card", "upi"],
    test_mode: config.testMode ?? true,
    priority: config.priority ?? 0,
    gym_id: gymId,
    provider,
  };

  if (!existing) {
    payload.is_active = true;
    const { error } = await db.from("payment_gateway_configs").insert(payload);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await db.from("payment_gateway_configs").update(payload).eq("gym_id", gymId).eq("provider", provider);
    if (error) return { ok: false, message: error.message };
  }

  return { ok: true, message: `${provider} configuration saved.` };
}
