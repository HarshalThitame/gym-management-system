import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseServiceKey, getSupabaseUrl } from "./env";

type LeadRecord = {
  name: string;
  phone: string;
  email: string | null;
  source: "free_trial" | "membership_inquiry" | "contact";
  interest: string | null;
  message: string;
  preferred_trial_at: string | null;
  status: "new";
  consent_marketing: boolean;
  notes: string | null;
};

export function getSupabaseAdminClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceKey();

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
}

export function createAdminClient() {
  const client = getSupabaseAdminClient();

  if (!client) {
    throw new Error("Supabase admin client is not configured.");
  }

  return client;
}

export async function insertLead(record: LeadRecord) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return { stored: false, reason: "Supabase environment variables are not configured." };
  }

  const { error } = await supabase.from("leads").insert(record);

  if (error) {
    throw new Error(error.message);
  }

  return { stored: true, reason: null };
}
