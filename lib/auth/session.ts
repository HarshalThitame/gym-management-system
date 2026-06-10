import { unstable_noStore as noStore } from "next/cache";
import { getPrimaryRole } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";
import type { AuthContext, AuthProfile, RoleName } from "@/types/auth";
import { isRoleName } from "@/types/auth";

const anonymousContext: AuthContext = {
  userId: null,
  email: null,
  profile: null,
  roles: [],
  primaryRole: null,
  isAuthenticated: false,
  isActive: false
};

export async function getAuthContext(): Promise<AuthContext> {
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
      .select("id,gym_id,full_name,email,phone,avatar_url,status,emergency_contact_name,emergency_contact_phone")
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
  const primaryRole = getPrimaryRole(roles);
  const isActive = normalizedProfile?.status === "active" || normalizedProfile?.status === "invited";

  return {
    userId,
    email: normalizedProfile?.email ?? claimsEmail,
    profile: normalizedProfile,
    roles,
    primaryRole,
    isAuthenticated: true,
    isActive
  };
}

function toAuthProfile(profile: AuthProfile): AuthProfile {
  return profile;
}

export function userHasRole(context: AuthContext, allowedRoles: readonly RoleName[]) {
  return allowedRoles.some((role) => context.roles.includes(role));
}
