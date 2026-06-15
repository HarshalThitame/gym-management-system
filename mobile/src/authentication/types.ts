import type { AuthContext, RoleName } from "@/types";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface AuthState {
  isInitialized: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthContext | null;
  error: string | null;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
  needsEmailConfirmation?: boolean;
  user?: AuthContext;
}

export interface SessionResult {
  ok: boolean;
  error?: string;
  user?: AuthContext;
}

export type AuthAction =
  | { type: "INIT_START" }
  | { type: "INIT_COMPLETE"; user: AuthContext | null }
  | { type: "LOGIN_START" }
  | { type: "LOGIN_SUCCESS"; user: AuthContext }
  | { type: "LOGIN_FAILURE"; error: string }
  | { type: "LOGOUT" }
  | { type: "SESSION_RESTORED"; user: AuthContext }
  | { type: "SESSION_EXPIRED" }
  | { type: "UPDATE_USER"; user: Partial<AuthContext> }
  | { type: "SET_ERROR"; error: string };
