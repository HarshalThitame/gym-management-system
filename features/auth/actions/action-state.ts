export type AuthActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  error?: "FEATURE_LOCKED";
  reason?: string;
  featureKey?: string | null;
};

export const initialAuthActionState: AuthActionState = {
  status: "idle",
  message: ""
};
