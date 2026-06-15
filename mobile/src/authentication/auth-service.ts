import { getSupabaseClient, restoreSession, clearSession } from "@/api/supabase";
import { secureStorage, STORAGE_KEYS } from "@/storage/secure";
import { getPrimaryRole } from "@/rbac/permissions";
import type { AuthContext, AuthProfile, RoleName } from "@/types";
import { isRoleName } from "@/types";
import type { LoginCredentials, RegisterCredentials, LoginResult, SessionResult } from "./types";

function toAuthProfile(profile: Record<string, unknown>): AuthProfile {
  return {
    id: profile.id as string,
    gym_id: (profile.gym_id as string) ?? null,
    full_name: (profile.full_name as string) ?? "",
    email: (profile.email as string) ?? null,
    phone: (profile.phone as string) ?? null,
    avatar_url: (profile.avatar_url as string) ?? null,
    status: (profile.status as AuthProfile["status"]) ?? "active",
    emergency_contact_name: (profile.emergency_contact_name as string) ?? null,
    emergency_contact_phone: (profile.emergency_contact_phone as string) ?? null,
  };
}

async function getUserOrganizationId(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
  gymId: string | null
): Promise<string | null> {
  if (gymId) {
    const { data } = await supabase.from("gyms").select("organization_id").eq("id", gymId).maybeSingle();
    if (data?.organization_id) return data.organization_id;
  }

  const { data } = await supabase
    .from("branch_users")
    .select("organization_id,role_name,access_scope,status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("role_name", { ascending: false })
    .limit(10);

  const orgOwnerAssignment = data?.find(
    (a) => a.role_name === "organization_owner" && a.access_scope === "organization"
  );
  if (orgOwnerAssignment?.organization_id) return orgOwnerAssignment.organization_id;
  if (data?.[0]?.organization_id) return data[0].organization_id;

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();

  return org?.id ?? null;
}

async function buildAuthContext(supabase: ReturnType<typeof getSupabaseClient>, userId: string): Promise<AuthContext> {
  const { data: claimsData } = await supabase.auth.getSession();
  const claimsEmail = claimsData?.session?.user?.email ?? null;

  const [{ data: profile }, { data: assignments }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,gym_id,full_name,email,phone,avatar_url,status,emergency_contact_name,emergency_contact_phone")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_roles").select("role_id").eq("user_id", userId),
  ]);

  const roleIds = assignments?.map((a) => a.role_id) ?? [];
  const { data: roleRows } = roleIds.length > 0
    ? await supabase.from("roles").select("id,name").in("id", roleIds)
    : { data: [] };

  const roles = (roleRows ?? [])
    .map((r) => r.name)
    .filter(isRoleName);

  const normalizedProfile = profile ? toAuthProfile(profile as unknown as Record<string, unknown>) : null;
  const organizationId = await getUserOrganizationId(supabase, userId, normalizedProfile?.gym_id ?? null);
  const primaryRole = getPrimaryRole(roles);
  const isActive = normalizedProfile?.status === "active" || normalizedProfile?.status === "invited";

  return {
    userId,
    email: normalizedProfile?.email ?? claimsEmail,
    profile: normalizedProfile,
    organizationId,
    roles,
    primaryRole,
    isAuthenticated: true,
    isActive,
  };
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResult> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        if (error.message.includes("Email not confirmed")) {
          return { ok: false, error: "Please verify your email before signing in.", needsEmailConfirmation: true };
        }
        if (error.message.includes("Invalid login credentials")) {
          return { ok: false, error: "Invalid email or password." };
        }
        return { ok: false, error: error.message };
      }

      if (!data.user) {
        return { ok: false, error: "Sign in failed. Please try again." };
      }

      const user = await buildAuthContext(supabase, data.user.id);

      if (!user.isActive) {
        await supabase.auth.signOut();
        return { ok: false, error: "Your account has been deactivated. Please contact your organization administrator." };
      }

      if (user.organizationId) {
        const { data: org } = await supabase.from("organizations").select("status").eq("id", user.organizationId).maybeSingle();
        if (org && (org.status === "suspended" || org.status === "deactivated")) {
          await supabase.auth.signOut();
          return { ok: false, error: "Your organization's account has been suspended. Please contact support." };
        }
      }

      await secureStorage.setJSON(STORAGE_KEYS.SESSION_DATA, {
        access_token: data.session?.access_token ?? "",
        refresh_token: data.session?.refresh_token ?? "",
      });

      return { ok: true, user };
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred.";
      return { ok: false, error: message };
    }
  },

  async register(credentials: RegisterCredentials): Promise<LoginResult> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            full_name: credentials.fullName,
            phone: credentials.phone,
          },
        },
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      if (!data.user) {
        return { ok: false, error: "Registration failed. Please try again." };
      }

      return {
        ok: true,
        needsEmailConfirmation: true,
        user: data.session
          ? await buildAuthContext(supabase, data.user.id)
          : undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred.";
      return { ok: false, error: message };
    }
  },

  async logout(): Promise<void> {
    try {
      await clearSession();
    } catch {
      await secureStorage.clear();
    }
  },

  async restoreSession(): Promise<SessionResult> {
    try {
      const session = await restoreSession();

      if (!session) {
        return { ok: false, error: "No session found." };
      }

      const supabase = getSupabaseClient();
      const user = await buildAuthContext(supabase, session.user.id);

      return { ok: true, user };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Session restore failed.";
      return { ok: false, error: message };
    }
  },

  async refreshSession(): Promise<SessionResult> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.refreshSession();

      if (error || !data.session) {
        await clearSession();
        return { ok: false, error: "Session refresh failed. Please sign in again." };
      }

      const user = await buildAuthContext(supabase, data.session.user.id);

      await secureStorage.setJSON(STORAGE_KEYS.SESSION_DATA, {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      return { ok: true, user };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Session refresh failed.";
      return { ok: false, error: message };
    }
  },

  async updateProfile(updates: Partial<AuthProfile>): Promise<SessionResult> {
    try {
      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData?.session?.user;

      if (!currentUser) {
        return { ok: false, error: "Not authenticated." };
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", currentUser.id);

      if (error) {
        return { ok: false, error: error.message };
      }

      const context = await buildAuthContext(supabase, currentUser.id);
      return { ok: true, user: context };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Profile update failed.";
      return { ok: false, error: message };
    }
  },

  async getCurrentUser(): Promise<AuthContext | null> {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) return null;

      return buildAuthContext(supabase, data.session.user.id);
    } catch {
      return null;
    }
  },
};
