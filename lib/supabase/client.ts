"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getRequiredSupabasePublicConfig } from "./env";

export function createSupabaseBrowserClient() {
  const { url, publishableKey } = getRequiredSupabasePublicConfig();
  return createBrowserClient<Database>(url, publishableKey);
}
