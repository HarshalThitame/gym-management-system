import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sdb } from "./security-db";
import { checkIpReputation } from "./security-threat-intel-service";

const COMMON_PASSWORDS = new Set(["password", "password123", "123456", "12345678", "qwerty", "admin", "letmein", "welcome"]);

const BREACHED_PASSWORDS = new Set(["password123!", "admin123!", "test1234!", "qwerty123!"]);

export async function getPasswordPolicies(organizationId?: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  let q = db.from("password_policies").select("*").eq("is_active", true);
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data } = await q.order("created_at", { ascending: false }).limit(1);
  return (data ?? [])[0] as Record<string, unknown> | null;
}

export async function validatePassword(password: string, organizationId?: string): Promise<{ valid: boolean; errors: string[]; score: number }> {
  const errors: string[] = [];
  let score = 0;

  const policy = await getPasswordPolicies(organizationId);
  const minLen = (policy?.min_length as number) ?? 10;
  const requireUpper = (policy?.require_uppercase as boolean) ?? true;
  const requireLower = (policy?.require_lowercase as boolean) ?? true;
  const requireNum = (policy?.require_numbers as boolean) ?? true;
  const requireSpecial = (policy?.require_special as boolean) ?? false;
  const preventCommon = (policy?.prevent_common as boolean) ?? true;
  const preventBreached = (policy?.prevent_breached as boolean) ?? true;

  if (password.length < minLen) errors.push(`Must be at least ${minLen} characters`);
  else score += Math.min(30, password.length * 2);

  if (requireUpper && !/[A-Z]/.test(password)) errors.push("Must contain uppercase letter");
  else score += 15;

  if (requireLower && !/[a-z]/.test(password)) errors.push("Must contain lowercase letter");
  else score += 15;

  if (requireNum && !/[0-9]/.test(password)) errors.push("Must contain a number");
  else score += 10;

  if (requireSpecial && !/[^A-Za-z0-9]/.test(password)) errors.push("Must contain a special character");
  else score += 10;

  if (preventCommon && COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("This password is too common");
  } else {
    score += 10;
  }

  if (preventBreached && BREACHED_PASSWORDS.has(password.toLowerCase())) {
    errors.push("This password has appeared in data breaches");
  } else if (preventBreached) {
    score += 10;
  }

  return { valid: errors.length === 0, errors, score: Math.min(100, score) };
}

export async function checkPasswordBreached(password: string): Promise<boolean> {
  const hash = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  const prefix = hashHex.slice(0, 5);

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    const text = await res.text();
    return text.includes(hashHex.slice(5));
  } catch {
    return BREACHED_PASSWORDS.has(password.toLowerCase());
  }
}

export async function createPasswordPolicy(input: Record<string, unknown>) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  const { data, error } = await db.from("password_policies").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}
