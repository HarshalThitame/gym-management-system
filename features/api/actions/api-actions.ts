"use server";

import {
  createApiKey,
  getUserApiKeys,
  revokeApiKey,
  getApiUsageStats,
  type ApiScope,
} from "../services/api-key-service";

/**
 * Create a new API key
 */
export async function createApiKeyAction(
  name: string,
  scopes: ApiScope[],
  expiresAt?: string
) {
  return createApiKey(name, scopes, expiresAt);
}

/**
 * Get user's API keys
 */
export async function getUserApiKeysAction() {
  return getUserApiKeys();
}

/**
 * Revoke an API key
 */
export async function revokeApiKeyAction(keyId: string) {
  return revokeApiKey(keyId);
}

/**
 * Get API usage statistics
 */
export async function getApiUsageStatsAction(keyId: string, days: number = 30) {
  return getApiUsageStats(keyId, days);
}
