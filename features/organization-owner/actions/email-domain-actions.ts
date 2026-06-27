"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database } from "@/types/database";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { entitlementActionCatch, requireOrganizationFeatureAccess } from "@/features/entitlement";
import {
  addSendingDomain as resendAddDomain,
  verifySendingDomain as resendVerifyDomain,
  getSendingDomain as resendGetDomain,
  removeSendingDomain as resendRemoveDomain,
} from "@/services/email/resend-domains";

type DomainRow = Database["public"]["Tables"]["tenant_domains"]["Row"];

export async function addEmailSendingDomainAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/communications");
    await requireOrganizationFeatureAccess({
      organizationId: ctx.organizationId,
      featureKey: "custom_email_domain",
      actionName: "email-domain.add",
    });

    const domain = formData.get("domain") as string;
    if (!domain) return { ...prevState, status: "error", message: "Domain is required." };
    if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
      return { ...prevState, status: "error", message: "Enter a valid domain name (e.g., mail.example.com)." };
    }

    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("tenant_domains")
      .select("id")
      .eq("domain", domain)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();

    if (existing) {
      return { ...prevState, status: "error", message: "Domain already added to your organization." };
    }

    const resendResult = await resendAddDomain(domain);
    if (resendResult.error || !resendResult.data) {
      return { ...prevState, status: "error", message: resendResult.error || "Failed to add domain to Resend." };
    }

    const resendId = resendResult.data.id;
    const records = resendResult.data.records ?? [];

    const insert: Record<string, unknown> = {
      organization_id: ctx.organizationId,
      domain,
      domain_type: "email_sending",
      status: "pending",
      is_primary: false,
      dns_records: records as never,
      metadata: { resendDomainId: resendId, region: resendResult.data.region } as never,
    };

    const { data: inserted, error } = await supabase
      .from("tenant_domains")
      .insert(insert as never)
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await writeAuditLog({
      actorId: ctx.userId,
      action: "organization_owner.add_email_sending_domain",
      entityType: "tenant_domain",
      entityId: inserted.id,
      metadata: { domain, resendDomainId: resendId } as never,
    });

    revalidateOrgModules(["/organization/communications"]);
    return { ...prevState, status: "success", message: "Email sending domain added. Add the DNS records below and verify." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to add email sending domain.");
  }
}

export async function verifyEmailSendingDomainAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/communications");
    await requireOrganizationFeatureAccess({
      organizationId: ctx.organizationId,
      featureKey: "custom_email_domain",
      actionName: "email-domain.verify",
    });

    const domainId = formData.get("domainId") as string;
    if (!domainId) return { ...prevState, status: "error", message: "Domain ID is required." };

    const supabase = await createSupabaseServerClient();

    const { data: domain, error: fetchError } = await supabase
      .from("tenant_domains")
      .select("metadata")
      .eq("id", domainId)
      .eq("organization_id", ctx.organizationId)
      .single();

    if (fetchError || !domain) {
      return { ...prevState, status: "error", message: "Domain not found." };
    }

    const metadata = domain.metadata as Record<string, unknown> | null;
    const resendDomainId = metadata?.resendDomainId as string | null;

    if (!resendDomainId) {
      return { ...prevState, status: "error", message: "No Resend domain reference found. Re-add the domain." };
    }

    const verifyResult = await resendVerifyDomain(resendDomainId);
    if (verifyResult.error) {
      return { ...prevState, status: "error", message: verifyResult.error };
    }

    const domainResult = await resendGetDomain(resendDomainId);
    const newStatus = domainResult.data?.status === "verified" ? "verified" : "pending";

    const { error: updateError } = await supabase
      .from("tenant_domains")
      .update({
        status: newStatus,
        dns_records: (domainResult.data?.records ?? []) as never,
        verified_at: newStatus === "verified" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", domainId);

    if (updateError) throw new Error(updateError.message);

    await writeAuditLog({
      actorId: ctx.userId,
      action: "organization_owner.verify_email_sending_domain",
      entityType: "tenant_domain",
      entityId: domainId,
      metadata: { status: newStatus } as never,
    });

    revalidateOrgModules(["/organization/communications"]);
    return {
      ...prevState,
      status: newStatus === "verified" ? "success" : "error",
      message: newStatus === "verified"
        ? "Domain verified! You can now send emails from this domain."
        : "Domain not yet verified. Check DNS records and try again.",
    };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to verify email sending domain.");
  }
}

export async function removeEmailSendingDomainAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/communications");
    await requireOrganizationFeatureAccess({
      organizationId: ctx.organizationId,
      featureKey: "custom_email_domain",
      actionName: "email-domain.remove",
    });

    const domainId = formData.get("domainId") as string;
    if (!domainId) return { ...prevState, status: "error", message: "Domain ID is required." };

    const supabase = await createSupabaseServerClient();

    const { data: domain, error: fetchError } = await supabase
      .from("tenant_domains")
      .select("metadata")
      .eq("id", domainId)
      .eq("organization_id", ctx.organizationId)
      .single();

    if (fetchError || !domain) {
      return { ...prevState, status: "error", message: "Domain not found." };
    }

    const metadata = domain.metadata as Record<string, unknown> | null;
    const resendDomainId = metadata?.resendDomainId as string | null;

    if (resendDomainId) {
      const resendResult = await resendRemoveDomain(resendDomainId);
      if (resendResult.error) {
        return { ...prevState, status: "error", message: resendResult.error };
      }
    }

    const { error: updateError } = await supabase
      .from("tenant_domains")
      .update({ status: "disabled", updated_at: new Date().toISOString() } as never)
      .eq("id", domainId);

    if (updateError) throw new Error(updateError.message);

    await writeAuditLog({
      actorId: ctx.userId,
      action: "organization_owner.remove_email_sending_domain",
      entityType: "tenant_domain",
      entityId: domainId,
    });

    revalidateOrgModules(["/organization/communications"]);
    return { ...prevState, status: "success", message: "Email sending domain removed." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to remove email sending domain.");
  }
}

export async function getEmailSendingDomainsAction(
  organizationId: string
): Promise<DomainRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenant_domains")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("domain_type", "email_sending")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as DomainRow[];
}
