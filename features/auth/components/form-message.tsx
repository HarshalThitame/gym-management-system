import type { AuthActionState } from "../actions/action-state";

type FormMessageProps = {
  state: AuthActionState;
};

export function FormMessage({ state }: FormMessageProps) {
  if (!state.message) {
    return null;
  }

  const className = state.status === "success"
    ? "border-success/25 bg-success/10 text-success"
    : "border-destructive/25 bg-destructive/10 text-destructive";

  return (
    <p className={`rounded-md border px-3 py-2 text-sm font-medium ${className}`} role="status">
      {state.message}
    </p>
  );
}

export function FieldError({ message }: { message?: string | undefined }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm font-medium text-destructive">{message}</p>;
}
