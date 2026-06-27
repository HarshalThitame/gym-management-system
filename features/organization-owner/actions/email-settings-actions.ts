"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { entitlementActionCatch, requireOrganizationFeatureAccess } from "@/features/entitlement";
import { sendEmail } from "@/services/email/resend";

export async function saveEmailSettingsAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/communications");
    await requireOrganizationFeatureAccess({
      organizationId: ctx.organizationId,
      featureKey: "custom_email_domain",
      actionName: "email-settings.save",
    });

    const supabase = await createSupabaseServerClient();

    const configId = formData.get("configId") as string | null;
    const emailFromName = (formData.get("emailFromName") as string) || null;
    const emailReplyTo = (formData.get("emailReplyTo") as string) || null;
    const emailLogoUrl = (formData.get("emailLogoUrl") as string) || null;
    const fromEmailLocalPart = (formData.get("fromEmailLocalPart") as string) || null;

    if (!configId) {
      return { ...prevState, status: "error", message: "No brand config selected. Set up branding first." };
    }

    const { data: existing } = await supabase
      .from("tenant_configs")
      .select("email_branding")
      .eq("id", configId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();

    if (!existing) {
      return { ...prevState, status: "error", message: "Brand config not found." };
    }

    const currentBranding = (existing.email_branding ?? {}) as Record<string, unknown>;
    const emailBranding = {
      ...currentBranding,
      ...(emailFromName !== null ? { fromName: emailFromName } : {}),
      ...(emailReplyTo !== null ? { replyTo: emailReplyTo } : {}),
      ...(emailLogoUrl !== null ? { logoUrl: emailLogoUrl } : {}),
      ...(fromEmailLocalPart !== null ? { fromEmailLocalPart } : {}),
    };

    const { error } = await supabase
      .from("tenant_configs")
      .update({ email_branding: emailBranding, updated_at: new Date().toISOString() } as never)
      .eq("id", configId);

    if (error) throw new Error(error.message);

    await writeAuditLog({
      actorId: ctx.userId,
      action: "organization_owner.save_email_settings",
      entityType: "tenant_config",
      entityId: configId,
    });

    revalidateOrgModules(["/organization/communications"]);
    return { ...prevState, status: "success", message: "Email settings saved." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to save email settings.");
  }
}

export async function sendTestEmailAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/communications");
    await requireOrganizationFeatureAccess({
      organizationId: ctx.organizationId,
      featureKey: "custom_email_domain",
      actionName: "email-settings.test",
    });

    const to = formData.get("to") as string;
    const from = (formData.get("from") as string) || undefined;
    const replyTo = (formData.get("replyTo") as string) || undefined;

    if (!to) return { ...prevState, status: "error", message: "Recipient email is required." };

    const result = await sendEmail({
      to,
      subject: "Test email from your organization",
      html: `<p>This is a test email from your organization's email configuration.</p><p>If you received this, your email settings are working correctly.</p>`,
      ...(from ? { from } : {}),
      ...(replyTo ? { replyTo } : {}),
    });

    if (!result.sent) {
      return { ...prevState, status: "error", message: result.reason || "Failed to send test email." };
    }

    return { ...prevState, status: "success", message: "Test email sent successfully!" };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to send test email.");
  }
}
