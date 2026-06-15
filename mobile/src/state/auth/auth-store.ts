import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthContext, RoleName } from "@/types";
import { authService } from "@/authentication/auth-service";
import type { LoginCredentials, RegisterCredentials } from "@/authentication/types";
import { getPrimaryRole } from "@/rbac/permissions";
import { secureStorage } from "@/storage/secure";

interface AuthStoreState {
  isInitialized: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthContext | null;
  error: string | null;

  initialize: () => Promise<void>;
  login: (credentials: LoginCredentials) => Promise<{ ok: boolean; error?: string }>;
  register: (credentials: RegisterCredentials) => Promise<{ ok: boolean; error?: string; needsConfirmation?: boolean }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateUser: (updates: Partial<AuthContext>) => void;
  clearError: () => void;
}

const zustandSecureStorage = {
  getItem: async (name: string) => {
    try {
      return await secureStorage.get(name as never);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string) => {
    try {
      await secureStorage.set(name as never, value);
    } catch {}
  },
  removeItem: async (name: string) => {
    try {
      await secureStorage.delete(name as never);
    } catch {}
  },
};

export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set, get) => ({
      isInitialized: false,
      isLoading: false,
      isAuthenticated: false,
      user: null,
      error: null,

      initialize: async () => {
        try {
          set({ isLoading: true });
          console.log("[AuthStore] Initializing session...");

          let completed = false;

          const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => {
              if (completed) return;
              console.warn("[AuthStore] Session restore timed out after 6s");
              resolve(null);
            }, 6000);
          });

          const result = await Promise.race([
            authService.restoreSession(),
            timeoutPromise,
          ]);

          completed = true;

          if (result && result.ok && result.user) {
            console.log("[AuthStore] Session restored:", result.user.primaryRole);
            set({
              isInitialized: true,
              isLoading: false,
              isAuthenticated: true,
              user: result.user,
              error: null,
            });
            return;
          }

          console.log("[AuthStore] No valid session found. Proceeding to login.");
          set({
            isInitialized: true,
            isLoading: false,
            isAuthenticated: false,
            user: null,
            error: null,
          });
        } catch (err) {
          console.error("[AuthStore] Initialization error:", err);
          set({
            isInitialized: true,
            isLoading: false,
            isAuthenticated: false,
            user: null,
          });
        }
      },

      login: async (credentials) => {
        set({ isLoading: true, error: null });
        const result = await authService.login(credentials);

        if (result.ok && result.user) {
          const user = result.user;
          set({
            isLoading: false,
            isAuthenticated: true,
            user,
            error: null,
          });
          return { ok: true, primaryRole: user.primaryRole, roles: user.roles };
        }

        set({
          isLoading: false,
          isAuthenticated: false,
          error: result.error ?? "Login failed.",
        });
        return { ok: false, error: result.error };
      },

      register: async (credentials) => {
        set({ isLoading: true, error: null });
        const result = await authService.register(credentials);

        if (result.ok) {
          if (result.needsEmailConfirmation) {
            set({ isLoading: false, error: null, isAuthenticated: false, user: null });
            return { ok: true, needsConfirmation: true };
          }

          if (result.user) {
            set({ isLoading: false, isAuthenticated: true, user: result.user, error: null });
            return { ok: true };
          }
        }

        set({ isLoading: false, error: result.error ?? "Registration failed." });
        return { ok: false, error: result.error };
      },

      logout: async () => {
        await authService.logout();
        set({ isLoading: false, isAuthenticated: false, user: null, error: null });
      },

      refreshSession: async () => {
        const result = await authService.refreshSession();
        if (result.ok && result.user) {
          set({ user: result.user, isAuthenticated: true, error: null });
        } else {
          set({ isAuthenticated: false, user: null, error: result.error ?? "Session expired." });
        }
      },

      updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...updates } });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "apex-auth-storage",
      storage: createJSONStorage(() => zustandSecureStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
      version: 1,
    }
  )
);

export const useAuth = () => {
  const store = useAuthStore();
  return {
    ...store,
    primaryRole: store.user?.primaryRole ?? null,
    roles: store.user?.roles ?? ([] as RoleName[]),
    organizationId: store.user?.organizationId ?? null,
    profile: store.user?.profile ?? null,
  };
};
