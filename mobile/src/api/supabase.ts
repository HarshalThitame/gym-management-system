import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, hasSupabaseConfig } from "@/lib/env";
import { secureStorage, STORAGE_KEYS } from "@/storage/secure";

let supabaseInstance: SupabaseClient | null = null;

let supabaseInitError: Error | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  if (!hasSupabaseConfig()) {
    if (!supabaseInitError) {
      supabaseInitError = new Error("Supabase is not configured");
      console.warn("[Supabase] Not configured - using stub client");
    }
    return createClient("https://placeholder.supabase.co", "placeholder-key", { auth: { persistSession: false } });
  }

  try {
    supabaseInstance = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: {
          getItem: async (key: string) => {
            const value = await secureStorage.get(key as never);
            return value;
          },
          setItem: async (key: string, value: string) => {
            await secureStorage.set(key as never, value);
          },
          removeItem: async (key: string) => {
            await secureStorage.delete(key as never);
          },
        },
      },
      global: {
        headers: {
          "x-app-version": "1.0.0",
          "x-platform": "mobile",
        },
      },
    });
  } catch (e) {
    console.warn("[Supabase] Client creation failed:", e);
    supabaseInitError = e instanceof Error ? e : new Error(String(e));
    return createClient("https://placeholder.supabase.co", "placeholder-key", { auth: { persistSession: false } });
  }

  return supabaseInstance!;
}

export function hasSupabaseError(): Error | null {
  return supabaseInitError;
}

export async function restoreSession() {
  try {
    const supabase = getSupabaseClient();

    const timeoutResult = { data: null as any, error: new Error("Timeout") as any };
    const timeout = new Promise<any>((resolve) => setTimeout(() => resolve(timeoutResult), 8000));

    const result = await Promise.race([supabase.auth.getSession(), timeout]);

    if (!result || result.error || !result.data?.session) {
      return null;
    }

    const session = result.data.session;
    if (session.expires_at && session.expires_at * 1000 < Date.now()) {
      const refreshResult = await Promise.race([supabase.auth.refreshSession(), timeout]);
      if (!refreshResult || refreshResult.error || !refreshResult.data?.session) {
        await clearSession().catch(() => {});
        return null;
      }
      return refreshResult.data.session;
    }

    return session;
  } catch {
    return null;
  }
}

export async function clearSession() {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut();
  await secureStorage.clear();
}

export function resetSupabaseClient(): void {
  supabaseInstance = null;
}
