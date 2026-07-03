import { cache } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { getPrimaryRole } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import type { AuthContext, AuthProfile, ProfileStatus, RoleName } from "@/types/auth";
import { isRoleName } from "@/types/auth";

const anonymousContext: AuthContext = {
  userId: null,
  email: null,
  profile: null,
  organizationId: null,
  roles: [],
  primaryRole: null,
  isAuthenticated: false,
  isActive: false
};

export const getAuthContext: () => Promise<AuthContext> = cache(async () => {
  noStore();

  if (!hasSupabasePublicEnv()) {
    return anonymousContext;
  }

  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;

  if (claimsError || !claimsData || typeof userId !== "string") {
    return anonymousContext;
  }

  const claimsEmail = typeof claimsData.claims.email === "string" ? claimsData.claims.email : null;

  const [{ data: profile }, { data: assignments }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,gym_id,branch_id,full_name,email,phone,avatar_url,status,emergency_contact_name,emergency_contact_phone")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_roles").select("role_id").eq("user_id", userId)
  ]);

  const roleIds = assignments?.map((assignment) => assignment.role_id) ?? [];
  const { data: roleRows } = roleIds.length > 0
    ? await supabase.from("roles").select("id,name").in("id", roleIds)
    : { data: [] };

  const roles = (roleRows ?? [])
    .map((role) => role.name)
    .filter(isRoleName);
  const normalizedProfile = profile ? toAuthProfile(profile) : null;
  const organizationScope = await getUserOrganizationScope(supabase, userId, normalizedProfile?.gym_id ?? null, normalizedProfile?.branch_id ?? null);
  const mergedRoles = organizationScope.isOrganizationOwner && !roles.includes("organization_owner")
    ? [...roles, "organization_owner" as const]
    : roles;
  const primaryRole = getPrimaryRole(mergedRoles);
  const isActive = normalizedProfile?.status === "active" || normalizedProfile?.status === "invited";

  return {
    userId,
    email: normalizedProfile?.email ?? claimsEmail,
    profile: normalizedProfile,
    organizationId: organizationScope.organizationId,
    roles: mergedRoles,
    primaryRole,
    isAuthenticated: true,
    isActive
  };
});

function toAuthProfile(profile: Omit<AuthProfile, "status"> & { status: string }): AuthProfile {
  return {
    ...profile,
    status: normalizeProfileStatus(profile.status)
  };
}

function normalizeProfileStatus(status: string): ProfileStatus {
  return status === "active" || status === "invited" || status === "suspended" || status === "archived" ? status : "active";
}

async function getUserOrganizationScope(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, gymId: string | null, branchId: string | null) {
  let scopedOrganizationId: string | null = null;

  if (gymId) {
    const { data } = await supabase.from("gyms").select("organization_id").eq("id", gymId).maybeSingle();
    scopedOrganizationId = data?.organization_id ?? null;
  }

  if (!scopedOrganizationId && branchId) {
    const { data } = await supabase.from("branches").select("organization_id").eq("id", branchId).maybeSingle();
    scopedOrganizationId = data?.organization_id ?? null;
  }

  const { data } = await supabase
    .from("branch_users")
    .select("organization_id,role_name,access_scope,status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("role_name", { ascending: false })
    .limit(10);

  const orgOwnerAssignment = data?.find((a) => a.role_name === "organization_owner" && a.access_scope === "organization");
  if (orgOwnerAssignment?.organization_id) return { organizationId: orgOwnerAssignment.organization_id, isOrganizationOwner: true };
  if (data?.[0]?.organization_id) return { organizationId: data[0].organization_id, isOrganizationOwner: false };

  if (scopedOrganizationId) {
    const { data: scopedOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", scopedOrganizationId)
      .eq("owner_user_id", userId)
      .maybeSingle();

    return { organizationId: scopedOrganizationId, isOrganizationOwner: Boolean(scopedOrg?.id) };
  }

  // Fallback: check if user is the owner of any organization.
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();

  return { organizationId: org?.id ?? null, isOrganizationOwner: Boolean(org?.id) };
}

export function userHasRole(context: AuthContext, allowedRoles: readonly RoleName[]) {
  return allowedRoles.some((role) => context.roles.includes(role));
}
