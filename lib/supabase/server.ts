import { createServerClient } from "@supabase/ssr";
import { cookies, type UnsafeUnwrappedCookies } from "next/headers";
import type { Database } from "@/types/database";
import { getRequiredSupabasePublicConfig } from "./env";

export async function createSupabaseServerClient() {
  const { url, publishableKey } = getRequiredSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. Middleware refreshes sessions for them.
        }
      }
    }
  });
}

/**
 * Backward-compatible sync helper for older server modules.
 * New code should prefer `await createSupabaseServerClient()`.
 */
export function createClient() {
  const { url, publishableKey } = getRequiredSupabasePublicConfig();
  const cookieStore = cookies() as unknown as UnsafeUnwrappedCookies;

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. Middleware refreshes sessions for them.
        }
      }
    }
  });
}
