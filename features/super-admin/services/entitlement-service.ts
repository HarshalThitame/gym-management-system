import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type PackageEntitlement = {
  features: Record<string, boolean | number | string>;
  limits: Record<string, number>;
  pricing: Record<string, number>;
};

export type FeatureDefinition = {
  code: string;
  name: string;
  description: string | null;
  category: string;
  featureType: "boolean" | "numeric" | "text" | "json";
  defaultValue: unknown;
};

export type LimitDefinition = {
  code: string;
  label: string;
  value: number;
};

/**
 * Fetches all entitlements (features + limits + pricing) for a given package.
 */
export async function getPackageEntitlements(packageId: string): Promise<PackageEntitlement> {
  const supabase = await createSupabaseServerClient();
  const s = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
        order(k: string, o: { ascending: boolean }): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
      };
    };
  };

  const [featuresRes, limitsRes, pricingRes] = await Promise.all([
    s.from("package_features").select("feature_code, value").eq("package_id", packageId),
    s.from("package_limits").select("limit_code, value").eq("package_id", packageId),
    s.from("package_pricing").select("billing_period, price").eq("package_id", packageId),
  ]);

  const features: Record<string, boolean | number | string> = {};
  for (const f of (featuresRes.data ?? [])) {
    const val = f.value;
    if (val === true || val === "true") features[f.feature_code as string] = true;
    else if (val === false || val === "false") features[f.feature_code as string] = false;
    else if (typeof val === "number") features[f.feature_code as string] = val;
    else features[f.feature_code as string] = String(val ?? false);
  }

  const limits: Record<string, number> = {};
  for (const l of (limitsRes.data ?? [])) {
    limits[l.limit_code as string] = l.value as number;
  }

  const pricing: Record<string, number> = {};
  for (const p of (pricingRes.data ?? [])) {
    if (p.is_active !== false) pricing[p.billing_period as string] = p.price as number;
  }

  return { features, limits, pricing };
}

/**
 * Checks if an organization has a specific feature enabled.
 * The organization must have an active or valid-trial subscription.
 */
export async function organizationHasFeature(organizationId: string, featureCode: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return false;
  const s = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): {
          in(k: string, v: string[]): {
            order(k: string, o: { ascending: boolean }): {
              limit(n: number): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
            };
          };
        };
      };
    };
  };

  const { data: subs } = await s
    .from("organization_subscriptions")
    .select("status, trial_ends_at, package_id")
    .eq("organization_id", organizationId)
    .in("status", ["active", "trial"])
    .order("started_at", { ascending: false } as never)
    .limit(1);

  const sub = (subs ?? [])[0];
  if (!sub) return false;

  const status = sub.status as string;
  if (status !== "active" && status !== "trial") return false;
  if (status === "trial") {
    const trialEnds = sub.trial_ends_at as string | null;
    if (trialEnds && new Date(trialEnds).getTime() < Date.now()) return false;
  }

  const packageId = sub.package_id as string;
  if (!packageId) return false;

  const { data: feature } = await (s as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): {
          eq(k2: string, v2: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
        };
      };
    };
  }).from("package_features").select("value").eq("package_id", packageId).eq("feature_code", featureCode);

  const feat = (feature ?? [])[0];
  if (!feat) return false;
  const val = feat.value;
  return val === true || val === "true";
}

/**
 * Checks if an organization is within a specific limit.
 */
export async function checkOrganizationLimit(
  organizationId: string,
  limitCode: string,
  currentUsage: number,
): Promise<{ withinLimit: boolean; limit: number; usage: number }> {
  const supabase = await createSupabaseServerClient();
  const s = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): {
          in(k: string, v: string[]): {
            order(k: string, o: { ascending: boolean }): {
              limit(n: number): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
            };
          };
        };
      };
    };
  };

  const { data: subs } = await s
    .from("organization_subscriptions")
    .select("package_id")
    .eq("organization_id", organizationId)
    .in("status", ["active", "trial"])
    .order("started_at", { ascending: false } as never)
    .limit(1);

  const sub = (subs ?? [])[0];
  if (!sub) return { withinLimit: false, limit: 0, usage: currentUsage };

  const packageId = sub.package_id as string;
  if (!packageId) return { withinLimit: false, limit: 0, usage: currentUsage };

  const { data: limitRows } = await (s as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): {
          eq(k2: string, v2: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
        };
      };
    };
  }).from("package_limits").select("value").eq("package_id", packageId).eq("limit_code", limitCode);

  const limitRow = (limitRows ?? [])[0];
  if (!limitRow) return { withinLimit: true, limit: -1, usage: currentUsage };

  const limitVal = limitRow.value as number;
  if (limitVal === -1) return { withinLimit: true, limit: -1, usage: currentUsage };

  return { withinLimit: currentUsage <= limitVal, limit: limitVal, usage: currentUsage };
}

/**
 * Fetches all features from the catalog.
 */
export async function getFeatureCatalog(): Promise<FeatureDefinition[]> {
  const supabase = await createSupabaseServerClient();
  const s = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: boolean): {
          order(k: string, o: { ascending: boolean }): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
        };
      };
    };
    rpc(name: string): Promise<{ data: unknown; error: { message: string } | null }>;
  };

  const { data } = await s.from("feature_catalog").select("code, name, description, feature_type, default_value, category_id").eq("is_active", true).order("sort_order", { ascending: true });

  // Fetch category map
  const catData = await (s as never as {
    from(t: string): {
      select(c: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
    };
  }).from("feature_categories").select("id, code");

  const catCodes: Record<string, string> = {};
  for (const c of (catData.data ?? [])) {
    catCodes[c.id as string] = c.code as string;
  }

  return ((data ?? []) as Record<string, unknown>[]).map((f) => ({
    code: f.code as string,
    name: f.name as string,
    description: f.description as string | null,
    category: catCodes[f.category_id as string] ?? "unknown",
    featureType: f.feature_type as FeatureDefinition["featureType"],
    defaultValue: f.default_value,
  }));
}

/**
 * Gets all limit definitions for a package.
 */
export async function getPackageLimits(packageId: string): Promise<LimitDefinition[]> {
  const supabase = await createSupabaseServerClient();
  const s = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): {
          order(k: string, o: { ascending: boolean }): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
        };
      };
    };
  };

  const { data } = await s
    .from("package_limits")
    .select("limit_code, label, value")
    .eq("package_id", packageId)
    .order("sort_order", { ascending: true });

  return ((data ?? []) as Record<string, unknown>[]).map((l) => ({
    code: l.limit_code as string,
    label: l.label as string,
    value: l.value as number,
  }));
}

/**
 * Records a subscription history event.
 */
export async function recordSubscriptionHistory(input: {
  subscriptionId: string;
  organizationId: string;
  eventType: string;
  previousPackageId?: string | null;
  newPackageId?: string | null;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  actorId?: string | null;
  reason?: string | null;
}): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await (admin as never as {
    from(t: string): {
      insert(r: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
    };
  }).from("subscription_history").insert({
    subscription_id: input.subscriptionId,
    organization_id: input.organizationId,
    event_type: input.eventType,
    previous_package_id: input.previousPackageId ?? null,
    new_package_id: input.newPackageId ?? null,
    previous_state: input.previousState ?? null,
    new_state: input.newState ?? null,
    actor_id: input.actorId ?? null,
    reason: input.reason ?? null,
  });
}
