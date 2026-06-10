export type AuthActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialAuthActionState: AuthActionState = {
  status: "idle",
  message: ""
};
