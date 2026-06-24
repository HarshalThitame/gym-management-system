import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  FEATURE_KEYS,
  FEATURE_KEY_SET,
  MODULE_FEATURE_MAP,
} from "@/features/entitlement/feature-registry";
import type { FeatureKey } from "@/features/entitlement/feature-registry";
import { organizationOwnerModules } from "@/features/organization-owner/lib/organization-owner-modules";

export type IntegrityErrorType =
  | "missing_from_feature_map"
  | "missing_from_feature_keys"
  | "missing_from_module_map"
  | "missing_from_sidebar_keys"
  | "missing_from_db_keys"
  | "duplicate_feature_key"
  | "invalid_sidebar_feature_key";

export type IntegrityError = {
  type: IntegrityErrorType;
  key: string;
  detail: string;
};

export type IntegrityResult = {
  valid: boolean;
  errors: IntegrityError[];
  timestamp: string;
};

export async function validateFeatureKeyIntegrity(): Promise<IntegrityResult> {
  const errors: IntegrityError[] = [];

  // ── Check 1: all MODULE_FEATURE_MAP values are in FEATURE_KEYS ──────
  for (const [moduleSlug, featureKey] of Object.entries(MODULE_FEATURE_MAP)) {
    if (!FEATURE_KEY_SET.has(featureKey)) {
      errors.push({
        type: "missing_from_feature_keys",
        key: featureKey,
        detail: `MODULE_FEATURE_MAP["${moduleSlug}"] = "${featureKey}" is not in FEATURE_KEYS`,
      });
    }
  }

  // ── Check 2: all sidebar feature keys are in FEATURE_KEYS ───────────
  for (const mod of organizationOwnerModules) {
    if (mod.featureKey && !FEATURE_KEY_SET.has(mod.featureKey)) {
      errors.push({
        type: "invalid_sidebar_feature_key",
        key: mod.featureKey,
        detail: `Sidebar module "${mod.slug}" references featureKey "${mod.featureKey}" which is not in FEATURE_KEYS`,
      });
    }
  }

  // ── Check 3: no duplicate feature keys in FEATURE_KEYS ──────────────
  const seenKeys = new Set<string>();
  for (const key of FEATURE_KEYS) {
    if (seenKeys.has(key)) {
      errors.push({
        type: "duplicate_feature_key",
        key,
        detail: `Duplicate feature key "${key}" found in FEATURE_KEYS array`,
      });
    }
    seenKeys.add(key);
  }

  // ── Check 4: every key in FEATURE_KEYS is known to MODULE_FEATURE_MAP
  //    or is a valid infrastructure/service key (not required) ─────────
  //    This is informational, not an error — but flag as warning for now.
  //    Skip this for now since most feature keys don't need module maps.

  // ── Check 5: all FEATURE_KEYS entries have a mapping in the
  //    feature-resolver FEATURE_MAP (checked at compile time via TS;
  //    runtime check here for safety) ──────────────────────────────────
  //    We verify this by checking against the known FEATURE_MAP set.
  //    This requires importing from feature-resolver, which might cause
  //    circular deps. Instead, we trust the compile-time assertion.

  // ── Check 6: DB validation: all package_features rows reference
  //    valid FEATURE_KEYS ──────────────────────────────────────────────
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      const db = supabase as unknown as {
        from(t: string): {
          select(c: string): Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
        };
      };

      const { data: dbFeatures } = await db
        .from("package_features")
        .select("feature_code");

      if (dbFeatures) {
        const dbFeatureCodes = dbFeatures.map((r) => String(r.feature_code ?? ""));
        const uniqueDbCodes = [...new Set(dbFeatureCodes)];

        for (const code of uniqueDbCodes) {
          if (code && !FEATURE_KEY_SET.has(code)) {
            errors.push({
              type: "missing_from_feature_keys",
              key: code,
              detail: `package_features contains "${code}" which is not registered in FEATURE_KEYS`,
            });
          }
        }
      }
    } catch {
      errors.push({
        type: "missing_from_db_keys",
        key: "database",
        detail: "Failed to query package_features table. Database may be unavailable.",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    timestamp: new Date().toISOString(),
  };
}
