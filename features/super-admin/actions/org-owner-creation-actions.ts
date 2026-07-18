"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { isMfaFreshEnough } from "@/features/super-admin/lib/organization-governance";
import { getCriticalSuperAdminEmail } from "@/features/super-admin/lib/super-admin-governance-config";
import { createOrgOwnerSchema } from "../schemas/user-management-schemas";
import type { Database } from "@/types/database";

const superAdminRoles = ["super_admin"] as const;
const criticalMfaFreshnessCookieName = "super_admin_mfa_verified_at";

type AuthAdminClient = SupabaseClient<Database> & {
  auth: {
    admin: {
      createUser(params: {
        email: string;
        password: string;
        email_confirm?: boolean;
        user_metadata?: Record<string, unknown>;
      }): Promise<{ data: { user: { id: string } | null } | null; error: { message: string } | null }>;
      deleteUser(id: string): Promise<{ error: { message: string } | null }>;
      generateLink(params: { type: "signup" | "magiclink" | "recovery" | "invite"; email: string }): Promise<{
        data: { properties: { action_link: string } } | null;
        error: { message: string } | null;
      }>;
    };
  };
};

export async function createOrgOwnerAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void _previousState;
  const context = await requireRole(superAdminRoles, "/super-admin/users");
  const rateCheck = await checkRateLimit(`create_org_owner:${context.userId}`, 10, 60_000);
  if (!rateCheck.allowed) {
    return { status: "error", message: `Too many creation requests. Retry in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` };
  }

  const parsed = createOrgOwnerSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    password: formData.get("password"),
    phone: formData.get("phone") ?? "",
    orgName: formData.get("orgName"),
    orgSlug: formData.get("orgSlug"),
    orgDescription: formData.get("orgDescription") ?? "",
    timezone: formData.get("timezone") ?? "Asia/Kolkata",
    currency: formData.get("currency") ?? "INR",
    packageTier: formData.get("packageTier"),
    trialDays: formData.get("trialDays") ?? "14",
    billingPeriod: formData.get("billingPeriod") ?? "monthly",
    confirmation: formData.get("confirmation") ?? "",
    stepUpEmail: formData.get("stepUpEmail") ?? "",
    reason: formData.get("reason") ?? ""
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const criticalAccess = await verifyCriticalSuperAdminAccess(context, supabase, parsed.data.stepUpEmail);
  if (!criticalAccess.ok) return criticalAccess.state;

  if (parsed.data.confirmation !== "CREATE_ORG_OWNER") {
    return fieldError("confirmation", "Type CREATE_ORG_OWNER to confirm.");
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("email", parsed.data.email.toLowerCase().trim())
    .maybeSingle();

  if (existing) {
    if (existing.status === "active" || existing.status === "invited") {
      return { status: "error", message: "A user with this email already exists." };
    }
  }

  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", parsed.data.orgSlug)
    .maybeSingle();

  if (existingOrg) {
    return fieldError("orgSlug", "An organization with this slug already exists.");
  }

  const adminClient = supabase as AuthAdminClient;
  const authResult = await adminClient.auth.admin.createUser({
    email: parsed.data.email.toLowerCase().trim(),
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName, created_by: context.userId },
    app_metadata: { default_role: "organization_owner" }
  });

  if (authResult.error) {
    return { status: "error", message: authResult.error.message };
  }

  const authUserId = authResult.data?.user?.id;
  if (!authUserId) {
    return { status: "error", message: "User creation failed. No user ID returned." };
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: authUserId,
    full_name: parsed.data.fullName,
    email: parsed.data.email.toLowerCase().trim(),
    phone: parsed.data.phone || null,
    status: "active"
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authUserId).catch((rollbackError) => {
      console.error("[org-owner-creation] Failed to rollback auth user after profile creation failure:", rollbackError);
    });
    return { status: "error", message: profileError.message };
  }

  await writeAuditLog({
    actorId: context.userId,
    action: "org_owner.profile_created",
    entityType: "profile",
    entityId: authUserId,
    metadata: { email: parsed.data.email.toLowerCase().trim(), fullName: parsed.data.fullName }
  });

  const { data: org, error: orgError } = await supabase.from("organizations").insert({
    name: parsed.data.orgName,
    slug: parsed.data.orgSlug,
    owner_user_id: authUserId,
    created_by: context.userId,
    status: "active",
    organization_type: "single_gym",
    billing_email: parsed.data.email.toLowerCase().trim(),
    settings: {
      timezone: parsed.data.timezone ?? "Asia/Kolkata",
      currency: parsed.data.currency ?? "INR",
      description: parsed.data.orgDescription || null
    }
  }).select("id").single();

  if (orgError || !org) {
    await supabase.from("profiles").delete().eq("id", authUserId);
    await adminClient.auth.admin.deleteUser(authUserId).catch(() => {});
    return { status: "error", message: orgError?.message ?? "Organization creation failed." };
  }

  await writeAuditLog({
    actorId: context.userId,
    action: "org_owner.organization_created",
    entityType: "organization",
    entityId: org.id,
    metadata: {
      name: parsed.data.orgName,
      slug: parsed.data.orgSlug,
      ownerUserId: authUserId,
      packageTier: parsed.data.packageTier
    }
  });

  const { data: ownerRole } = await supabase.from("roles").select("id").eq("name", "organization_owner").maybeSingle();
  if (ownerRole) {
    const { error: roleError } = await supabase.from("user_roles").upsert({
      user_id: authUserId,
      role_id: ownerRole.id,
      assigned_by: context.userId
    }, { onConflict: "user_id,role_id,gym_id", ignoreDuplicates: true });

    if (roleError) {
      console.error("[org-owner-creation] User role insertion failed.", roleError.message);
    }
  } else {
    console.error("[org-owner-creation] organization_owner role not found in roles table");
  }

  await writeAuditLog({
    actorId: context.userId,
    action: "org_owner.role_assigned",
    entityType: "user_role",
    entityId: authUserId,
    metadata: { role: "org_owner", organizationId: org.id }
  });

  revalidateOrgOwnerPaths();
  return {
    status: "success",
    message: `Organization "${parsed.data.orgName}" created with owner ${parsed.data.email}.`
  };
}

async function verifyCriticalSuperAdminAccess(
  context: { userId: string | null; email: string | null; roles: string[] },
  supabase: SupabaseClient<Database>,
  value: string
): Promise<
  | { ok: true; mfa: { currentLevel: string | null; nextLevel: string | null } }
  | { ok: false; state: AuthActionState }
> {
  const email = context.email?.trim().toLowerCase() ?? null;
  const requiredEmail = getCriticalSuperAdminEmail();

  if (email !== requiredEmail) {
    return { ok: false, state: { status: "error", message: `Critical Super Admin actions must be performed from ${requiredEmail}.` } };
  }

  if (value.trim().toLowerCase() !== requiredEmail) {
    return { ok: false, state: fieldError("stepUpEmail", `Type ${requiredEmail} to pass the step-up identity check.`) };
  }

  const mfaResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentLevel = mfaResult.data?.currentLevel ?? null;

  if (currentLevel !== "aal2") {
    return { ok: false, state: { status: "error", message: "MFA verification is required. Verify MFA at /super-admin/security/mfa first.", fieldErrors: { stepUpEmail: ["Verify MFA first."] } } };
  }

  const cookieStore = await cookies();
  const verifiedAt = cookieStore.get(criticalMfaFreshnessCookieName)?.value ?? null;
  if (!isMfaFreshEnough(verifiedAt)) {
    return { ok: false, state: { status: "error", message: "MFA verification is stale. Verify a fresh code.", fieldErrors: { stepUpEmail: ["Verify a fresh MFA challenge within 10 minutes."] } } };
  }

  return { ok: true, mfa: { currentLevel, nextLevel: mfaResult.data?.nextLevel ?? null } };
}

function validationState(fieldErrors: Record<string, string[] | undefined>): AuthActionState {
  return {
    status: "error",
    message: "Check the highlighted fields.",
    fieldErrors: Object.fromEntries(Object.entries(fieldErrors).filter(([, v]) => v?.length)) as Record<string, string[]>
  };
}

function fieldError(field: string, message: string): AuthActionState {
  return { status: "error", message, fieldErrors: { [field]: [message] } };
}

function revalidateOrgOwnerPaths() {
  revalidatePath("/super-admin");
  revalidatePath("/super-admin/users");
  revalidatePath("/super-admin/organizations");
}
