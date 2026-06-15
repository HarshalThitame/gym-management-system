import { getSupabaseClient } from "@/api/supabase";
import { secureStorage, STORAGE_KEYS } from "@/storage/secure";
import type { AuthTokens } from "./types";

const SESSION_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiry
const SESSION_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

let sessionCheckInterval: ReturnType<typeof setInterval> | null = null;

export async function getStoredTokens(): Promise<AuthTokens | null> {
  return secureStorage.getJSON<AuthTokens>(STORAGE_KEYS.SESSION_DATA);
}

export async function storeTokens(tokens: AuthTokens): Promise<void> {
  await secureStorage.setJSON(STORAGE_KEYS.SESSION_DATA, tokens);
}

export async function clearStoredTokens(): Promise<void> {
  await secureStorage.delete(STORAGE_KEYS.SESSION_DATA);
}

export function getTokenExpiry(tokens: AuthTokens): number {
  return tokens.expires_at;
}

export function isTokenExpired(tokens: AuthTokens): boolean {
  return tokens.expires_at * 1000 <= Date.now();
}

export function isTokenExpiringSoon(tokens: AuthTokens): boolean {
  return tokens.expires_at * 1000 - SESSION_REFRESH_THRESHOLD_MS <= Date.now();
}

export async function refreshTokens(): Promise<AuthTokens | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.refreshSession();

    if (error || !data.session) {
      await clearStoredTokens();
      return null;
    }

    const tokens: AuthTokens = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    };

    await storeTokens(tokens);
    return tokens;
  } catch {
    await clearStoredTokens();
    return null;
  }
}

export function startSessionMonitor(onExpired: () => void): () => void {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
  }

  sessionCheckInterval = setInterval(async () => {
    try {
      const tokens = await getStoredTokens();
      if (!tokens) {
        onExpired();
        return;
      }

      if (isTokenExpired(tokens)) {
        const refreshed = await refreshTokens();
        if (!refreshed) {
          onExpired();
        }
      } else if (isTokenExpiringSoon(tokens)) {
        await refreshTokens();
      }
    } catch {
      onExpired();
    }
  }, SESSION_CHECK_INTERVAL_MS);

  return () => {
    if (sessionCheckInterval) {
      clearInterval(sessionCheckInterval);
      sessionCheckInterval = null;
    }
  };
}

export function stopSessionMonitor(): void {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
  }
}
