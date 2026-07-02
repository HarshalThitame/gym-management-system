import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ApiKey = {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiKeyWithKey = ApiKey & {
  key: string; // Only returned on creation
};

export type ApiUsageLog = {
  id: string;
  api_key_id: string | null;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type ApiScope =
  | "read:members"
  | "write:members"
  | "read:leads"
  | "write:leads"
  | "read:attendance"
  | "write:attendance"
  | "read:payments"
  | "read:reports";

/**
 * Generate a new API key
 */
export async function createApiKey(
  name: string,
  scopes: ApiScope[],
  expiresAt?: string
): Promise<ApiKeyWithKey> {
  const supabase = createClient();
  const adminClient = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Get user's organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    throw new Error("User has no organization");
  }

  // Generate API key using database function
  const { data: key, error: keyError } = await adminClient.rpc("generate_api_key");

  if (keyError || !key) {
    throw new Error("Failed to generate API key");
  }

  // Hash the key
  const { data: keyHash, error: hashError } = await adminClient.rpc("hash_api_key", {
    p_key: key,
  });

  if (hashError || !keyHash) {
    throw new Error("Failed to hash API key");
  }

  // Store the API key
  const { data, error } = await adminClient
    .from("api_keys")
    .insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      name,
      key_hash: keyHash,
      key_prefix: key.substring(0, 12),
      scopes,
      is_active: true,
      expires_at: expiresAt || null,
    })
    .select()
    .single();

  if (error) {
    console.error("[API] Failed to create API key:", error);
    throw error;
  }

  return {
    ...data,
    key, // Return the unhashed key only on creation
  };
}

/**
 * Get user's API keys
 */
export async function getUserApiKeys(): Promise<ApiKey[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[API] Failed to get API keys:", error);
    return [];
  }

  return data || [];
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("api_keys")
    .update({ is_active: false })
    .eq("id", keyId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[API] Failed to revoke API key:", error);
    throw error;
  }
}

/**
 * Validate an API key and return its details
 */
export async function validateApiKey(key: string): Promise<ApiKey | null> {
  const adminClient = createAdminClient();

  const { data: keyId, error } = await adminClient.rpc("validate_api_key", {
    p_key: key,
  });

  if (error || !keyId) {
    return null;
  }

  const { data: apiKey } = await adminClient
    .from("api_keys")
    .select("*")
    .eq("id", keyId)
    .single();

  return apiKey;
}

/**
 * Log API usage
 */
export async function logApiUsage(
  apiKeyId: string | null,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const adminClient = createAdminClient();

  await adminClient.from("api_usage_logs").insert({
    api_key_id: apiKeyId,
    endpoint,
    method,
    status_code: statusCode,
    response_time_ms: responseTimeMs,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
  });
}

/**
 * Check if API key has required scope
 */
export function hasScope(apiKey: ApiKey, requiredScope: ApiScope): boolean {
  return apiKey.scopes.includes(requiredScope);
}

/**
 * Get API usage statistics
 */
export async function getApiUsageStats(keyId: string, days: number = 30) {
  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("api_usage_logs")
    .select("*")
    .eq("api_key_id", keyId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[API] Failed to get usage stats:", error);
    return { total: 0, success: 0, failed: 0, avgResponseTime: 0 };
  }

  const logs = data || [];
  const success = logs.filter((l) => l.status_code >= 200 && l.status_code < 300).length;
  const failed = logs.length - success;
  const avgResponseTime =
    logs.length > 0
      ? logs.reduce((sum, l) => sum + (l.response_time_ms || 0), 0) / logs.length
      : 0;

  return {
    total: logs.length,
    success,
    failed,
    avgResponseTime: Math.round(avgResponseTime),
  };
}
