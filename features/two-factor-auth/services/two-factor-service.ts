import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type TwoFactorMethod = "totp" | "email" | "sms";

export type TwoFactorMethodRow = Database["public"]["Tables"]["user_2fa_methods"]["Row"];
export type TwoFactorAttemptRow = Database["public"]["Tables"]["user_2fa_attempts"]["Row"];
export type TwoFactorRecoveryCodeRow = Database["public"]["Tables"]["user_2fa_recovery_codes"]["Row"];
export type TwoFactorPreferenceRow = Database["public"]["Tables"]["user_2fa_preferences"]["Row"];

export type TwoFactorStatus = {
  isEnabled: boolean;
  methods: TwoFactorMethodRow[];
  preferences: TwoFactorPreferenceRow | null;
  hasRecoveryCodes: boolean;
};

export type TwoFactorSetupResult = {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
};

export async function getUserTwoFactorStatus(userId: string): Promise<TwoFactorStatus> {
  const supabase = await createSupabaseServerClient();

  const [methodsResult, preferencesResult, recoveryCodesResult] = await Promise.all([
    supabase
      .from("user_2fa_methods")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_2fa_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_2fa_recovery_codes")
      .select("id")
      .eq("user_id", userId)
      .is("used_at", null)
      .limit(1)
  ]);

  if (methodsResult.error) throw new Error(methodsResult.error.message);
  if (preferencesResult.error) throw new Error(preferencesResult.error.message);
  if (recoveryCodesResult.error) throw new Error(recoveryCodesResult.error.message);

  const methods = methodsResult.data ?? [];
  const isEnabled = methods.some((m) => m.is_enabled && m.is_verified);

  return {
    isEnabled,
    methods,
    preferences: preferencesResult.data,
    hasRecoveryCodes: (recoveryCodesResult.data ?? []).length > 0
  };
}

export async function checkUserHasTwoFactor(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("user_has_2fa_enabled", { p_user_id: userId });

  if (error) {
    console.error("[2FA] Failed to check 2FA status:", error);
    return false;
  }

  return data ?? false;
}

export async function getRecentFailedAttempts(userId: string, minutes: number = 15): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_recent_2fa_failed_attempts", {
    p_user_id: userId,
    p_minutes: minutes
  });

  if (error) {
    console.error("[2FA] Failed to get failed attempts:", error);
    return 0;
  }

  return data ?? 0;
}

export async function recordTwoFactorAttempt(
  userId: string,
  methodType: TwoFactorMethod,
  success: boolean,
  metadata?: { ipAddress?: string; userAgent?: string; failureReason?: string }
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("user_2fa_attempts").insert({
    user_id: userId,
    method_type: methodType,
    ip_address: metadata?.ipAddress ?? null,
    user_agent: metadata?.userAgent ?? null,
    success,
    failure_reason: metadata?.failureReason ?? null
  });

  if (error) {
    console.error("[2FA] Failed to record attempt:", error);
  }
}

export async function getTwoFactorMethod(userId: string, methodType: TwoFactorMethod): Promise<TwoFactorMethodRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_2fa_methods")
    .select("*")
    .eq("user_id", userId)
    .eq("method_type", methodType)
    .maybeSingle();

  if (error) {
    console.error("[2FA] Failed to get method:", error);
    return null;
  }

  return data;
}

export async function enableTwoFactorMethod(
  userId: string,
  methodType: TwoFactorMethod,
  secretKey?: string,
  phoneNumber?: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("user_2fa_methods").upsert({
    user_id: userId,
    method_type: methodType,
    is_enabled: true,
    is_verified: true,
    secret_key: secretKey ?? null,
    phone_number: phoneNumber ?? null,
    last_used_at: null
  }, { onConflict: "user_id,method_type" });

  if (error) throw new Error(error.message);
}

export async function disableTwoFactorMethod(userId: string, methodType: TwoFactorMethod): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("user_2fa_methods")
    .delete()
    .eq("user_id", userId)
    .eq("method_type", methodType);

  if (error) throw new Error(error.message);
}

export async function disableAllTwoFactorMethods(userId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("user_2fa_methods")
    .delete()
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  // Also delete recovery codes
  await supabase
    .from("user_2fa_recovery_codes")
    .delete()
    .eq("user_id", userId);
}

export async function updateTwoFactorLastUsed(userId: string, methodType: TwoFactorMethod): Promise<void> {
  const supabase = await createSupabaseServerClient();

  await supabase
    .from("user_2fa_methods")
    .update({ last_used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("method_type", methodType);
}

export async function updateUserTwoFactorPreferences(
  userId: string,
  preferences: {
    require_2fa?: boolean;
    preferred_method?: TwoFactorMethod;
    remember_device_days?: number;
  }
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("user_2fa_preferences").upsert({
    user_id: userId,
    require_2fa: preferences.require_2fa ?? false,
    preferred_method: preferences.preferred_method ?? null,
    remember_device_days: preferences.remember_device_days ?? 30
  }, { onConflict: "user_id" });

  if (error) throw new Error(error.message);
}

export async function storeRecoveryCodes(userId: string, codes: string[]): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // Delete existing codes
  await supabase
    .from("user_2fa_recovery_codes")
    .delete()
    .eq("user_id", userId);

  // Insert new codes
  const codesToInsert = codes.map((code) => ({
    user_id: userId,
    code_hash: code, // In production, hash these
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year expiry
  }));

  const { error } = await supabase.from("user_2fa_recovery_codes").insert(codesToInsert);
  if (error) throw new Error(error.message);
}

export async function validateRecoveryCode(userId: string, code: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("user_2fa_recovery_codes")
    .select("id")
    .eq("user_id", userId)
    .eq("code_hash", code) // In production, compare hashes
    .is("used_at", null)
    .maybeSingle();

  if (error || !data) return false;

  // Mark as used
  await supabase
    .from("user_2fa_recovery_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", data.id);

  return true;
}

export async function getRemainingRecoveryCodes(userId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const { count, error } = await supabase
    .from("user_2fa_recovery_codes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("used_at", null);

  if (error) return 0;
  return count ?? 0;
}
