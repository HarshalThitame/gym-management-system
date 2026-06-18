"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import type {
  OrgSubscriptionDetail,
  PackageInfo,
} from "./types";

function db() {
  const c = getSupabaseAdminClient();
  if (!c) throw new Error("Database connection failed.");
  return c as any;
}

export async function getOrgSubscriptionDetailAction(
  organizationId: string
): Promise<{ ok: boolean; data?: OrgSubscriptionDetail; error?: string }> {
  const context = await requireOrganizationOwner("/organization");
  if (organizationId !== context.organizationId) {
    return { ok: false, error: "Organization mismatch." };
  }

  const { data, error } = await db().rpc("get_org_subscription_detail", {
    p_organization_id: organizationId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: data as unknown as OrgSubscriptionDetail };
}

export async function getAvailablePackagesAction(): Promise<{
  ok: boolean;
  data?: PackageInfo[];
  error?: string;
}> {
  const { data: packages, error } = await db()
    .from("packages")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return { ok: false, error: error.message };
  }

  const packagesWithDetails: PackageInfo[] = [];

  for (const pkg of packages ?? []) {
    const { data: pricing } = await db()
      .from("package_pricing")
      .select("*")
      .eq("package_id", pkg.id)
      .eq("is_active", true);

    const { data: features } = await db()
      .from("package_features")
      .select("feature_code, value")
      .eq("package_id", pkg.id);

    const { data: limits } = await db()
      .from("package_limits")
      .select("limit_code, value, label")
      .eq("package_id", pkg.id);

    const featuresMap: Record<string, unknown> = {};
    for (const f of features ?? []) {
      featuresMap[f.feature_code] = f.value;
    }

    const limitsMap: Record<string, { value: number; label: string }> = {};
    for (const l of limits ?? []) {
      limitsMap[l.limit_code] = { value: l.value, label: l.label };
    }

    packagesWithDetails.push({
      id: pkg.id,
      name: pkg.name,
      slug: pkg.slug,
      description: pkg.description,
      is_active: pkg.is_active,
      sort_order: pkg.sort_order,
      trial_days: pkg.trial_days,
      color: pkg.color,
      icon: pkg.icon,
      pricing: (pricing ?? []).map((p: any) => ({
        billing_period: p.billing_period,
        price: p.price,
        currency: p.currency,
        setup_fee: p.setup_fee ?? 0,
      })),
      features: featuresMap,
      limits: limitsMap,
    });
  }

  return { ok: true, data: packagesWithDetails };
}

export async function getOrgInvoiceHistoryAction(
  organizationId: string
): Promise<{ ok: boolean; data?: unknown[]; error?: string }> {
  const context = await requireOrganizationOwner("/organization");
  if (organizationId !== context.organizationId) {
    return { ok: false, error: "Organization mismatch." };
  }

  const { data, error } = await db()
    .from("org_subscription_invoices")
    .select("*")
    .eq("organization_id", organizationId)
    .order("issued_at", { ascending: false });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}
