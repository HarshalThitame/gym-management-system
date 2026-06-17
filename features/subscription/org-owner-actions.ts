"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import {
  submitRequestSchema,
  uploadPaymentProofSchema,
  cancelRequestSchema,
  type SubmitRequestInput,
  type UploadPaymentProofInput,
  type CancelRequestInput,
} from "./schemas";
import type {
  SubscriptionRequest,
  OrgSubscriptionDetail,
  PackageInfo,
} from "./types";

function db() {
  const c = getSupabaseAdminClient();
  if (!c) throw new Error("Database connection failed.");
  return c as any;
}

export async function submitSubscriptionRequest(input: SubmitRequestInput) {
  const context = await requireOrganizationOwner("/organization");

  const parsed = submitRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (parsed.data.organizationId !== context.organizationId) {
    return { ok: false, error: "Organization mismatch." };
  }

  const { data, error } = await db().rpc("submit_subscription_request", {
    p_organization_id: parsed.data.organizationId,
    p_request_type: parsed.data.requestType,
    p_requested_package_id: parsed.data.requestedPackageId ?? null,
    p_current_package_id: parsed.data.currentPackageId ?? null,
    p_requested_billing_period: parsed.data.requestedBillingPeriod ?? null,
    p_reason: parsed.data.reason ?? null,
    p_organization_note: parsed.data.organizationNote ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
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

export async function getOrgSubscriptionRequestsAction(
  organizationId: string
): Promise<{ ok: boolean; data?: SubscriptionRequest[]; error?: string }> {
  const context = await requireOrganizationOwner("/organization");
  if (organizationId !== context.organizationId) {
    return { ok: false, error: "Organization mismatch." };
  }

  const { data, error } = await db()
    .from("subscription_requests")
    .select("*")
    .eq("organization_id", organizationId)
    .order("requested_at", { ascending: false });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: data as unknown as SubscriptionRequest[] };
}

export async function uploadPaymentProofAction(input: UploadPaymentProofInput) {
  const context = await requireOrganizationOwner("/organization");

  const parsed = uploadPaymentProofSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Verify the request belongs to this org
  const { data: request } = await db()
    .from("subscription_requests")
    .select("id, organization_id, status")
    .eq("id", parsed.data.requestId)
    .single();

  if (!request || request.organization_id !== context.organizationId) {
    return { ok: false, error: "Request not found or organization mismatch." };
  }

  if (request.status !== "approved") {
    return { ok: false, error: "Payment proof can only be uploaded for approved requests." };
  }

  const { error } = await db()
    .from("subscription_requests")
    .update({
      payment_proof_url: parsed.data.paymentProofUrl,
      payment_proof_uploaded_at: new Date().toISOString(),
      payment_note: parsed.data.paymentNote ?? null,
    })
    .eq("id", parsed.data.requestId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: { requestId: parsed.data.requestId } };
}

export async function cancelOwnRequestAction(input: CancelRequestInput) {
  const context = await requireOrganizationOwner("/organization");

  const parsed = cancelRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { data: request } = await db()
    .from("subscription_requests")
    .select("id, organization_id, status, requested_by")
    .eq("id", parsed.data.requestId)
    .single();

  if (!request || request.organization_id !== context.organizationId) {
    return { ok: false, error: "Request not found." };
  }

  if (request.status !== "pending") {
    return { ok: false, error: "Only pending requests can be cancelled." };
  }

  const { error } = await db()
    .from("subscription_requests")
    .update({
      status: "cancelled_by_organization",
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.requestId)
    .eq("requested_by", context.userId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: { requestId: parsed.data.requestId, status: "cancelled_by_organization" } };
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
